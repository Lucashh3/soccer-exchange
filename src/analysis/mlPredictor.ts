import * as tf from '@tensorflow/tfjs-node'
import path from 'path'
import fs from 'fs'

const MODELS_DIR = path.resolve(process.cwd(), 'ml/models')
const SCALER_PATH = path.resolve(process.cwd(), 'ml/data/processed/scaler.json')

interface ScalerParams {
  mean: number[]
  scale: number[]
  feature_cols: string[]
}

export interface MLFeatures {
  homeGoalsScoredAvg5: number
  homeGoalsConcededAvg5: number
  homeShotsAvg5: number
  homeShotsOnTargetAvg5: number
  homeCornersAvg5: number
  homeCardsAvg5: number
  homeXgProxyAvg5: number
  homeFormPts5: number
  awayGoalsScoredAvg5: number
  awayGoalsConcededAvg5: number
  awayShotsAvg5: number
  awayShotsOnTargetAvg5: number
  awayCornersAvg5: number
  awayCardsAvg5: number
  awayXgProxyAvg5: number
  awayFormPts5: number
  leagueId: number
}

export interface MLPrediction {
  homeWin: number
  draw: number
  awayWin: number
  lambdaHome: number
  lambdaAway: number
  source: 'ml'
}

let outcomeModel: tf.LayersModel | null = null
let goalsHomeModel: tf.LayersModel | null = null
let goalsAwayModel: tf.LayersModel | null = null
let scaler: ScalerParams | null = null
let modelsLoaded = false

async function loadModelsInner(): Promise<void> {
  const outcomeDir = path.join(MODELS_DIR, 'outcome', 'model.json')
  const goalsHomeDir = path.join(MODELS_DIR, 'goals_home', 'model.json')
  const goalsAwayDir = path.join(MODELS_DIR, 'goals_away', 'model.json')

  if (!fs.existsSync(outcomeDir)) {
    console.log('[mlPredictor] Models not found, skipping ML load')
    return
  }

  // Dispose old models before reloading
  outcomeModel?.dispose()
  goalsHomeModel?.dispose()
  goalsAwayModel?.dispose()
  outcomeModel = null
  goalsHomeModel = null
  goalsAwayModel = null
  modelsLoaded = false

  ;[outcomeModel, goalsHomeModel, goalsAwayModel] = await Promise.all([
    tf.loadLayersModel(`file://${outcomeDir}`),
    tf.loadLayersModel(`file://${goalsHomeDir}`),
    tf.loadLayersModel(`file://${goalsAwayDir}`),
  ])
  scaler = JSON.parse(fs.readFileSync(SCALER_PATH, 'utf-8'))
  modelsLoaded = true
}

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return
  try {
    console.log('[mlPredictor] Loading TF.js models...')
    await loadModelsInner()
    console.log('[mlPredictor] Models loaded successfully')
  } catch (err) {
    console.error('[mlPredictor] Failed to load models:', err)
  }
}

export async function reloadModels(): Promise<void> {
  try {
    console.log('[mlPredictor] Reloading TF.js models after fine-tune...')
    await loadModelsInner()
    console.log('[mlPredictor] Models reloaded successfully')
  } catch (err) {
    console.error('[mlPredictor] Failed to reload models:', err)
  }
}

function featuresToArray(f: MLFeatures): number[] {
  return [
    f.homeGoalsScoredAvg5,
    f.homeGoalsConcededAvg5,
    f.homeShotsAvg5,
    f.homeShotsOnTargetAvg5,
    f.homeCornersAvg5,
    f.homeCardsAvg5,
    f.homeXgProxyAvg5,
    f.homeFormPts5,
    f.awayGoalsScoredAvg5,
    f.awayGoalsConcededAvg5,
    f.awayShotsAvg5,
    f.awayShotsOnTargetAvg5,
    f.awayCornersAvg5,
    f.awayCardsAvg5,
    f.awayXgProxyAvg5,
    f.awayFormPts5,
    f.leagueId,
  ]
}

function scaleFeatures(raw: number[]): number[] {
  if (!scaler) return raw
  return raw.map((v, i) => (v - scaler!.mean[i]) / scaler!.scale[i])
}

export async function mlPredict(features: MLFeatures): Promise<MLPrediction | null> {
  if (!modelsLoaded || !outcomeModel || !goalsHomeModel || !goalsAwayModel) {
    return null
  }

  const raw = featuresToArray(features)
  const scaled = scaleFeatures(raw)
  const inputTensor = tf.tensor2d([scaled])

  try {
    const [outcomePreds, goalsHomePreds, goalsAwayPreds] = await Promise.all([
      (outcomeModel.predict(inputTensor) as tf.Tensor).data(),
      (goalsHomeModel.predict(inputTensor) as tf.Tensor).data(),
      (goalsAwayModel.predict(inputTensor) as tf.Tensor).data(),
    ])

    inputTensor.dispose()

    return {
      homeWin: outcomePreds[0],
      draw: outcomePreds[1],
      awayWin: outcomePreds[2],
      lambdaHome: Math.max(goalsHomePreds[0], 0.1),
      lambdaAway: Math.max(goalsAwayPreds[0], 0.1),
      source: 'ml',
    }
  } catch (err) {
    inputTensor.dispose()
    console.error('[mlPredictor] Prediction error:', err)
    return null
  }
}

export function isLoaded(): boolean {
  return modelsLoaded
}

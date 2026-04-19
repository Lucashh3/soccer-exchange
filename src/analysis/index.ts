import { getGameById, getTeamStats } from '../db/queries/games'
import { upsertSignal, upsertAnalysis, getNewsByGameId, upsertSignalDecisionDebug, clearSignalsForGame } from '../db/queries/signals'
import { buildScoreMatrix, computeProbabilities } from './poisson'
import { mlPredict, isLoaded, type MLFeatures } from './mlPredictor'
import { buildAnalysisPrompt } from '../llm/prompts'
import { generateReport } from '../llm'
import { getAbsentHighImpactPlayers } from '../db/queries/playerImpact'
import type { MarketType, Recommendation, TeamStats, Probabilities } from '../types/index'

const LEAGUE_ID_MAP: Record<string, number> = {
  'Premier League': 0,
  'La Liga': 1,
  'Serie A': 2,
  'Bundesliga': 3,
  'Ligue 1': 4,
}

interface SignalInput {
  market: MarketType
  recommendation: Recommendation
  probability: number
  confidence: number
  ev?: number
}

interface GenerateSignalsResult {
  signals: SignalInput[]
  guardrails: string[]
  noBetReason?: string
}

function boolEnv(name: string, defaultValue: boolean): boolean {
  const raw = process.env[name]
  if (raw === undefined) return defaultValue
  return !['0', 'false', 'off', 'no'].includes(raw.trim().toLowerCase())
}

function clamp01(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

function normalizeThreeWay(home: number, draw: number, away: number): Pick<Probabilities, 'homeWin' | 'draw' | 'awayWin'> {
  const h = clamp01(home)
  const d = clamp01(draw)
  const a = clamp01(away)
  const sum = h + d + a
  if (sum <= 0) return { homeWin: 0.33, draw: 0.34, awayWin: 0.33 }
  return { homeWin: h / sum, draw: d / sum, awayWin: a / sum }
}

function computeDataQuality(stats: TeamStats | null): number {
  if (!stats) return 0.3
  let score = 0
  let count = 0
  const fields: (keyof TeamStats)[] = [
    'goalsScoredAvg', 'goalsConcededAvg', 'xgAvg', 'xgConcededAvg',
    'over25Pct', 'formLast5',
  ]
  for (const field of fields) {
    count++
    if (stats[field] !== undefined && stats[field] !== null) score++
  }
  return count > 0 ? score / count : 0.3
}

function computeFeatureQuality(homeStats: TeamStats | null, awayStats: TeamStats | null): number {
  const base = (computeDataQuality(homeStats) + computeDataQuality(awayStats)) / 2
  let penalty = 0

  const hasInconsistentShots = (stats: TeamStats | null): boolean => {
    if (!stats) return false
    const shots = stats.shotsAvg
    const shotsOnTarget = stats.shotsOnTargetAvg
    if (shots === undefined || shotsOnTarget === undefined) return false
    return shots <= 0 || shotsOnTarget > shots
  }

  if (hasInconsistentShots(homeStats)) penalty += 0.15
  if (hasInconsistentShots(awayStats)) penalty += 0.15

  return clamp01(base - penalty)
}

function formToPoints(form: string | undefined): number {
  if (!form) return 1.5
  const pts: Record<string, number> = { W: 3, D: 1, L: 0 }
  const chars = form.slice(0, 5).split('')
  if (!chars.length) return 1.5
  return chars.reduce((s, c) => s + (pts[c] ?? 0), 0) / chars.length
}

function formToPoints10(form: string | undefined): number {
  if (!form) return 1.5
  const pts: Record<string, number> = { W: 3, D: 1, L: 0 }
  const chars = form.slice(0, 10).split('')
  if (!chars.length) return 1.5
  return chars.reduce((s, c) => s + (pts[c] ?? 0), 0) / chars.length
}

function getFormRegression(stats: TeamStats | null): number {
  const pts5 = formToPoints(stats?.formLast5)
  const pts10 = formToPoints10(stats?.formLast10)
  return pts10 - pts5
}

function getRiskProfile(std: number | undefined): 'low' | 'medium' | 'high' {
  if (std === undefined) return 'medium'
  if (std < 0.8) return 'low'
  if (std < 1.4) return 'medium'
  return 'high'
}

function xgProxy(
  bigChances: number | undefined,
  shotsOnTarget: number | undefined,
  shots: number | undefined,
  goals: number | undefined
): number {
  const g = goals ?? 0
  if (bigChances !== undefined) {
    const remaining = Math.max((shots ?? bigChances * 2) - bigChances, 0)
    return bigChances * 0.6 + remaining * 0.1
  }
  const sot = shotsOnTarget ?? 0
  const s = shots ?? 0
  if (s > 0) return (sot / s) * g * 1.1
  return g
}

function buildMLFeatures(homeStats: TeamStats | null, awayStats: TeamStats | null, leagueName: string): MLFeatures {
  return {
    homeGoalsScoredAvg5: homeStats?.goalsScoredAvg ?? 1.5,
    homeGoalsConcededAvg5: homeStats?.goalsConcededAvg ?? 1.2,
    homeShotsAvg5: homeStats?.shotsAvg ?? 0,
    homeShotsOnTargetAvg5: homeStats?.shotsOnTargetAvg ?? 0,
    homeCornersAvg5: homeStats?.cornersAvg ?? 0,
    homeCardsAvg5: homeStats?.cardsAvg ?? 0,
    homeXgProxyAvg5: homeStats?.xgAvg ?? xgProxy(homeStats?.bigChancesCreatedAvg, homeStats?.shotsOnTargetAvg, homeStats?.shotsAvg, homeStats?.goalsScoredAvg),
    homeFormPts5: formToPoints(homeStats?.formLast5),
    awayGoalsScoredAvg5: awayStats?.goalsScoredAvg ?? 1.2,
    awayGoalsConcededAvg5: awayStats?.goalsConcededAvg ?? 1.5,
    awayShotsAvg5: awayStats?.shotsAvg ?? 0,
    awayShotsOnTargetAvg5: awayStats?.shotsOnTargetAvg ?? 0,
    awayCornersAvg5: awayStats?.cornersAvg ?? 0,
    awayCardsAvg5: awayStats?.cardsAvg ?? 0,
    awayXgProxyAvg5: awayStats?.xgAvg ?? xgProxy(awayStats?.bigChancesCreatedAvg, awayStats?.shotsOnTargetAvg, awayStats?.shotsAvg, awayStats?.goalsScoredAvg),
    awayFormPts5: formToPoints(awayStats?.formLast5),
    leagueId: LEAGUE_ID_MAP[leagueName] ?? 5,
  }
}

function blend1x2(
  ml: Pick<Probabilities, 'homeWin' | 'draw' | 'awayWin'>,
  baseline: Pick<Probabilities, 'homeWin' | 'draw' | 'awayWin'>,
  featureQuality: number,
  ensembleEnabled: boolean
): Pick<Probabilities, 'homeWin' | 'draw' | 'awayWin'> {
  if (!ensembleEnabled) return normalizeThreeWay(ml.homeWin, ml.draw, ml.awayWin)

  let mlWeight = 0.5
  if (featureQuality >= 0.75) mlWeight = 0.6
  else if (featureQuality < 0.55) mlWeight = 0.35

  const baseWeight = 1 - mlWeight
  return normalizeThreeWay(
    ml.homeWin * mlWeight + baseline.homeWin * baseWeight,
    ml.draw * mlWeight + baseline.draw * baseWeight,
    ml.awayWin * mlWeight + baseline.awayWin * baseWeight
  )
}

function generateSignals(
  probabilities: Probabilities,
  homeStats: TeamStats | null,
  awayStats: TeamStats | null,
  modelSource: 'ml' | 'poisson',
  options: {
    baseline: Pick<Probabilities, 'homeWin' | 'draw' | 'awayWin'>
    featureQuality: number
    guardrailsEnabled: boolean
    qualityGateEnabled: boolean
    marketEdgeAvailable: boolean
  }
): GenerateSignalsResult {
  const signals: SignalInput[] = []
  const guardrails: string[] = []

  const homeQuality = computeDataQuality(homeStats)
  const awayQuality = computeDataQuality(awayStats)
  const avgQuality = (homeQuality + awayQuality) / 2
  const sourceBoost = modelSource === 'ml' ? 1.1 : 1.0

  const homeRisk = getRiskProfile(homeStats?.goalsConcededStd)
  const awayRisk = getRiskProfile(awayStats?.goalsConcededStd)
  const riskMultiplier =
    homeRisk === 'high' && awayRisk === 'high' ? 0.85
      : homeRisk === 'low' && awayRisk === 'low' ? 1.1 : 1

  if (avgQuality < 0.45) {
    guardrails.push('hard_filter_low_data_quality')
    return { signals, guardrails, noBetReason: 'low_data_quality' }
  }

  if (options.qualityGateEnabled && options.featureQuality < 0.4) {
    guardrails.push('hard_filter_low_feature_quality')
    return { signals, guardrails, noBetReason: 'low_feature_quality' }
  }

  const homeRegression = getFormRegression(homeStats)
  const awayRegression = getFormRegression(awayStats)

  if (probabilities.over25 > 0.55) {
    signals.push({
      market: 'over25',
      recommendation: 'back',
      probability: probabilities.over25,
      confidence: Math.min(0.7 * avgQuality * sourceBoost * riskMultiplier, 1),
    })
  }

  if (probabilities.under25 > 0.55 && probabilities.over25 <= 0.55) {
    const underRiskBoost = homeRisk === 'low' && awayRisk === 'low' ? 1.15 : riskMultiplier
    signals.push({
      market: 'under25',
      recommendation: 'back',
      probability: probabilities.under25,
      confidence: Math.min(0.65 * avgQuality * sourceBoost * underRiskBoost, 1),
    })
  }

  if (probabilities.homeWin > 0.55) {
    const homeWinBoost = awayRegression > 0.5 ? 1.08 : 1
    signals.push({
      market: 'backHome',
      recommendation: 'back',
      probability: probabilities.homeWin,
      confidence: Math.min(0.7 * homeQuality * sourceBoost * homeWinBoost, 1),
    })
  }

  if (probabilities.awayWin > 0.52) {
    const awayWinBoost = homeRegression > 0.5 ? 1.08 : 1
    signals.push({
      market: 'backAway',
      recommendation: 'back',
      probability: probabilities.awayWin,
      confidence: Math.min(0.65 * awayQuality * sourceBoost * awayWinBoost, 1),
    })
  }

  const layHomeProb = 1 - probabilities.homeWin
  const layAwayProb = 1 - probabilities.awayWin
  const layHomeConf = Math.min(0.7 * awayQuality * sourceBoost * riskMultiplier, 1)
  const layAwayConf = Math.min(0.7 * homeQuality * sourceBoost * riskMultiplier, 1)

  let allowLayHome = true
  let allowLayAway = true

  if (options.qualityGateEnabled && options.featureQuality < 0.55) {
    allowLayHome = false
    allowLayAway = false
    guardrails.push('low_feature_quality_blocks_lay')
  }

  if (options.guardrailsEnabled) {
    if (options.baseline.homeWin >= 0.55 && probabilities.homeWin >= 0.35) {
      allowLayHome = false
      guardrails.push('block_lay_home_clear_home_favorite')
    }
    if (options.baseline.awayWin >= 0.55 && probabilities.awayWin >= 0.35) {
      allowLayAway = false
      guardrails.push('block_lay_away_clear_away_favorite')
    }
  }

  if (allowLayHome && allowLayAway && layHomeProb > 0.65 && layAwayProb > 0.65) {
    if (layHomeConf >= layAwayConf) {
      signals.push({ market: 'layHome', recommendation: 'lay', probability: layHomeProb, confidence: layHomeConf })
    } else {
      signals.push({ market: 'layAway', recommendation: 'lay', probability: layAwayProb, confidence: layAwayConf })
    }
  } else {
    if (allowLayHome && layHomeProb > 0.65) {
      signals.push({ market: 'layHome', recommendation: 'lay', probability: layHomeProb, confidence: layHomeConf })
    }
    if (allowLayAway && layAwayProb > 0.65) {
      signals.push({ market: 'layAway', recommendation: 'lay', probability: layAwayProb, confidence: layAwayConf })
    }
  }

  if (!options.marketEdgeAvailable) {
    guardrails.push('market_edge_unavailable')
  }

  return { signals, guardrails }
}

export async function analyzeGame(gameId: string): Promise<void> {
  console.log(`[analysis] Analyzing game ${gameId}`)

  const game = getGameById(gameId)
  if (!game) {
    console.error(`[analysis] Game not found: ${gameId}`)
    return
  }

  const { home: homeStats, away: awayStats } = getTeamStats(gameId)
  const homeQuality = computeDataQuality(homeStats)
  const awayQuality = computeDataQuality(awayStats)
  const avgQuality = (homeQuality + awayQuality) / 2
  const featureQuality = computeFeatureQuality(homeStats, awayStats)

  const ensembleEnabled = boolEnv('SIGNAL_ENSEMBLE_ENABLED', true)
  const guardrailsEnabled = boolEnv('SIGNAL_GUARDRAILS_ENABLED', true)
  const qualityGateEnabled = boolEnv('SIGNAL_FEATURE_QUALITY_GATE_ENABLED', true)
  const tfDecisionEnabled = boolEnv('TF_DECISION_ENABLED', false)

  let modelSource: 'ml' | 'poisson' = 'poisson'
  let mlProbs: Pick<Probabilities, 'homeWin' | 'draw' | 'awayWin'> | null = null
  let tfShadow: {
    available: boolean
    homeWin: number
    draw: number
    awayWin: number
    over25: number
    under25: number
  } | null = null

  const absentImpactPlayers = getAbsentHighImpactPlayers(gameId)
  let lambdaHomeBoost = 1.0
  let lambdaAwayBoost = 1.0
  for (const player of absentImpactPlayers) {
    const isDefensive = !player.position || ['D', 'G', 'GK', 'CB', 'LB', 'RB', 'WB'].includes(player.position)
    if (isDefensive) {
      const boost = 1 + player.impactScore * 0.5
      if (player.side === 'home') lambdaAwayBoost = Math.max(lambdaAwayBoost, boost)
      else lambdaHomeBoost = Math.max(lambdaHomeBoost, boost)
    }
  }
  if (absentImpactPlayers.length > 0) {
    console.log(`[analysis] Applying player impact adjustments for ${game.homeTeam} vs ${game.awayTeam}: homex${lambdaHomeBoost.toFixed(2)} awayx${lambdaAwayBoost.toFixed(2)}`)
  }

  const baselineHomeGoals = (homeStats?.goalsScoredAvg ?? 1.5) * lambdaHomeBoost
  const baselineAwayGoals = (awayStats?.goalsScoredAvg ?? 1.2) * lambdaAwayBoost
  const baselineMatrix = buildScoreMatrix(baselineHomeGoals, baselineAwayGoals)
  const baselineProbabilities = computeProbabilities(baselineMatrix)
  let probabilities: Probabilities = baselineProbabilities

  if (isLoaded()) {
    try {
      const features = buildMLFeatures(homeStats, awayStats, game.league)
      const mlResult = await mlPredict(features)

      if (mlResult) {
        mlProbs = {
          homeWin: mlResult.homeWin,
          draw: mlResult.draw,
          awayWin: mlResult.awayWin,
        }

        const final1x2 = blend1x2(mlProbs, baselineProbabilities, featureQuality, ensembleEnabled)

        const adjLambdaHome = mlResult.lambdaHome * lambdaHomeBoost
        const adjLambdaAway = mlResult.lambdaAway * lambdaAwayBoost
        const matrix = buildScoreMatrix(adjLambdaHome, adjLambdaAway)
        const poissonMarkets = computeProbabilities(matrix)

        probabilities = {
          homeWin: final1x2.homeWin,
          draw: final1x2.draw,
          awayWin: final1x2.awayWin,
          over25: poissonMarkets.over25,
          under25: poissonMarkets.under25,
        }
        tfShadow = {
          available: true,
          homeWin: probabilities.homeWin,
          draw: probabilities.draw,
          awayWin: probabilities.awayWin,
          over25: probabilities.over25,
          under25: probabilities.under25,
        }
        if (tfDecisionEnabled) {
          modelSource = 'ml'
          console.log(`[analysis] TF decision enabled for ${game.homeTeam} vs ${game.awayTeam}`)
        } else {
          probabilities = baselineProbabilities
          modelSource = 'poisson'
          console.log(`[analysis] TF running in shadow mode for ${game.homeTeam} vs ${game.awayTeam}`)
        }
      } else {
        throw new Error('ML returned null')
      }
    } catch (err) {
      console.warn(`[analysis] ML failed, falling back to Poisson: ${err}`)
      modelSource = 'poisson'
    }
  }

  if (modelSource === 'poisson') probabilities = baselineProbabilities

  console.log(`[analysis] [${modelSource}] Probabilities for ${game.homeTeam} vs ${game.awayTeam}:`, probabilities)

  const { signals, guardrails, noBetReason } = generateSignals(probabilities, homeStats, awayStats, modelSource, {
    baseline: {
      homeWin: baselineProbabilities.homeWin,
      draw: baselineProbabilities.draw,
      awayWin: baselineProbabilities.awayWin,
    },
    featureQuality,
    guardrailsEnabled,
    qualityGateEnabled,
    marketEdgeAvailable: false,
  })
  console.log(`[analysis] Generated ${signals.length} signals`)

  clearSignalsForGame(gameId, false)
  for (const signal of signals) {
    upsertSignal({ gameId, ...signal, postLineup: false })
  }

  upsertSignalDecisionDebug({
    gameId,
    modelSource,
    homeQuality,
    awayQuality,
    avgQuality,
    featureQualityScore: featureQuality,
    pMlHome: mlProbs?.homeWin,
    pMlDraw: mlProbs?.draw,
    pMlAway: mlProbs?.awayWin,
    pBaseHome: baselineProbabilities.homeWin,
    pBaseDraw: baselineProbabilities.draw,
    pBaseAway: baselineProbabilities.awayWin,
    pFinalHome: probabilities.homeWin,
    pFinalDraw: probabilities.draw,
    pFinalAway: probabilities.awayWin,
    guardrails,
    meta: {
      ensembleEnabled,
      guardrailsEnabled,
      qualityGateEnabled,
      tfDecisionEnabled,
      tfShadow,
      lambdaHomeBoost,
      lambdaAwayBoost,
      noBet: signals.length === 0,
      noBetReason,
    },
  })

  if (process.env.OPENAI_API_KEY) {
    try {
      const news = getNewsByGameId(gameId)
      const prompt = buildAnalysisPrompt(game, homeStats, awayStats, probabilities, news)
      const report = await generateReport(prompt)
      upsertAnalysis(gameId, report)
      console.log(`[analysis] Report generated for game ${gameId}`)
    } catch (err) {
      console.error(`[analysis] Failed to generate OpenAI report for game ${gameId}:`, err)
    }
  }
}

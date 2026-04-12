import { Router, Request, Response, NextFunction } from 'express'
import { getSignals, getSignalsByGameId, getAnalysis, getNewsByGameId, getSignalDecisionDebug } from '../../db/queries/signals'
import { getGameById, getTeamStats } from '../../db/queries/games'
import type { GameAnalysis } from '../../types/index'

const router = Router()

// GET /signals
router.get('/', (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const market = _req.query.market as string | undefined
    const minConfidenceStr = _req.query.minConfidence as string | undefined
    const postLineupStr = _req.query.postLineup as string | undefined

    const minConfidence = minConfidenceStr !== undefined ? parseFloat(minConfidenceStr) : undefined
    const postLineup = postLineupStr !== undefined ? postLineupStr === 'true' : undefined

    const signals = getSignals({ market, minConfidence, postLineup })
    res.json(signals)
  } catch (err) {
    next(err)
  }
})

// GET /signals/analysis/:gameId
router.get('/analysis/:gameId', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const gameId = Array.isArray(req.params.gameId) ? req.params.gameId[0] : req.params.gameId

    const game = getGameById(gameId)
    if (!game) {
      res.status(404).json({ error: { message: 'Game not found', status: 404 } })
      return
    }

    const signals = getSignalsByGameId(gameId)
    const { home: homeStats, away: awayStats } = getTeamStats(gameId)
    const analysis = getAnalysis(gameId)
    const news = getNewsByGameId(gameId)

    const gameAnalysis: GameAnalysis = {
      gameId: gameId,
      game,
      signals,
      homeStats,
      awayStats,
      report: analysis?.report ?? null,
      reportGeneratedAt: analysis?.generatedAt ?? null,
      news,
    }

    res.json(gameAnalysis)
  } catch (err) {
    next(err)
  }
})

// GET /signals/debug/:gameId
router.get('/debug/:gameId', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const gameId = Array.isArray(req.params.gameId) ? req.params.gameId[0] : req.params.gameId
    const game = getGameById(gameId)
    if (!game) {
      res.status(404).json({ error: { message: 'Game not found', status: 404 } })
      return
    }

    const debug = getSignalDecisionDebug(gameId)
    if (!debug) {
      res.status(404).json({ error: { message: 'Signal debug not found', status: 404 } })
      return
    }

    res.json(debug)
  } catch (err) {
    next(err)
  }
})

export default router

import { Router, Request, Response, NextFunction } from 'express'
import { getGameById, getGamesToday, getGameMeta } from '../../db/queries/games'
import { getNewsByGameId, getSignalsByGameId } from '../../db/queries/signals'
import { getCoachSuggestion, getCoachMetrics } from '../../services/coach'
import axios from 'axios'

const router = Router()

const SCRAPER_URL = process.env.SCRAPER_URL ?? 'http://localhost:8001'

// In-memory image cache: teamId → { data, contentType, cachedAt }
const imageCache = new Map<number, { data: Buffer; contentType: string; cachedAt: number }>()
const IMAGE_CACHE_TTL = 24 * 60 * 60 * 1000 // 24h

/** Helper: resolve sofascoreId from DB, fallback to /matches/today round-trip */
async function resolveSofascoreId(gameId: string): Promise<number | null> {
  const meta = getGameMeta(gameId)
  if (meta?.sofascoreId) return meta.sofascoreId
  // fallback
  try {
    const r = await axios.get(`${SCRAPER_URL}/matches/today`, { timeout: 10000 })
    const m = (r.data.matches || []).find((x: { id: string; sofascoreId: number }) => x.id === gameId)
    return m?.sofascoreId ?? null
  } catch {
    return null
  }
}

// GET /games/today
router.get('/today', (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const league = _req.query.league as string | undefined
    const hasSignalQuery = _req.query.hasSignal as string | undefined
    const hasSignal = hasSignalQuery !== undefined ? hasSignalQuery === 'true' : undefined

    const games = getGamesToday({ league, hasSignal })
    res.json(games)
  } catch (err) {
    next(err)
  }
})

// GET /games/coach/metrics
router.get('/coach/metrics', (_req: Request, res: Response): void => {
  res.json(getCoachMetrics())
})

// GET /games/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const gameId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const game = getGameById(gameId)
    if (!game) {
      res.status(404).json({ error: { message: 'Game not found', status: 404 } })
      return
    }
    res.json(game)
  } catch (err) {
    next(err)
  }
})

/** Generic proxy helper for match endpoints */
async function proxyMatch(
  req: Request, res: Response, next: NextFunction,
  endpoint: string,
  fallback: unknown = { available: false }
): Promise<void> {
  try {
    const gameId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    if (!getGameById(gameId)) {
      res.status(404).json({ error: { message: 'Game not found', status: 404 } }); return
    }
    const sofascoreId = await resolveSofascoreId(gameId)
    if (!sofascoreId) { res.json(fallback); return }
    try {
      const r = await axios.get(`${SCRAPER_URL}/match/${sofascoreId}/${endpoint}`, { timeout: 15000 })
      res.json(r.data)
    } catch { res.json(fallback) }
  } catch (err) { next(err) }
}

// GET /games/:id/live
router.get('/:id/live', (req, res, next) =>
  proxyMatch(req, res, next, 'live', {
    status: 'unavailable',
    minute: 'LIVE',
    clock: { minute: 0, display: 'LIVE', phase: 'unknown', period: null, source: 'fallback' },
    homeScore: 0,
    awayScore: 0,
  }))

// GET /games/:id/live-stats
router.get('/:id/live-stats', (req, res, next) =>
  proxyMatch(req, res, next, 'stats', { stats: [] }))

// GET /games/:id/shotmap
router.get('/:id/shotmap', (req, res, next) =>
  proxyMatch(req, res, next, 'shotmap', { shotmap: [] }))

// GET /games/:id/win-probability
router.get('/:id/win-probability', (req, res, next) =>
  proxyMatch(req, res, next, 'win-probability', { available: false }))

// GET /games/:id/votes
router.get('/:id/votes', (req, res, next) =>
  proxyMatch(req, res, next, 'votes', {}))

// GET /games/:id/odds
router.get('/:id/odds', (req, res, next) =>
  proxyMatch(req, res, next, 'odds-all', { markets: [] }))

// GET /games/:id/managers
router.get('/:id/managers', (req, res, next) =>
  proxyMatch(req, res, next, 'managers', {}))

// GET /games/:id/commentary
router.get('/:id/commentary', (req, res, next) =>
  proxyMatch(req, res, next, 'commentary', { comments: [] }))

// GET /games/:id/highlights
router.get('/:id/highlights', (req, res, next) =>
  proxyMatch(req, res, next, 'highlights', { highlights: [] }))

// GET /games/:id/team-streaks
router.get('/:id/team-streaks', (req, res, next) =>
  proxyMatch(req, res, next, 'team-streaks', {}))

// GET /games/:id/h2h-events
router.get('/:id/h2h-events', (req, res, next) =>
  proxyMatch(req, res, next, 'h2h-events', { events: [] }))

// GET /games/:id/best-players
router.get('/:id/best-players', (req, res, next) =>
  proxyMatch(req, res, next, 'best-players', { home: [], away: [], motm: null }))

// GET /games/:id/graph (attack momentum)
router.get('/:id/graph', (req, res, next) =>
  proxyMatch(req, res, next, 'graph', { points: [] }))

// GET /games/:id/squad/:side (home or away)
router.get('/:id/squad/:side', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gameId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const side = req.params.side as 'home' | 'away'
    const meta = getGameMeta(gameId)
    if (!meta) { res.status(404).json({ error: { message: 'Game not found', status: 404 } }); return }
    const teamId = side === 'home' ? meta.homeTeamId : meta.awayTeamId
    if (!teamId) { res.json({ players: [] }); return }
    try {
      const r = await axios.get(`${SCRAPER_URL}/team/${teamId}/squad`, { timeout: 15000 })
      res.json(r.data)
    } catch { res.json({ players: [] }) }
  } catch (err) { next(err) }
})

// GET /games/:id/news
router.get('/:id/news', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const gameId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const news = getNewsByGameId(gameId)
    res.json(news)
  } catch (err) {
    next(err)
  }
})

// GET /games/:id/coach?enabled=true
router.get('/:id/coach', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const gameId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id
    const game = getGameById(gameId)
    if (!game) {
      res.status(404).json({ error: { message: 'Game not found', status: 404 } })
      return
    }

    const enabledRaw = Array.isArray(req.query.enabled) ? req.query.enabled[0] : req.query.enabled
    const enabled = String(enabledRaw ?? 'false').toLowerCase() === 'true'

    if (!enabled) {
      const coach = await getCoachSuggestion({
        gameId,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        league: game.league,
        enabled,
        liveData: { status: game.status, minute: 0, homeScore: game.homeScore ?? 0, awayScore: game.awayScore ?? 0 },
        liveStats: [],
        graphPoints: [],
        news: [],
        signals: [],
      })
      res.json(coach)
      return
    }

    const [news, signals] = [getNewsByGameId(gameId), getSignalsByGameId(gameId)]
    const sofascoreId = await resolveSofascoreId(gameId)

    const liveFallback = {
      status: 'unavailable',
      minute: 'LIVE',
      clock: { minute: 0, display: 'LIVE', phase: 'unknown', period: null, source: 'fallback' },
      homeScore: 0,
      awayScore: 0,
    }
    const statsFallback = { stats: [] as { name: string; home: string | number | null; away: string | number | null }[] }
    const graphFallback = { points: [] as { minute: number; value: number }[] }

    let liveData = liveFallback
    let liveStats = statsFallback
    let graphData = graphFallback

    if (sofascoreId) {
      const [liveRes, statsRes, graphRes] = await Promise.all([
        axios.get(`${SCRAPER_URL}/match/${sofascoreId}/live`, { timeout: 15000 }).catch(() => ({ data: liveFallback })),
        axios.get(`${SCRAPER_URL}/match/${sofascoreId}/stats`, { timeout: 15000 }).catch(() => ({ data: statsFallback })),
        axios.get(`${SCRAPER_URL}/match/${sofascoreId}/graph`, { timeout: 15000 }).catch(() => ({ data: graphFallback })),
      ])

      liveData = liveRes.data
      liveStats = statsRes.data
      graphData = graphRes.data
    }

    const coach = await getCoachSuggestion({
      gameId,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      league: game.league,
      enabled,
      liveData,
      liveStats: Array.isArray(liveStats.stats) ? liveStats.stats : [],
      graphPoints: Array.isArray(graphData.points)
        ? graphData.points
            .filter((p): p is { minute: number; value: number } => Number.isFinite(p?.minute) && Number.isFinite(p?.value))
            .map((p) => ({ minute: Number(p.minute), value: Number(p.value) }))
        : [],
      news,
      signals,
    })

    res.json(coach)
  } catch (err) {
    next(err)
  }
})

// GET /games/team-image/:teamId — proxy Sofascore team badge with 24h cache
router.get('/team-image/:teamId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const teamId = parseInt(Array.isArray(req.params.teamId) ? req.params.teamId[0] : req.params.teamId, 10)
    if (isNaN(teamId)) { res.status(400).json({ error: 'Invalid teamId' }); return }

    const cached = imageCache.get(teamId)
    if (cached && Date.now() - cached.cachedAt < IMAGE_CACHE_TTL) {
      res.setHeader('Content-Type', cached.contentType)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.send(cached.data)
      return
    }

    const r = await axios.get(`${SCRAPER_URL}/team/${teamId}/image`, {
      responseType: 'arraybuffer',
      timeout: 10000,
    })
    const data = Buffer.from(r.data)
    const contentType = r.headers['content-type'] ?? 'image/png'
    imageCache.set(teamId, { data, contentType, cachedAt: Date.now() })
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(data)
  } catch {
    res.status(404).end()
  }
})

export default router

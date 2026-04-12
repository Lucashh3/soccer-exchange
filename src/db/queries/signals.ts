import { getDb } from '../schema'
import type {
  Signal,
  NewsItem,
  MarketType,
  Recommendation,
  SignalRow,
  NewsRow,
  AnalysisRow,
  GameRow,
  SignalDecisionDebug,
  SignalDecisionRow,
} from '../../types/index'

function rowToSignal(row: SignalRow & GameRow): Signal {
  return {
    id: row.id,
    gameId: row.game_id,
    game: {
      homeTeam: row.home_team,
      awayTeam: row.away_team,
      league: row.league,
      country: row.country,
      kickoffAt: row.kickoff_at,
    },
    market: row.market as MarketType,
    recommendation: row.recommendation as Recommendation,
    probability: row.probability,
    confidence: row.confidence,
    ev: row.ev ?? undefined,
    postLineup: row.post_lineup === 1,
    generatedAt: row.generated_at,
  }
}

function rowToNewsItem(row: NewsRow): NewsItem {
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    summary: row.summary ?? undefined,
    url: row.url ?? undefined,
    publishedAt: row.published_at ?? undefined,
  }
}

function rowToSignalDecisionDebug(row: SignalDecisionRow): SignalDecisionDebug {
  return {
    gameId: row.game_id,
    modelSource: row.model_source as SignalDecisionDebug['modelSource'],
    homeQuality: row.home_quality,
    awayQuality: row.away_quality,
    avgQuality: row.avg_quality,
    featureQualityScore: row.feature_quality_score,
    pMlHome: row.p_ml_home ?? undefined,
    pMlDraw: row.p_ml_draw ?? undefined,
    pMlAway: row.p_ml_away ?? undefined,
    pBaseHome: row.p_base_home,
    pBaseDraw: row.p_base_draw,
    pBaseAway: row.p_base_away,
    pFinalHome: row.p_final_home,
    pFinalDraw: row.p_final_draw,
    pFinalAway: row.p_final_away,
    guardrails: row.guardrails ? row.guardrails.split(',').filter(Boolean) : [],
    meta: row.meta_json ? JSON.parse(row.meta_json) as Record<string, unknown> : undefined,
    generatedAt: row.generated_at,
  }
}

export interface GetSignalsFilters {
  market?: string
  minConfidence?: number
  postLineup?: boolean
}

// Mercados mutuamente exclusivos: salvar um remove o oposto
const MUTEX_MARKETS: Partial<Record<MarketType, MarketType>> = {
  over25:   'under25',
  under25:  'over25',
  layHome:  'backHome',
  backHome: 'layHome',
  layAway:  'backAway',
  backAway: 'layAway',
}

export function upsertSignal(signal: {
  gameId: string
  market: MarketType
  recommendation: Recommendation
  probability: number
  confidence: number
  ev?: number
  postLineup: boolean
}): void {
  const db = getDb()

  // Remove mercado oposto se existir
  const opposite = MUTEX_MARKETS[signal.market]
  if (opposite) {
    db.prepare(`DELETE FROM signals WHERE game_id = ? AND market = ?`).run(signal.gameId, opposite)
  }

  db.prepare(`
    INSERT INTO signals (game_id, market, recommendation, probability, confidence, ev, post_lineup, generated_at)
    VALUES (@gameId, @market, @recommendation, @probability, @confidence, @ev, @postLineup, datetime('now'))
    ON CONFLICT(game_id, market) DO UPDATE SET
      recommendation = excluded.recommendation,
      probability    = excluded.probability,
      confidence     = excluded.confidence,
      ev             = excluded.ev,
      post_lineup    = excluded.post_lineup,
      generated_at   = excluded.generated_at
  `).run({
    gameId: signal.gameId,
    market: signal.market,
    recommendation: signal.recommendation,
    probability: signal.probability,
    confidence: signal.confidence,
    ev: signal.ev ?? null,
    postLineup: signal.postLineup ? 1 : 0,
  })
}

export function clearSignalsForGame(gameId: string, postLineup: boolean = false): void {
  const db = getDb()
  db.prepare(`DELETE FROM signals WHERE game_id = ? AND post_lineup = ?`).run(gameId, postLineup ? 1 : 0)
}

export function getSignals(filters?: GetSignalsFilters): Signal[] {
  const db = getDb()
  let query = `
    SELECT s.*, g.home_team, g.away_team, g.league, g.country, g.kickoff_at
    FROM signals s
    JOIN games g ON g.id = s.game_id
    WHERE 1=1
  `
  const params: (string | number)[] = []

  if (filters?.market) {
    query += ` AND s.market = ?`
    params.push(filters.market)
  }

  if (filters?.minConfidence !== undefined) {
    query += ` AND s.confidence >= ?`
    params.push(filters.minConfidence)
  }

  if (filters?.postLineup !== undefined) {
    query += ` AND s.post_lineup = ?`
    params.push(filters.postLineup ? 1 : 0)
  }

  query += ` ORDER BY s.confidence DESC, s.generated_at DESC`

  const rows = db.prepare(query).all(...params) as (SignalRow & GameRow)[]
  return rows.map(rowToSignal)
}

export function getSignalsByGameId(gameId: string): Signal[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT s.*, g.home_team, g.away_team, g.league, g.country, g.kickoff_at
    FROM signals s
    JOIN games g ON g.id = s.game_id
    WHERE s.game_id = ?
    ORDER BY s.confidence DESC
  `).all(gameId) as (SignalRow & GameRow)[]
  return rows.map(rowToSignal)
}

export function upsertAnalysis(gameId: string, report: string): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO analyses (game_id, report, generated_at)
    VALUES (@gameId, @report, datetime('now'))
    ON CONFLICT(game_id) DO UPDATE SET
      report = excluded.report,
      generated_at = excluded.generated_at
  `).run({ gameId, report })
}

export function getAnalysis(gameId: string): { report: string; generatedAt: string } | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT * FROM analyses WHERE game_id = ?
  `).get(gameId) as AnalysisRow | undefined

  if (!row) return null
  return { report: row.report, generatedAt: row.generated_at }
}

export function upsertNews(gameId: string, newsItems: Omit<NewsItem, 'id'>[]): void {
  const db = getDb()

  // Delete existing news for this game before re-inserting
  db.prepare(`DELETE FROM news WHERE game_id = ?`).run(gameId)

  const insert = db.prepare(`
    INSERT INTO news (game_id, source, title, summary, url, published_at)
    VALUES (@gameId, @source, @title, @summary, @url, @publishedAt)
  `)

  const insertMany = db.transaction((items: Omit<NewsItem, 'id'>[]) => {
    for (const item of items) {
      insert.run({
        gameId,
        source: item.source,
        title: item.title,
        summary: item.summary ?? null,
        url: item.url ?? null,
        publishedAt: item.publishedAt ?? null,
      })
    }
  })

  insertMany(newsItems)
}

export function getNewsByGameId(gameId: string): NewsItem[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM news WHERE game_id = ? ORDER BY published_at DESC
  `).all(gameId) as NewsRow[]
  return rows.map(rowToNewsItem)
}

export function upsertSignalDecisionDebug(debug: {
  gameId: string
  modelSource: 'ml' | 'poisson'
  homeQuality: number
  awayQuality: number
  avgQuality: number
  featureQualityScore: number
  pMlHome?: number
  pMlDraw?: number
  pMlAway?: number
  pBaseHome: number
  pBaseDraw: number
  pBaseAway: number
  pFinalHome: number
  pFinalDraw: number
  pFinalAway: number
  guardrails: string[]
  meta?: Record<string, unknown>
}): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO signal_decisions (
      game_id, model_source, home_quality, away_quality, avg_quality, feature_quality_score,
      p_ml_home, p_ml_draw, p_ml_away,
      p_base_home, p_base_draw, p_base_away,
      p_final_home, p_final_draw, p_final_away,
      guardrails, meta_json, generated_at
    ) VALUES (
      @gameId, @modelSource, @homeQuality, @awayQuality, @avgQuality, @featureQualityScore,
      @pMlHome, @pMlDraw, @pMlAway,
      @pBaseHome, @pBaseDraw, @pBaseAway,
      @pFinalHome, @pFinalDraw, @pFinalAway,
      @guardrails, @metaJson, datetime('now')
    )
    ON CONFLICT(game_id) DO UPDATE SET
      model_source = excluded.model_source,
      home_quality = excluded.home_quality,
      away_quality = excluded.away_quality,
      avg_quality = excluded.avg_quality,
      feature_quality_score = excluded.feature_quality_score,
      p_ml_home = excluded.p_ml_home,
      p_ml_draw = excluded.p_ml_draw,
      p_ml_away = excluded.p_ml_away,
      p_base_home = excluded.p_base_home,
      p_base_draw = excluded.p_base_draw,
      p_base_away = excluded.p_base_away,
      p_final_home = excluded.p_final_home,
      p_final_draw = excluded.p_final_draw,
      p_final_away = excluded.p_final_away,
      guardrails = excluded.guardrails,
      meta_json = excluded.meta_json,
      generated_at = excluded.generated_at
  `).run({
    gameId: debug.gameId,
    modelSource: debug.modelSource,
    homeQuality: debug.homeQuality,
    awayQuality: debug.awayQuality,
    avgQuality: debug.avgQuality,
    featureQualityScore: debug.featureQualityScore,
    pMlHome: debug.pMlHome ?? null,
    pMlDraw: debug.pMlDraw ?? null,
    pMlAway: debug.pMlAway ?? null,
    pBaseHome: debug.pBaseHome,
    pBaseDraw: debug.pBaseDraw,
    pBaseAway: debug.pBaseAway,
    pFinalHome: debug.pFinalHome,
    pFinalDraw: debug.pFinalDraw,
    pFinalAway: debug.pFinalAway,
    guardrails: debug.guardrails.join(','),
    metaJson: debug.meta ? JSON.stringify(debug.meta) : null,
  })
}

export function getSignalDecisionDebug(gameId: string): SignalDecisionDebug | null {
  const db = getDb()
  const row = db.prepare(`SELECT * FROM signal_decisions WHERE game_id = ?`).get(gameId) as SignalDecisionRow | undefined
  if (!row) return null
  return rowToSignalDecisionDebug(row)
}

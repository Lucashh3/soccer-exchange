import { getDb } from '../schema'
import type { Game, TeamStats, GameRow, TeamStatsRow, ScrapedGame } from '../../types/index'

function rowToTeamStats(row: TeamStatsRow): TeamStats {
  return {
    xgAvg: row.xg_avg ?? undefined,
    xgConcededAvg: row.xg_conceded_avg ?? undefined,
    goalsScoredAvg: row.goals_scored_avg ?? undefined,
    goalsConcededAvg: row.goals_conceded_avg ?? undefined,
    over25Pct: row.over25_pct ?? undefined,
    under25Pct: row.under25_pct ?? undefined,
    formLast5: row.form_last5 ?? undefined,
    formLast10: row.form_last10 ?? undefined,
    cornersAvg: row.corners_avg ?? undefined,
    cardsAvg: row.cards_avg ?? undefined,
    possessionAvg: row.possession_avg ?? undefined,
    shotsAvg: row.shots_avg ?? undefined,
    shotsOnTargetAvg: row.shots_on_target_avg ?? undefined,
    goalsScoredStd: row.goals_scored_std ?? undefined,
    goalsConcededStd: row.goals_conceded_std ?? undefined,
    xgStd: row.xg_std ?? undefined,
    bigChancesCreatedAvg: row.big_chances_created_avg ?? undefined,
    bigChancesConcededAvg: row.big_chances_conceded_avg ?? undefined,
  }
}

function rowToGame(
  row: GameRow & { signal_count?: number; top_market?: string; top_prob?: number; top_conf?: number }
): Game {
  return {
    id: row.id,
    sofascoreId: row.sofascore_id ?? null,
    exchangeEventId: row.exchange_event_id ?? null,
    exchangeUrl: row.exchange_url ?? null,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    homeTeamId: row.home_team_id ?? null,
    awayTeamId: row.away_team_id ?? null,
    tournamentId: row.tournament_id ?? null,
    league: row.league,
    country: row.country,
    kickoffAt: row.kickoff_at,
    status: row.status,
    homeScore: row.home_score ?? null,
    awayScore: row.away_score ?? null,
    signalCount: row.signal_count ?? 0,
    topSignal: row.top_market
      ? {
          market: row.top_market as Game['topSignal'] extends { market: infer M } ? M : never,
          probability: row.top_prob ?? 0,
          confidence: row.top_conf ?? 0,
        }
      : null,
  }
}

export function upsertGame(game: ScrapedGame): void {
  const db = getDb()
  const status = game.status ?? 'scheduled'
  db.prepare(`
    INSERT INTO games (id, sofascore_id, exchange_event_id, exchange_url, home_team, away_team, home_team_id, away_team_id, tournament_id, league, country, kickoff_at, status, home_score, away_score)
    VALUES (@id, @sofascoreId, @exchangeEventId, @exchangeUrl, @homeTeam, @awayTeam, @homeTeamId, @awayTeamId, @tournamentId, @league, @country, @kickoffAt, @status, @homeScore, @awayScore)
    ON CONFLICT(id) DO UPDATE SET
      sofascore_id = excluded.sofascore_id,
      exchange_event_id = CASE WHEN excluded.exchange_event_id IS NOT NULL THEN excluded.exchange_event_id ELSE games.exchange_event_id END,
      exchange_url = CASE WHEN excluded.exchange_url IS NOT NULL THEN excluded.exchange_url ELSE games.exchange_url END,
      home_team = excluded.home_team,
      away_team = excluded.away_team,
      home_team_id = excluded.home_team_id,
      away_team_id = excluded.away_team_id,
      tournament_id = excluded.tournament_id,
      league = excluded.league,
      country = excluded.country,
      kickoff_at = excluded.kickoff_at,
      status = excluded.status,
      home_score = CASE WHEN excluded.home_score IS NOT NULL THEN excluded.home_score ELSE games.home_score END,
      away_score = CASE WHEN excluded.away_score IS NOT NULL THEN excluded.away_score ELSE games.away_score END
  `).run({
    id: game.id,
    sofascoreId: game.sofascoreId ?? null,
    exchangeEventId: game.exchangeEventId ?? null,
    exchangeUrl: game.exchangeUrl ?? null,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeTeamId: game.homeTeamId ? Number(game.homeTeamId) : null,
    awayTeamId: game.awayTeamId ? Number(game.awayTeamId) : null,
    tournamentId: game.tournamentId ? Number(game.tournamentId) : null,
    league: game.league,
    country: game.country,
    kickoffAt: game.kickoffAt,
    status,
    homeScore: (game as any).homeScore ?? null,
    awayScore: (game as any).awayScore ?? null,
  })
}

export function updateGameExchangeLink(gameId: string, exchangeEventId: string | null, exchangeUrl: string | null): void {
  const db = getDb()
  db.prepare(`
    UPDATE games
    SET exchange_event_id = ?, exchange_url = ?
    WHERE id = ?
  `).run(exchangeEventId, exchangeUrl, gameId)
}

export function getGameMeta(id: string): { sofascoreId: number | null; homeTeamId: number | null; awayTeamId: number | null; exchangeEventId: string | null } | null {
  const db = getDb()
  const row = db.prepare(`SELECT sofascore_id, home_team_id, away_team_id, exchange_event_id FROM games WHERE id = ?`).get(id) as
    | { sofascore_id: number | null; home_team_id: number | null; away_team_id: number | null; exchange_event_id: string | null }
    | undefined
  if (!row) return null
  return { sofascoreId: row.sofascore_id, homeTeamId: row.home_team_id, awayTeamId: row.away_team_id, exchangeEventId: row.exchange_event_id ?? null }
}

export function getGameById(id: string): Game | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT
      g.*,
      COUNT(s.id) AS signal_count,
      (SELECT market FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_market,
      (SELECT probability FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_prob,
      (SELECT confidence FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_conf
    FROM games g
    LEFT JOIN signals s ON s.game_id = g.id
    WHERE g.id = ?
    GROUP BY g.id
  `).get(id) as (GameRow & { signal_count: number; top_market: string; top_prob: number; top_conf: number }) | undefined

  if (!row) return null
  return rowToGame(row)
}

export interface GetGamesTodayFilters {
  league?: string
  hasSignal?: boolean
}

export function getGamesToday(filters?: GetGamesTodayFilters): Game[] {
  const db = getDb()

  const today = new Date()
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  let query = `
    SELECT
      g.*,
      COUNT(s.id) AS signal_count,
      (SELECT market FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_market,
      (SELECT probability FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_prob,
      (SELECT confidence FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_conf
    FROM games g
    LEFT JOIN signals s ON s.game_id = g.id
    WHERE g.kickoff_at >= ? AND g.kickoff_at < ?
  `

  const params: (string | number)[] = [startOfDay, endOfDay]

  if (filters?.league) {
    query += ` AND g.league = ?`
    params.push(filters.league)
  }

  query += ` GROUP BY g.id`

  if (filters?.hasSignal) {
    query += ` HAVING signal_count > 0`
  }

  query += ` ORDER BY g.kickoff_at ASC`

  const rows = db.prepare(query).all(...params) as (GameRow & {
    signal_count: number
    top_market: string
    top_prob: number
    top_conf: number
  })[]

  if (rows.length === 0) return []

  // Batch-fetch all team stats in one query (2 queries total, not N+1)
  const ids = rows.map(r => r.id)
  const placeholders = ids.map(() => '?').join(',')
  const statsRows = db.prepare(
    `SELECT * FROM team_stats WHERE game_id IN (${placeholders})`
  ).all(...ids) as TeamStatsRow[]

  const statsMap: Record<string, { home: TeamStats | null; away: TeamStats | null }> = {}
  for (const sr of statsRows) {
    if (!statsMap[sr.game_id]) statsMap[sr.game_id] = { home: null, away: null }
    if (sr.side === 'home') statsMap[sr.game_id].home = rowToTeamStats(sr)
    else statsMap[sr.game_id].away = rowToTeamStats(sr)
  }

  return rows.map(row => ({
    ...rowToGame(row),
    homeStats: statsMap[row.id]?.home ?? null,
    awayStats: statsMap[row.id]?.away ?? null,
  }))
}

export function getGamesByDate(date: string): Game[] {
  const db = getDb()
  const start = `${date}T00:00:00.000Z`
  const end   = `${date}T23:59:59.999Z`
  const rows = db.prepare(`
    SELECT
      g.*,
      COUNT(s.id) AS signal_count,
      (SELECT market FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_market,
      (SELECT probability FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_prob,
      (SELECT confidence FROM signals WHERE game_id = g.id ORDER BY confidence DESC LIMIT 1) AS top_conf
    FROM games g
    LEFT JOIN signals s ON s.game_id = g.id
    WHERE g.kickoff_at >= ? AND g.kickoff_at <= ?
    GROUP BY g.id
    ORDER BY g.kickoff_at ASC
  `).all(start, end) as (GameRow & { signal_count: number; top_market: string; top_prob: number; top_conf: number })[]
  return rows.map(rowToGame)
}

export function upsertTeamStats(
  gameId: string,
  side: 'home' | 'away',
  stats: TeamStats
): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO team_stats (
      game_id, side, xg_avg, xg_conceded_avg, goals_scored_avg, goals_conceded_avg,
      over25_pct, under25_pct, form_last5, form_last10,
      corners_avg, cards_avg, possession_avg, shots_avg, shots_on_target_avg,
      goals_scored_std, goals_conceded_std, xg_std, big_chances_created_avg, big_chances_conceded_avg,
      updated_at
    ) VALUES (
      @gameId, @side, @xgAvg, @xgConcededAvg, @goalsScoredAvg, @goalsConcededAvg,
      @over25Pct, @under25Pct, @formLast5, @formLast10,
      @cornersAvg, @cardsAvg, @possessionAvg, @shotsAvg, @shotsOnTargetAvg,
      @goalsScoredStd, @goalsConcededStd, @xgStd, @bigChancesCreatedAvg, @bigChancesConcededAvg,
      datetime('now')
    )
    ON CONFLICT(game_id, side) DO UPDATE SET
      xg_avg = excluded.xg_avg,
      xg_conceded_avg = excluded.xg_conceded_avg,
      goals_scored_avg = excluded.goals_scored_avg,
      goals_conceded_avg = excluded.goals_conceded_avg,
      over25_pct = excluded.over25_pct,
      under25_pct = excluded.under25_pct,
      form_last5 = excluded.form_last5,
      form_last10 = excluded.form_last10,
      corners_avg = excluded.corners_avg,
      cards_avg = excluded.cards_avg,
      possession_avg = excluded.possession_avg,
      shots_avg = excluded.shots_avg,
      shots_on_target_avg = excluded.shots_on_target_avg,
      goals_scored_std = excluded.goals_scored_std,
      goals_conceded_std = excluded.goals_conceded_std,
      xg_std = excluded.xg_std,
      big_chances_created_avg = excluded.big_chances_created_avg,
      big_chances_conceded_avg = excluded.big_chances_conceded_avg,
      updated_at = excluded.updated_at
  `).run({
    gameId,
    side,
    xgAvg: stats.xgAvg ?? null,
    xgConcededAvg: stats.xgConcededAvg ?? null,
    goalsScoredAvg: stats.goalsScoredAvg ?? null,
    goalsConcededAvg: stats.goalsConcededAvg ?? null,
    over25Pct: stats.over25Pct ?? null,
    under25Pct: stats.under25Pct ?? null,
    formLast5: stats.formLast5 ?? null,
    formLast10: stats.formLast10 ?? null,
    cornersAvg: stats.cornersAvg ?? null,
    cardsAvg: stats.cardsAvg ?? null,
    possessionAvg: stats.possessionAvg ?? null,
    shotsAvg: stats.shotsAvg ?? null,
    shotsOnTargetAvg: stats.shotsOnTargetAvg ?? null,
    goalsScoredStd: stats.goalsScoredStd ?? null,
    goalsConcededStd: stats.goalsConcededStd ?? null,
    xgStd: stats.xgStd ?? null,
    bigChancesCreatedAvg: stats.bigChancesCreatedAvg ?? null,
    bigChancesConcededAvg: stats.bigChancesConcededAvg ?? null,
  })
}

export function getTeamStats(gameId: string): { home: TeamStats | null; away: TeamStats | null } {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM team_stats WHERE game_id = ?
  `).all(gameId) as TeamStatsRow[]

  const homeRow = rows.find((r) => r.side === 'home')
  const awayRow = rows.find((r) => r.side === 'away')

  return {
    home: homeRow ? rowToTeamStats(homeRow) : null,
    away: awayRow ? rowToTeamStats(awayRow) : null,
  }
}

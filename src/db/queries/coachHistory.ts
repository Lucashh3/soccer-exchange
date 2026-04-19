import { getDb } from '../schema'

export interface CoachHistoryItem {
  id: number
  date: string
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  market: string
  rationale: string
  outcome: 'won' | 'lost' | 'void' | null
  evaluatedAt: string | null
}

export interface CoachDaySummary {
  date: string
  total: number
  won: number
  lost: number
  void: number
  pending: number
  accuracy: number | null
}

export function insertCoachSuggestion(item: {
  date: string
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  market: string
  rationale: string
}): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO coach_suggestion_history (date, game_id, home_team, away_team, league, market, rationale)
    VALUES (@date, @gameId, @homeTeam, @awayTeam, @league, @market, @rationale)
    ON CONFLICT(date, game_id, market) DO NOTHING
  `).run(item)
}

export function updateSuggestionOutcome(gameId: string, market: string, outcome: 'won' | 'lost' | 'void'): void {
  const db = getDb()
  db.prepare(`
    UPDATE coach_suggestion_history
    SET outcome = @outcome, evaluated_at = datetime('now')
    WHERE game_id = @gameId AND market = @market AND outcome IS NULL
  `).run({ gameId, market, outcome })
}

export function getPendingSuggestionsByGame(gameId: string): CoachHistoryItem[] {
  const db = getDb()
  return (db.prepare(`
    SELECT * FROM coach_suggestion_history
    WHERE game_id = ? AND outcome IS NULL
  `).all(gameId) as any[]).map(rowToItem)
}

export function getCoachHistorySummary(months = 3): CoachDaySummary[] {
  const db = getDb()
  const since = new Date()
  since.setMonth(since.getMonth() - months)
  const sinceStr = since.toISOString().slice(0, 10)

  const rows = db.prepare(`
    SELECT
      date,
      COUNT(*) as total,
      SUM(CASE WHEN outcome = 'won'  THEN 1 ELSE 0 END) as won,
      SUM(CASE WHEN outcome = 'lost' THEN 1 ELSE 0 END) as lost,
      SUM(CASE WHEN outcome = 'void' THEN 1 ELSE 0 END) as void,
      SUM(CASE WHEN outcome IS NULL  THEN 1 ELSE 0 END) as pending
    FROM coach_suggestion_history
    WHERE date >= ?
    GROUP BY date
    ORDER BY date DESC
  `).all(sinceStr) as { date: string; total: number; won: number; lost: number; void: number; pending: number }[]

  return rows.map(r => {
    const evaluated = r.won + r.lost
    return {
      date: r.date,
      total: r.total,
      won: r.won,
      lost: r.lost,
      void: r.void,
      pending: r.pending,
      accuracy: evaluated > 0 ? Math.round((r.won / evaluated) * 100) : null,
    }
  })
}

export function getCoachHistoryByDate(date: string): CoachHistoryItem[] {
  const db = getDb()
  return (db.prepare(`
    SELECT * FROM coach_suggestion_history WHERE date = ? ORDER BY id ASC
  `).all(date) as any[]).map(rowToItem)
}

function rowToItem(r: any): CoachHistoryItem {
  return {
    id: r.id,
    date: r.date,
    gameId: r.game_id,
    homeTeam: r.home_team,
    awayTeam: r.away_team,
    league: r.league,
    market: r.market,
    rationale: r.rationale,
    outcome: r.outcome ?? null,
    evaluatedAt: r.evaluated_at ?? null,
  }
}

import { getDb } from '../schema'

export function upsertOutcome(gameId: string, homeScore: number, awayScore: number): void {
  const db = getDb()
  const result = homeScore > awayScore ? 'H' : homeScore < awayScore ? 'A' : 'D'
  db.prepare(`
    INSERT INTO game_outcomes (game_id, home_score, away_score, result)
    VALUES (@gameId, @homeScore, @awayScore, @result)
    ON CONFLICT(game_id) DO UPDATE SET
      home_score  = excluded.home_score,
      away_score  = excluded.away_score,
      result      = excluded.result,
      recorded_at = excluded.recorded_at
  `).run({ gameId, homeScore, awayScore, result })
}

export function getOutcomes(): { gameId: string; homeScore: number; awayScore: number; result: string; recordedAt: string }[] {
  const db = getDb()
  return (db.prepare(`SELECT game_id, home_score, away_score, result, recorded_at FROM game_outcomes ORDER BY recorded_at DESC`).all() as {
    game_id: string; home_score: number; away_score: number; result: string; recorded_at: string
  }[]).map(r => ({
    gameId: r.game_id,
    homeScore: r.home_score,
    awayScore: r.away_score,
    result: r.result,
    recordedAt: r.recorded_at,
  }))
}

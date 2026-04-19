import { getDb } from '../schema'

export interface LiveSnapshotInput {
  gameId: string
  minute: number
  homeGoals: number
  awayGoals: number
  homeAttacksPerMin: number | null
  homeDangerousPerMin: number | null
  homeLast5min: number | null
  homeLast10min: number | null
  homeTrend: string | null
  awayAttacksPerMin: number | null
  awayDangerousPerMin: number | null
  awayLast5min: number | null
  awayLast10min: number | null
  awayTrend: string | null
  priorHomeWin: number | null
  priorDraw: number | null
  priorAwayWin: number | null
  priorLambdaHome: number | null
  priorLambdaAway: number | null
}

export function insertLiveSnapshot(data: LiveSnapshotInput): void {
  const db = getDb()
  db.prepare(`
    INSERT INTO live_snapshots (
      game_id, minute, home_goals, away_goals,
      home_attacks_per_min, home_dangerous_per_min, home_last5min, home_last10min, home_trend,
      away_attacks_per_min, away_dangerous_per_min, away_last5min, away_last10min, away_trend,
      prior_home_win, prior_draw, prior_away_win, prior_lambda_home, prior_lambda_away
    ) VALUES (
      @gameId, @minute, @homeGoals, @awayGoals,
      @homeAttacksPerMin, @homeDangerousPerMin, @homeLast5min, @homeLast10min, @homeTrend,
      @awayAttacksPerMin, @awayDangerousPerMin, @awayLast5min, @awayLast10min, @awayTrend,
      @priorHomeWin, @priorDraw, @priorAwayWin, @priorLambdaHome, @priorLambdaAway
    )
  `).run(data)
}

export function labelSnapshotsWithResult(gameId: string, homeScore: number, awayScore: number): void {
  const result = homeScore > awayScore ? 'H' : homeScore < awayScore ? 'A' : 'D'
  getDb().prepare(`
    UPDATE live_snapshots SET final_result = ? WHERE game_id = ? AND final_result IS NULL
  `).run(result, gameId)
}

export function getLiveSnapshotCount(gameId: string): number {
  const row = getDb().prepare(`SELECT COUNT(*) as cnt FROM live_snapshots WHERE game_id = ?`).get(gameId) as { cnt: number }
  return row.cnt
}

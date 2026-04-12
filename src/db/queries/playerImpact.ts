import { getDb } from '../schema'
import type { LineupRow } from '../../types/index'

interface PlayerImpactRow {
  id: number
  team_id: number
  player_name: string
  position: string | null
  games_with: number
  games_without: number
  clean_sheets_with: number
  clean_sheets_without: number
  goals_conceded_with_sum: number
  goals_conceded_without_sum: number
  impact_score: number | null
}

export interface AbsentImpactPlayer {
  playerName: string
  teamId: number
  side: 'home' | 'away'
  impactScore: number
  position: string | null
}

function calcImpactScore(row: PlayerImpactRow): number {
  const csWithRate = row.games_with > 0 ? row.clean_sheets_with / row.games_with : 0
  const csWithoutRate = row.games_without > 0 ? row.clean_sheets_without / row.games_without : 0
  return csWithRate - csWithoutRate
}

export function updatePlayerImpact(gameId: string): void {
  const db = getDb()

  const gameRow = db.prepare(`
    SELECT g.home_team_id, g.away_team_id, o.home_score, o.away_score
    FROM games g JOIN game_outcomes o ON o.game_id = g.id
    WHERE g.id = ?
  `).get(gameId) as {
    home_team_id: number | null
    away_team_id: number | null
    home_score: number
    away_score: number
  } | undefined

  if (!gameRow || gameRow.home_team_id == null || gameRow.away_team_id == null) return

  const lineups = db.prepare(
    `SELECT player_name, position, side, is_starter, is_absent FROM lineups WHERE game_id = ?`
  ).all(gameId) as Pick<LineupRow, 'player_name' | 'position' | 'side' | 'is_starter' | 'is_absent'>[]

  if (lineups.length === 0) return

  const homeTeamId = gameRow.home_team_id
  const awayTeamId = gameRow.away_team_id
  const homeCleanSheet = gameRow.away_score === 0 ? 1 : 0
  const awayCleanSheet = gameRow.home_score === 0 ? 1 : 0

  const insertIgnore = db.prepare(
    `INSERT OR IGNORE INTO player_impact (team_id, player_name, position) VALUES (?, ?, ?)`
  )

  const addWith = db.prepare(`
    UPDATE player_impact SET
      games_with = games_with + 1,
      clean_sheets_with = clean_sheets_with + ?,
      goals_conceded_with_sum = goals_conceded_with_sum + ?,
      updated_at = datetime('now')
    WHERE team_id = ? AND player_name = ?
  `)

  const addWithout = db.prepare(`
    UPDATE player_impact SET
      games_without = games_without + 1,
      clean_sheets_without = clean_sheets_without + ?,
      goals_conceded_without_sum = goals_conceded_without_sum + ?,
      updated_at = datetime('now')
    WHERE team_id = ? AND player_name = ?
  `)

  for (const player of lineups) {
    const teamId = player.side === 'home' ? homeTeamId : awayTeamId
    const goalsConceded = player.side === 'home' ? gameRow.away_score : gameRow.home_score
    const cleanSheet = player.side === 'home' ? homeCleanSheet : awayCleanSheet

    insertIgnore.run(teamId, player.player_name, player.position)

    if (player.is_absent) {
      addWithout.run(cleanSheet, goalsConceded, teamId, player.player_name)
    } else if (player.is_starter) {
      addWith.run(cleanSheet, goalsConceded, teamId, player.player_name)
    }
  }

  // Recalculate impact_score for affected players with enough data
  const affected = db.prepare(`
    SELECT * FROM player_impact
    WHERE team_id IN (?, ?) AND games_with >= 3 AND games_without >= 1
  `).all(homeTeamId, awayTeamId) as PlayerImpactRow[]

  const updateScore = db.prepare(`UPDATE player_impact SET impact_score = ? WHERE id = ?`)
  for (const p of affected) {
    updateScore.run(calcImpactScore(p), p.id)
  }
}

export function getAbsentHighImpactPlayers(gameId: string): AbsentImpactPlayer[] {
  const db = getDb()

  const absentPlayers = db.prepare(`
    SELECT l.player_name, l.side, l.position,
           CASE WHEN l.side = 'home' THEN g.home_team_id ELSE g.away_team_id END AS team_id
    FROM lineups l JOIN games g ON g.id = l.game_id
    WHERE l.game_id = ? AND l.is_absent = 1
  `).all(gameId) as Array<{
    player_name: string
    side: 'home' | 'away'
    position: string | null
    team_id: number
  }>

  const result: AbsentImpactPlayer[] = []
  for (const p of absentPlayers) {
    const impact = db.prepare(`
      SELECT impact_score FROM player_impact
      WHERE team_id = ? AND player_name = ? AND impact_score > 0.15
    `).get(p.team_id, p.player_name) as { impact_score: number } | undefined

    if (impact) {
      result.push({
        playerName: p.player_name,
        teamId: p.team_id,
        side: p.side,
        impactScore: impact.impact_score,
        position: p.position,
      })
    }
  }
  return result
}

import { generateSuggestionsForDate } from './coachSuggestions'
import { evaluateCoachSuggestions } from './coachEvaluator'
import { getGamesByDate } from '../db/queries/games'
import { getPendingSuggestionsByGame } from '../db/queries/coachHistory'

function dateRange(from: string, to: string): string[] {
  const dates: string[] = []
  const cur = new Date(from + 'T12:00:00Z')
  const end = new Date(to + 'T12:00:00Z')
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export interface BackfillResult {
  date: string
  suggestionsGenerated: number
  evaluated: number
  skipped: boolean
}

export async function runCoachBackfill(fromDate: string, toDate: string): Promise<BackfillResult[]> {
  const dates = dateRange(fromDate, toDate)
  const results: BackfillResult[] = []

  console.log(`[coachBackfill] Starting backfill for ${dates.length} days (${fromDate} → ${toDate})`)

  for (const date of dates) {
    console.log(`[coachBackfill] Processing ${date}...`)

    // Generate suggestions for the day (skips if already exists — ON CONFLICT DO NOTHING)
    const suggestions = await generateSuggestionsForDate(date)
    console.log(`[coachBackfill] ${date}: ${suggestions.length} suggestions generated`)

    // Evaluate outcomes for all finished games on this date
    const games = getGamesByDate(date)
    const finishedGames = games.filter(
      (g) => (g.status === 'finished' || g.status === 'completed') && g.homeScore != null && g.awayScore != null
    )

    let evaluated = 0
    for (const game of finishedGames) {
      const pending = getPendingSuggestionsByGame(game.id)
      if (pending.length === 0) continue
      evaluateCoachSuggestions(game.id, game.homeScore!, game.awayScore!)
      evaluated += pending.length
    }

    console.log(`[coachBackfill] ${date}: ${evaluated} outcomes evaluated`)
    results.push({ date, suggestionsGenerated: suggestions.length, evaluated, skipped: false })
  }

  console.log(`[coachBackfill] Done.`)
  return results
}

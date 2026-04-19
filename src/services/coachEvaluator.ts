import { getPendingSuggestionsByGame, updateSuggestionOutcome } from '../db/queries/coachHistory'

function evaluateOutcome(
  market: string,
  homeScore: number,
  awayScore: number,
): 'won' | 'lost' | 'void' {
  const totalGoals = homeScore + awayScore
  switch (market) {
    case 'backHome': return homeScore > awayScore ? 'won' : 'lost'
    case 'backAway': return awayScore > homeScore ? 'won' : 'lost'
    case 'layHome':  return homeScore < awayScore || homeScore === awayScore ? 'won' : 'lost'
    case 'layAway':  return awayScore < homeScore || homeScore === awayScore ? 'won' : 'lost'
    case 'over25':   return totalGoals > 2.5 ? 'won' : 'lost'
    case 'under25':  return totalGoals < 2.5 ? 'won' : 'lost'
    default:         return 'void'
  }
}

export function evaluateCoachSuggestions(gameId: string, homeScore: number, awayScore: number): void {
  const pending = getPendingSuggestionsByGame(gameId)
  if (pending.length === 0) return

  for (const item of pending) {
    const outcome = evaluateOutcome(item.market, homeScore, awayScore)
    updateSuggestionOutcome(gameId, item.market, outcome)
  }

  console.log(`[coachEvaluator] Evaluated ${pending.length} suggestions for game ${gameId}`)
}

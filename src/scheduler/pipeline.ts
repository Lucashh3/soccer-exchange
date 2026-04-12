import { scrapeGamesToday, scrapeTeamStats } from '../scrapers/sofascore'
import { upsertGame, upsertTeamStats, getGamesToday, updateGameExchangeLink } from '../db/queries/games'
import { analyzeGame } from '../analysis/index'
import { scrapeGoogleNews } from '../scrapers/news/googlenews'
import { upsertNews } from '../db/queries/signals'
import { upsertOutcome } from '../db/queries/outcomes'
import { updatePlayerImpact } from '../db/queries/playerImpact'
import { matchGamesToExchange } from '../scrapers/bolsaExchange'
import type { ScrapedGame } from '../types/index'

async function syncExchangeLinks(games: ScrapedGame[]): Promise<void> {
  try {
    const matches = await matchGamesToExchange(
      games.map((game) => ({
        id: game.id,
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        kickoffAt: game.kickoffAt,
      }))
    )

    const byGameId = new Map(matches.map((match) => [match.gameId, match]))
    for (const game of games) {
      const mapped = byGameId.get(game.id)
      updateGameExchangeLink(game.id, mapped?.eventId ?? null, mapped?.url ?? null)
    }

    console.log(`[pipeline] Exchange links synced: ${matches.length}/${games.length}`)
  } catch (err) {
    console.error('[pipeline] Failed to sync exchange links:', err)
  }
}

export async function runMorningPipeline(): Promise<void> {
  console.log('[pipeline] Starting morning pipeline...')

  // 1. Scrape games from Sofascore via Python microservice
  let scrapedGames
  try {
    scrapedGames = await scrapeGamesToday()
    console.log(`[pipeline] Scraped ${scrapedGames.length} games`)
  } catch (err) {
    console.error('[pipeline] Failed to scrape games:', err)
    return
  }

  // 2. Save games to DB
  for (const game of scrapedGames) {
    upsertGame(game)
  }

  await syncExchangeLinks(scrapedGames)

  // 3. Scrape team stats (sequential to respect Python's Semaphore(1))
  for (const game of scrapedGames) {
    try {
      console.log(`[pipeline] Fetching stats for ${game.homeTeam} vs ${game.awayTeam}`)

      const homeStats = await scrapeTeamStats(String(game.homeTeamId))
      upsertTeamStats(game.id, 'home', homeStats)

      const awayStats = await scrapeTeamStats(String(game.awayTeamId))
      upsertTeamStats(game.id, 'away', awayStats)
    } catch (err) {
      console.error(`[pipeline] Failed to scrape stats for game ${game.id}:`, err)
    }
  }

  // 4. Scrape news
  for (const game of scrapedGames) {
    try {
      const allNews = await scrapeGoogleNews(game.homeTeam, game.awayTeam, game.country)
      if (allNews.length > 0) {
        upsertNews(game.id, allNews)
        console.log(`[pipeline] Saved ${allNews.length} news items for game ${game.id}`)
      }
    } catch (err) {
      console.error(`[pipeline] Failed to scrape news for game ${game.id}:`, err)
    }
  }

  // 5. Run analysis for each game
  for (const game of scrapedGames) {
    try {
      await analyzeGame(game.id)
    } catch (err) {
      console.error(`[pipeline] Failed to analyze game ${game.id}:`, err)
    }
  }

  console.log('[pipeline] Morning pipeline completed')
}

export async function runStatusUpdate(): Promise<void> {
  console.log('[pipeline] Updating game statuses...')
  try {
    const scrapedGames = await scrapeGamesToday()
    let outcomesRecorded = 0
    for (const game of scrapedGames) {
      upsertGame(game)
      // Record outcome when game is finished and scores are available
      const g = game as typeof game & { homeScore?: number; awayScore?: number }
      if (game.status === 'finished' && g.homeScore != null && g.awayScore != null) {
        upsertOutcome(game.id, g.homeScore, g.awayScore)
        updatePlayerImpact(game.id)
        outcomesRecorded++
      }
    }
    await syncExchangeLinks(scrapedGames)
    console.log(`[pipeline] Updated status for ${scrapedGames.length} games, ${outcomesRecorded} outcomes recorded`)
  } catch (err) {
    console.error('[pipeline] Failed to update game statuses:', err)
  }
}

export async function runLineupCheck(): Promise<void> {
  console.log('[pipeline] Running lineup check...')

  const now = new Date()
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

  // Get all today's games
  const games = getGamesToday()

  // Filter games kicking off within the next 2 hours
  const upcomingGames = games.filter((game) => {
    const kickoff = new Date(game.kickoffAt)
    return kickoff > now && kickoff <= twoHoursFromNow
  })

  if (upcomingGames.length === 0) {
    console.log('[pipeline] No games upcoming in the next 2 hours')
    return
  }

  console.log(`[pipeline] Found ${upcomingGames.length} games within 2 hours, re-running analysis...`)

  for (const game of upcomingGames) {
    try {
      await analyzeGame(game.id)
    } catch (err) {
      console.error(`[pipeline] Lineup check analysis failed for game ${game.id}:`, err)
    }
  }

  console.log('[pipeline] Lineup check completed')
}

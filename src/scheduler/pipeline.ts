import { scrapeGamesToday, scrapeTeamStats } from '../scrapers/sofascore'
import { upsertGame, upsertTeamStats, getGamesToday, updateGameExchangeLink } from '../db/queries/games'
import { analyzeGame } from '../analysis/index'
import { scrapeGoogleNews } from '../scrapers/news/googlenews'
import { upsertNews } from '../db/queries/signals'
import { upsertOutcome } from '../db/queries/outcomes'
import { updatePlayerImpact } from '../db/queries/playerImpact'
import { matchGamesToExchange } from '../scrapers/bolsaExchange'
import { pollAttackStats, getAttackStats } from '../services/attackTracker'
import { insertLiveSnapshot, labelSnapshotsWithResult } from '../db/queries/liveSnapshots'
import { getDb } from '../db/schema'
import { evaluateCoachSuggestions } from '../services/coachEvaluator'
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
        evaluateCoachSuggestions(game.id, g.homeScore, g.awayScore)
        labelSnapshotsWithResult(game.id, g.homeScore, g.awayScore)
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

export async function runAttackPoll(): Promise<void> {
  const liveGames = getGamesToday().filter(g => {
    const s = g.status ?? ''
    return ['inprogress', 'live', 'halftime', 'pause'].includes(s) && g.exchangeEventId
  })
  if (!liveGames.length) return

  await Promise.allSettled(liveGames.map(async g => {
    const s = g.status ?? ''
    let minute = 0
    if (s === 'halftime') minute = 45
    else if (s === 'finished') minute = 90
    else if (g.kickoffAt) minute = Math.min(Math.floor((Date.now() - new Date(g.kickoffAt).getTime()) / 60000), 90)

    await pollAttackStats(g.exchangeEventId!, minute)

    try {
      const attackStats = getAttackStats(g.exchangeEventId!)
      if (!attackStats) return

      // Buscar probs pré-jogo do signal_decisions
      const priorRow = getDb().prepare(
        `SELECT p_final_home, p_final_draw, p_final_away, meta_json FROM signal_decisions WHERE game_id = ?`
      ).get(g.id) as { p_final_home: number; p_final_draw: number; p_final_away: number; meta_json: string | null } | undefined

      let priorLambdaHome: number | null = null
      let priorLambdaAway: number | null = null
      if (priorRow?.meta_json) {
        try {
          const meta = JSON.parse(priorRow.meta_json)
          priorLambdaHome = meta?.tfShadow?.lambdaHome ?? null
          priorLambdaAway = meta?.tfShadow?.lambdaAway ?? null
        } catch { /* ignorar */ }
      }

      insertLiveSnapshot({
        gameId: g.id,
        minute,
        homeGoals: g.homeScore ?? 0,
        awayGoals: g.awayScore ?? 0,
        homeAttacksPerMin: attackStats.home.attacks.perMin,
        homeDangerousPerMin: attackStats.home.dangerous.perMin,
        homeLast5min: attackStats.home.attacks.last5min,
        homeLast10min: attackStats.home.attacks.last10min,
        homeTrend: attackStats.home.attacks.last5trend,
        awayAttacksPerMin: attackStats.away.attacks.perMin,
        awayDangerousPerMin: attackStats.away.dangerous.perMin,
        awayLast5min: attackStats.away.attacks.last5min,
        awayLast10min: attackStats.away.attacks.last10min,
        awayTrend: attackStats.away.attacks.last5trend,
        priorHomeWin: priorRow?.p_final_home ?? null,
        priorDraw: priorRow?.p_final_draw ?? null,
        priorAwayWin: priorRow?.p_final_away ?? null,
        priorLambdaHome,
        priorLambdaAway,
      })
    } catch (err) {
      console.error(`[pipeline] Failed to save live snapshot for game ${g.id}:`, err)
    }
  }))
}

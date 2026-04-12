import axios from 'axios'
import type { TeamStats, ScrapedGame } from '../types/index'
import { buildTeamStatsFromSofascore } from '../parsers/sofascoreParser'

const BASE_URL = process.env.SCRAPER_URL ?? 'http://localhost:8001'

export async function scrapeGamesToday(): Promise<ScrapedGame[]> {
  const response = await axios.get<{ matches: ScrapedGame[] }>(`${BASE_URL}/matches/today`, { timeout: 90000 })
  return response.data.matches
}

export async function scrapeTeamStats(
  teamId: string
): Promise<TeamStats> {
  console.log(`[sofascore] Fetching stats for team ${teamId}`)
  const response = await axios.get<{ stats: Record<string, unknown> }>(
    `${BASE_URL}/team/${teamId}/stats`,
    { timeout: 30000 }
  )
  return buildTeamStatsFromSofascore(response.data.stats)
}

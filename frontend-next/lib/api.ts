import type { Game, Signal, NewsItem, GameAnalysis, Health } from '@/types'
import type { PpmBlock, EntrySignal } from '@/lib/ppm'

const BASE = '/api'

async function get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(path, 'http://n')
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, String(v))
    })
  }
  const res = await fetch(`${BASE}${url.pathname}${url.search}`, { next: { revalidate: 0 } })
  if (!res.ok) throw new Error(`${res.status} ${path}`)
  return res.json()
}

export const fetchHealth = () => get<Health>('/health')

export const fetchGamesToday = (params?: { league?: string; hasSignal?: boolean }) =>
  get<Game[]>('/games', params)

export const fetchGame = (id: string) => get<Game>(`/game/${id}`)

export const fetchGameNews = (id: string) => get<NewsItem[]>(`/game/${id}/news`)

export const fetchSignals = (params?: {
  market?: string
  minConfidence?: number
  postLineup?: boolean
}) => get<Signal[]>('/signals', params)

export const fetchAnalysis = (gameId: string) => get<GameAnalysis>(`/signals/analysis/${gameId}`)

// ── New data endpoints ──────────────────────────────────────────────────────

export interface ShotmapEntry {
  player: { name: string; id: number }
  isHome: boolean
  shotType: string
  situation: string
  bodyPart: string
  playerCoordinates: { x: number; y: number }
  goalMouthCoordinates?: { x: number; y: number; z: number }
  xg: number
  xgot?: number
  time: number
  addedTime?: number
}

export interface OddsMarket {
  marketId: number
  marketName: string
  isLive: boolean
  suspended: boolean
  choices: { name: string; fractionalValue: string; initialFractionalValue?: string; winning?: boolean; change?: number }[]
}

export interface H2HEvent {
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  date: string
  tournament: string
}

export interface SquadPlayer {
  id: number
  name: string
  shortName: string
  position: string
  jerseyNumber: string
  height?: number
  dateOfBirth?: number
  marketValue?: number
  marketValueCurrency?: string
  country?: string
}

export interface BestPlayer { name: string; rating: string; position: string }

export const fetchShotmap       = (id: string) => get<{ shotmap: ShotmapEntry[] }>(`/game/${id}/shotmap`)
export const fetchWinProbability = (id: string) => get<Record<string, unknown>>(`/game/${id}/win-probability`)
export const fetchVotes          = (id: string) => get<Record<string, unknown>>(`/game/${id}/votes`)
export const fetchOdds           = (id: string) => get<{ markets: OddsMarket[] }>(`/game/${id}/odds`)
export const fetchManagers       = (id: string) => get<{ homeManager?: { name: string }; awayManager?: { name: string } }>(`/game/${id}/managers`)
export const fetchCommentary     = (id: string) => get<{ comments: { text: string; type: string; time: number; periodName?: string }[] }>(`/game/${id}/commentary`)
export const fetchHighlights     = (id: string) => get<{ highlights: { title: string; url: string; thumbnailUrl?: string; keyHighlight?: boolean }[] }>(`/game/${id}/highlights`)
export const fetchTeamStreaks    = (id: string) => get<Record<string, unknown>>(`/game/${id}/team-streaks`)
export const fetchH2HEvents      = (id: string) => get<{ events: H2HEvent[] }>(`/game/${id}/h2h-events`)
export const fetchBestPlayers    = (id: string) => get<{ home: BestPlayer[]; away: BestPlayer[]; motm: { name: string; rating: string } | null }>(`/game/${id}/best-players`)
export const fetchSquad          = (id: string, side: 'home' | 'away') => get<{ players: SquadPlayer[] }>(`/game/${id}/squad/${side}`)

export interface MomentumPoint { minute: number; value: number }
export const fetchGraph = (id: string) => get<{ points: MomentumPoint[]; periodTime?: number; periodCount?: number }>(`/game/${id}/graph`)

export interface PpmResponse { blocks: PpmBlock[]; signal: EntrySignal | null; currentMinute: number }
export const fetchPpm = (id: string) => get<PpmResponse>(`/game/${id}/ppm`)

export type CoachAction = 'entrar_back' | 'entrar_lay' | 'aguardar' | 'sair'

export interface CoachExposureGuidance {
  minMinutes: number
  maxMinutes: number
  reviewAtMinute: number
  urgency: 'baixa' | 'media' | 'alta'
  exitTriggers: string[]
}

export interface CoachResponse {
  status: 'disabled' | 'inactive' | 'ready'
  text: string
  action: CoachAction
  market: string | null
  side: 'home' | 'away' | 'neutral'
  confidence: number
  reasonCodes: string[]
  cachedAt: number
  fromCache: boolean
  contextUsed: {
    live: boolean
    ppm: boolean
    news: boolean
  }
  exposure: CoachExposureGuidance | null
}

export const fetchCoach = (id: string, enabled: boolean) =>
  get<CoachResponse>(`/game/${id}/coach`, { enabled })

export interface CoachSuggestionItem {
  gameId: string
  rationale: string
}

export interface CoachSuggestionsResponse {
  suggestions: CoachSuggestionItem[]
  generatedAt: number
  fromCache: boolean
}

export const fetchCoachSuggestions = () =>
  get<CoachSuggestionsResponse>('/coach/suggestions')

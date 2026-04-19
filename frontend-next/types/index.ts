export type MarketType =
  | 'over25' | 'under25' | 'lay00' | 'value'
  | 'backHome' | 'layHome' | 'backAway' | 'layAway'

export type Recommendation = 'back' | 'lay' | 'skip'

export interface TeamStats {
  xgAvg?: number
  xgConcededAvg?: number
  goalsScoredAvg?: number
  goalsConcededAvg?: number
  over25Pct?: number
  under25Pct?: number
  formLast5?: string
  formLast10?: string
  cornersAvg?: number
  cardsAvg?: number
  possessionAvg?: number
  shotsAvg?: number
  shotsOnTargetAvg?: number
}

export interface Signal {
  id: number
  gameId: string
  game: {
    homeTeam: string
    awayTeam: string
    league: string
    country: string
    kickoffAt: string
  }
  market: MarketType
  recommendation: Recommendation
  probability: number
  confidence: number
  ev?: number
  postLineup: boolean
  generatedAt: string
}

export interface Game {
  id: string
  exchangeEventId?: string | null
  exchangeUrl?: string | null
  homeTeam: string
  awayTeam: string
  homeTeamId?: number | null
  awayTeamId?: number | null
  league: string
  country: string
  kickoffAt: string
  status: string
  homeScore?: number | null
  awayScore?: number | null
  signalCount: number
  topSignal?: {
    market: MarketType
    probability: number
    confidence: number
  } | null
  homeStats?: TeamStats | null
  awayStats?: TeamStats | null
}

export interface NewsItem {
  id: number
  source: string
  title: string
  summary?: string
  url?: string
  publishedAt?: string
}

export interface GameAnalysis {
  gameId: string
  game: Game
  signals: Signal[]
  homeStats: TeamStats | null
  awayStats: TeamStats | null
  report: string | null
  reportGeneratedAt: string | null
  news: NewsItem[]
}

export interface Health {
  status: string
  db: string
  lastScrape: string | null
  gamesLoaded: number
  signalsGenerated: number
}

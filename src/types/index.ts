// Mirror of frontend types plus internal DB types

export type MarketType =
  | 'btts'
  | 'over25'
  | 'under25'
  | 'lay00'
  | 'value'
  | 'backHome'
  | 'layHome'
  | 'backAway'
  | 'layAway'

export type Recommendation = 'back' | 'lay' | 'skip'

export interface TeamStats {
  xgAvg?: number
  xgConcededAvg?: number
  goalsScoredAvg?: number
  goalsConcededAvg?: number
  bttsPct?: number
  over25Pct?: number
  under25Pct?: number
  formLast5?: string
  formLast10?: string
  cornersAvg?: number
  cardsAvg?: number
  possessionAvg?: number
  shotsAvg?: number
  shotsOnTargetAvg?: number
  goalsScoredStd?: number
  goalsConcededStd?: number
  xgStd?: number
  bigChancesCreatedAvg?: number
  bigChancesConcededAvg?: number
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
  sofascoreId?: number | null
  exchangeEventId?: string | null
  exchangeUrl?: string | null
  homeTeam: string
  awayTeam: string
  homeTeamId?: number | null
  awayTeamId?: number | null
  tournamentId?: number | null
  league: string
  country: string
  kickoffAt: string
  status: string
  homeScore?: number | null
  awayScore?: number | null
  signalCount: number
  topSignal?: { market: MarketType; probability: number; confidence: number } | null
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

// Internal DB row types

export interface GameRow {
  id: string
  sofascore_id: number | null
  exchange_event_id: string | null
  exchange_url: string | null
  home_team: string
  away_team: string
  home_team_id: number | null
  away_team_id: number | null
  tournament_id: number | null
  league: string
  country: string
  kickoff_at: string
  status: string
  home_score: number | null
  away_score: number | null
  created_at: string
}

export interface TeamStatsRow {
  id: number
  game_id: string
  side: 'home' | 'away'
  xg_avg: number | null
  xg_conceded_avg: number | null
  goals_scored_avg: number | null
  goals_conceded_avg: number | null
  btts_pct: number | null
  over25_pct: number | null
  under25_pct: number | null
  form_last5: string | null
  form_last10: string | null
  corners_avg: number | null
  cards_avg: number | null
  possession_avg: number | null
  shots_avg: number | null
  shots_on_target_avg: number | null
  goals_scored_std: number | null
  goals_conceded_std: number | null
  xg_std: number | null
  big_chances_created_avg: number | null
  big_chances_conceded_avg: number | null
  updated_at: string
}

export interface LineupRow {
  id: number
  game_id: string
  side: 'home' | 'away'
  player_name: string
  position: string | null
  is_starter: number
  is_absent: number
}

export interface NewsRow {
  id: number
  game_id: string
  source: string
  title: string
  summary: string | null
  url: string | null
  published_at: string | null
}

export interface SignalRow {
  id: number
  game_id: string
  market: string
  recommendation: string
  probability: number
  confidence: number
  ev: number | null
  post_lineup: number
  generated_at: string
}

export interface AnalysisRow {
  id: number
  game_id: string
  report: string
  generated_at: string
}

export interface SignalDecisionDebug {
  gameId: string
  modelSource: 'ml' | 'poisson'
  homeQuality: number
  awayQuality: number
  avgQuality: number
  featureQualityScore: number
  pMlHome?: number
  pMlDraw?: number
  pMlAway?: number
  pBaseHome: number
  pBaseDraw: number
  pBaseAway: number
  pFinalHome: number
  pFinalDraw: number
  pFinalAway: number
  guardrails: string[]
  meta?: Record<string, unknown>
  generatedAt: string
}

export interface SignalDecisionRow {
  game_id: string
  model_source: string
  home_quality: number
  away_quality: number
  avg_quality: number
  feature_quality_score: number
  p_ml_home: number | null
  p_ml_draw: number | null
  p_ml_away: number | null
  p_base_home: number
  p_base_draw: number
  p_base_away: number
  p_final_home: number
  p_final_draw: number
  p_final_away: number
  guardrails: string | null
  meta_json: string | null
  generated_at: string
}

export interface ScrapedGame {
  id: string
  exchangeEventId?: string | null
  exchangeUrl?: string | null
  homeTeam: string
  awayTeam: string
  league: string
  country: string
  kickoffAt: string
  homeTeamId: number | string
  awayTeamId: number | string
  tournamentId?: number | string
  leagueId?: string
  status?: string
  sofascoreId?: number
}

export interface Probabilities {
  homeWin: number
  draw: number
  awayWin: number
  btts: number
  over25: number
  under25: number
}

export interface LiveClock {
  minute: number
  display: string
  phase: string
  period?: number | null
  source?: string
}

export interface LiveMatchData {
  matchId?: number
  status: string
  minute?: string
  clock?: LiveClock
  homeScore: number
  awayScore: number
  events?: Array<{
    type: string
    class?: string
    minute?: number
    isHome?: boolean
    player?: string | null
    assist?: string | null
    homeScore?: number | null
    awayScore?: number | null
  }>
}

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

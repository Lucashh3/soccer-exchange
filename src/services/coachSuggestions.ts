import { generateReport } from '../llm'
import { getGamesToday, getTeamStats } from '../db/queries/games'
import { getSignalsByGameId, getNewsByGameId } from '../db/queries/signals'
import type { Game, TeamStats, Signal } from '../types/index'

export interface CoachSuggestionItem {
  gameId: string
  rationale: string
}

export interface CoachSuggestionsResponse {
  suggestions: CoachSuggestionItem[]
  generatedAt: number
  fromCache: boolean
}

const CACHE_TTL_MS = 60 * 60 * 1000 // 1h
const MIN_CONFIDENCE = 0.55
const DIRECTIONAL_MARKETS = new Set(['backHome', 'backAway', 'layHome', 'layAway', 'over25', 'under25', 'btts'])

let cache: { response: CoachSuggestionsResponse; cachedAt: number } | null = null

function formatStats(stats: TeamStats | null): string {
  if (!stats) return 'sem dados'
  const parts: string[] = []
  if (stats.xgAvg != null) parts.push(`xGatk=${stats.xgAvg.toFixed(2)}`)
  if (stats.xgConcededAvg != null) parts.push(`xGdef=${stats.xgConcededAvg.toFixed(2)}`)
  if (stats.formLast5) parts.push(`forma=${stats.formLast5}`)
  if (stats.goalsScoredStd != null) parts.push(`std=${stats.goalsScoredStd.toFixed(2)}`)
  if (stats.over25Pct != null) parts.push(`over25=${Math.round(stats.over25Pct * 100)}%`)
  return parts.join(' ') || 'sem dados'
}

function buildPrompt(candidates: Array<{
  game: Game
  signals: Signal[]
  homeStats: TeamStats | null
  awayStats: TeamStats | null
  newsHeadlines: string[]
}>): string {
  const lines: string[] = [
    'Você é um analista de trading in-play na Betfair Exchange.',
    'Analise os jogos abaixo e selecione os que mais valem operar hoje.',
    '',
    'CRITÉRIOS:',
    '- Priorize xG de ataque alto vs xG concedido alto do adversário',
    '- Valorize forma recente sólida (últimas 5 partidas)',
    '- Alto desvio padrão de gols = mais volátil = mais oportunidades in-play',
    '- Notícias com desfalques de titulares invalidam o sinal',
    '- Prefira ligas com alta liquidez (Premier League, La Liga, Serie A, Bundesliga, Champions League, Brasileirão Série A)',
    '- Ignore ligas obscuras ou jogos com poucos dados estatísticos',
    '',
    'JOGOS CANDIDATOS:',
  ]

  for (const c of candidates) {
    const topSignal = c.signals[0]
    const signalStr = topSignal
      ? `${topSignal.market} prob=${(topSignal.probability * 100).toFixed(1)}% conf=${(topSignal.confidence * 100).toFixed(1)}%`
      : 'sem sinal'
    const newsStr = c.newsHeadlines.length > 0 ? c.newsHeadlines.slice(0, 2).join('; ') : 'sem noticias'

    lines.push('---')
    lines.push(`gameId: ${c.game.id}`)
    lines.push(`${c.game.homeTeam} x ${c.game.awayTeam} (${c.game.league})`)
    lines.push(`sinal: ${signalStr}`)
    lines.push(`home: ${formatStats(c.homeStats)}`)
    lines.push(`away: ${formatStats(c.awayStats)}`)
    lines.push(`noticias: ${newsStr}`)
  }

  lines.push('')
  lines.push('Responda SOMENTE em JSON válido, sem markdown, sem texto extra:')
  lines.push('[{"gameId": "...", "rationale": "1 frase curta explicando por que vale operar"}, ...]')
  lines.push('Selecione entre 3 e 8 jogos. Se nenhum for adequado, retorne [].')

  return lines.join('\n')
}

function extractJsonArray(raw: string): CoachSuggestionItem[] {
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end <= start) return []
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1))
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is CoachSuggestionItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.gameId === 'string' &&
        typeof item.rationale === 'string',
    )
  } catch {
    return []
  }
}

export async function getCoachSuggestions(): Promise<CoachSuggestionsResponse> {
  const now = Date.now()

  if (cache && now - cache.cachedAt < CACHE_TTL_MS) {
    return { ...cache.response, fromCache: true }
  }

  const allGames = getGamesToday()
  const eligible = allGames.filter((g) => {
    if (g.status === 'finished' || g.status === 'completed') return false
    const topConf = g.topSignal?.confidence ?? 0
    const topMarket = g.topSignal?.market ?? ''
    return topConf >= MIN_CONFIDENCE && DIRECTIONAL_MARKETS.has(topMarket)
  })

  if (eligible.length === 0) {
    const response: CoachSuggestionsResponse = { suggestions: [], generatedAt: now, fromCache: false }
    cache = { response, cachedAt: now }
    return response
  }

  const candidates = eligible.map((game) => {
    const signals = getSignalsByGameId(game.id)
      .filter((s) => DIRECTIONAL_MARKETS.has(s.market))
      .sort((a, b) => b.confidence - a.confidence)
    const { home: homeStats, away: awayStats } = getTeamStats(game.id)
    const news = getNewsByGameId(game.id)
    const newsHeadlines = news.slice(0, 3).map((n) => n.title)
    return { game, signals, homeStats, awayStats, newsHeadlines }
  })

  const prompt = buildPrompt(candidates)

  let suggestions: CoachSuggestionItem[] = []
  try {
    const raw = (await generateReport(prompt)).trim()
    if (raw) {
      const parsed = extractJsonArray(raw)
      const eligibleIds = new Set(eligible.map((g) => g.id))
      suggestions = parsed.filter((s) => eligibleIds.has(s.gameId))
    }
  } catch (err) {
    console.error('[coachSuggestions] LLM error:', err instanceof Error ? err.message : err)
  }

  const response: CoachSuggestionsResponse = { suggestions, generatedAt: now, fromCache: false }
  cache = { response, cachedAt: now }
  return response
}

export function invalidateCoachSuggestionsCache(): void {
  cache = null
}

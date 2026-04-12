import axios from 'axios'

interface ExchangeParticipant {
  'participant-name'?: string
}

interface ExchangeEvent {
  id: string
  name: string
  start: string
  'event-participants'?: ExchangeParticipant[]
}

interface ExchangeEventsResponse {
  total?: number
  events?: ExchangeEvent[]
}

interface MatchableGame {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffAt: string
}

interface MatchResult {
  gameId: string
  eventId: string
  url: string
}

const EXCHANGE_API_BASE = process.env.BOLSA_EXCHANGE_API_URL ?? 'https://mexchange-api.bolsadeaposta.bet.br/api'
const EXCHANGE_EVENT_URL_BASE = process.env.BOLSA_EXCHANGE_EVENT_URL_BASE ?? 'https://bolsadeaposta.bet.br/b/exchange/sport/soccer/event'
const PER_PAGE = 100

const STOP_WORDS = new Set([
  'fc', 'cf', 'sc', 'ac', 'cd', 'afc', 'club', 'futebol', 'football', 'soccer',
])

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTeamName(value: string): string {
  const expanded = normalizeText(value)
    .replace(/\binter milan\b/g, 'inter')
    .replace(/\binternazionale\b/g, 'inter')

  const tokens = expanded
    .split(' ')
    .filter((token) => token.length > 0 && !STOP_WORDS.has(token))

  return tokens.join(' ')
}

function parseTeamNames(event: ExchangeEvent): { home: string; away: string } | null {
  const participants = event['event-participants'] ?? []
  if (participants.length >= 2) {
    const home = participants[0]?.['participant-name']
    const away = participants[1]?.['participant-name']
    if (home && away) return { home, away }
  }

  const parts = event.name.split(' vs ')
  if (parts.length === 2) {
    return { home: parts[0], away: parts[1] }
  }

  return null
}

function teamSimilarity(localName: string, exchangeName: string): number {
  const local = normalizeTeamName(localName)
  const remote = normalizeTeamName(exchangeName)
  if (!local || !remote) return 0
  if (local === remote) return 1
  if (local.includes(remote) || remote.includes(local)) return 0.9

  const localTokens = new Set(local.split(' ').filter(Boolean))
  const remoteTokens = new Set(remote.split(' ').filter(Boolean))
  if (!localTokens.size || !remoteTokens.size) return 0

  let intersection = 0
  for (const token of localTokens) {
    if (remoteTokens.has(token)) intersection += 1
  }

  return intersection / Math.max(localTokens.size, remoteTokens.size)
}

function chooseBestEvent(game: MatchableGame, events: ExchangeEvent[]): MatchResult | null {
  const kickoffMs = new Date(game.kickoffAt).getTime()
  if (!Number.isFinite(kickoffMs)) return null

  let best: { event: ExchangeEvent; score: number } | null = null

  for (const event of events) {
    const teams = parseTeamNames(event)
    if (!teams) continue

    const eventStartMs = new Date(event.start).getTime()
    if (!Number.isFinite(eventStartMs)) continue

    const diffMin = Math.abs(eventStartMs - kickoffMs) / 60000
    if (diffMin > 35) continue

    const homeScore = teamSimilarity(game.homeTeam, teams.home)
    const awayScore = teamSimilarity(game.awayTeam, teams.away)
    if (homeScore < 0.6 || awayScore < 0.6) continue

    const combined = (homeScore + awayScore) / 2
    const timePenalty = Math.min(diffMin / 35, 1) * 0.1
    const finalScore = combined - timePenalty

    if (!best || finalScore > best.score) {
      best = { event, score: finalScore }
    }
  }

  if (!best) return null

  return {
    gameId: game.id,
    eventId: best.event.id,
    url: `${EXCHANGE_EVENT_URL_BASE}/${best.event.id}`,
  }
}

async function fetchExchangeEvents(after: number, before: number): Promise<ExchangeEvent[]> {
  const events: ExchangeEvent[] = []
  let offset = 0

  while (true) {
    const response = await axios.get<ExchangeEventsResponse>(`${EXCHANGE_API_BASE}/events`, {
      timeout: 20000,
      params: {
        offset,
        'per-page': PER_PAGE,
        'sport-ids': '15',
        after,
        before,
        'sort-by': 'volume',
        'sort-direction': 'desc',
      },
    })

    const chunk = response.data.events ?? []
    events.push(...chunk)

    const total = response.data.total ?? events.length
    if (chunk.length === 0 || events.length >= total) break

    offset += PER_PAGE
  }

  return events
}

export async function matchGamesToExchange(games: MatchableGame[]): Promise<MatchResult[]> {
  if (games.length === 0) return []

  const kickoffTimes = games
    .map((game) => new Date(game.kickoffAt).getTime())
    .filter((value) => Number.isFinite(value))

  if (kickoffTimes.length === 0) return []

  const minKickoff = Math.min(...kickoffTimes)
  const maxKickoff = Math.max(...kickoffTimes)
  const after = Math.floor((minKickoff - 6 * 60 * 60 * 1000) / 1000)
  const before = Math.floor((maxKickoff + 12 * 60 * 60 * 1000) / 1000)

  const exchangeEvents = await fetchExchangeEvents(after, before)
  const results: MatchResult[] = []

  for (const game of games) {
    const match = chooseBestEvent(game, exchangeEvents)
    if (match) results.push(match)
  }

  return results
}

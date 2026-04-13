import { generateReport } from '../llm'
import type { CoachAction, CoachExposureGuidance, CoachResponse, NewsItem, Signal } from '../types/index'

const CACHE_TTL_MS = 30 * 1000

const LIVE_STATUSES = new Set([
  'inprogress',
  'live',
  'halftime',
  'pause',
  'overtime',
  'penaltyshootout',
])

interface MomentumPoint {
  minute: number
  value: number
}

interface LiveEvent {
  type: string
  class?: string
  minute?: number
  isHome?: boolean
  player?: string | null
}

interface LiveData {
  status?: string
  minute?: string | number
  clock?: {
    minute?: number
    display?: string
    phase?: string
    period?: number | null
  }
  homeScore?: number
  awayScore?: number
  events?: LiveEvent[]
}

interface LiveStatItem {
  name: string
  home: string | number | null
  away: string | number | null
}

interface CoachInput {
  gameId: string
  homeTeam: string
  awayTeam: string
  league: string
  enabled: boolean
  liveData: LiveData
  liveStats: LiveStatItem[]
  graphPoints: MomentumPoint[]
  news: NewsItem[]
  signals: Signal[]
}

interface CoachCacheEntry {
  snapshotHash: string
  response: CoachResponse
}

interface GameContext {
  homePlayerCount: number
  awayPlayerCount: number
  recentGoals: Array<{ minute: number; isHome: boolean }>
  redCards: Array<{ minute: number; isHome: boolean; player: string | null }>
  hasStructuralShift: boolean
  numericalAdvantage: 'home' | 'away' | 'equal'
}

const coachCache = new Map<string, CoachCacheEntry>()

interface CoachTelemetry {
  requestsTotal: number
  enabledRequests: number
  liveEligibleRequests: number
  completedRequests: number
  llmCalls: number
  cacheHits: number
  disabledResponses: number
  inactiveResponses: number
  readyResponses: number
  readyAguardarResponses: number
  latencyTotalMs: number
  latencyMaxMs: number
}

const telemetry: CoachTelemetry = {
  requestsTotal: 0,
  enabledRequests: 0,
  liveEligibleRequests: 0,
  completedRequests: 0,
  llmCalls: 0,
  cacheHits: 0,
  disabledResponses: 0,
  inactiveResponses: 0,
  readyResponses: 0,
  readyAguardarResponses: 0,
  latencyTotalMs: 0,
  latencyMaxMs: 0,
}

function logCoachEvent(payload: Record<string, unknown>): void {
  try {
    console.log(JSON.stringify({ event: 'coach_recommendation', ...payload }))
  } catch {
    console.log('[coach] recommendation emitted')
  }
}

function recordRequest(enabled: boolean, liveEligible: boolean): void {
  telemetry.requestsTotal += 1
  if (enabled) telemetry.enabledRequests += 1
  if (liveEligible) telemetry.liveEligibleRequests += 1
}

function recordCompletion(response: CoachResponse, latencyMs: number): void {
  telemetry.completedRequests += 1
  telemetry.latencyTotalMs += latencyMs
  telemetry.latencyMaxMs = Math.max(telemetry.latencyMaxMs, latencyMs)

  if (response.status === 'disabled') telemetry.disabledResponses += 1
  else if (response.status === 'inactive') telemetry.inactiveResponses += 1
  else {
    telemetry.readyResponses += 1
    if (response.action === 'aguardar') telemetry.readyAguardarResponses += 1
  }
}

export function getCoachMetrics(): Record<string, number> {
  const activationRate = telemetry.requestsTotal > 0
    ? telemetry.enabledRequests / telemetry.requestsTotal
    : 0
  const waitRecommendationRate = telemetry.readyResponses > 0
    ? telemetry.readyAguardarResponses / telemetry.readyResponses
    : 0
  const avgLatencyMs = telemetry.completedRequests > 0
    ? telemetry.latencyTotalMs / telemetry.completedRequests
    : 0

  return {
    requestsTotal: telemetry.requestsTotal,
    enabledRequests: telemetry.enabledRequests,
    liveEligibleRequests: telemetry.liveEligibleRequests,
    llmCalls: telemetry.llmCalls,
    cacheHits: telemetry.cacheHits,
    disabledResponses: telemetry.disabledResponses,
    inactiveResponses: telemetry.inactiveResponses,
    readyResponses: telemetry.readyResponses,
    readyAguardarResponses: telemetry.readyAguardarResponses,
    activationRate,
    waitRecommendationRate,
    avgLatencyMs,
    maxLatencyMs: telemetry.latencyMaxMs,
  }
}

function parseMinute(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw))
  if (typeof raw === 'string') {
    const parsed = parseInt(raw.replace(/[^\d]/g, ''), 10)
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
  }
  return 0
}

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function extractGameContext(liveData: LiveData, currentMinute: number): GameContext {
  const events = liveData.events ?? []

  const redCards = events
    .filter((e) => e.type === 'card' && (e.class === 'red' || e.class === 'yellowRed'))
    .map((e) => ({
      minute: e.minute ?? 0,
      isHome: e.isHome ?? false,
      player: e.player ?? null,
    }))

  const homeRedCards = redCards.filter((c) => c.isHome).length
  const awayRedCards = redCards.filter((c) => !c.isHome).length
  // Minimum 9 players (extreme edge case with multiple red cards)
  const homePlayerCount = Math.max(9, 11 - homeRedCards)
  const awayPlayerCount = Math.max(9, 11 - awayRedCards)

  const recentWindow = Math.max(0, currentMinute - 15)
  const recentGoals = events
    .filter((e) => e.type === 'goal' && (e.minute ?? 0) >= recentWindow)
    .map((e) => ({ minute: e.minute ?? 0, isHome: e.isHome ?? false }))

  const hasStructuralShift = redCards.length > 0 || recentGoals.length >= 2

  const numericalAdvantage: 'home' | 'away' | 'equal' =
    homePlayerCount > awayPlayerCount ? 'home'
    : awayPlayerCount > homePlayerCount ? 'away'
    : 'equal'

  return {
    homePlayerCount,
    awayPlayerCount,
    recentGoals,
    redCards,
    hasStructuralShift,
    numericalAdvantage,
  }
}

function computePpmSignal(points: MomentumPoint[], minute: number, homeScore: number, awayScore: number): {
  score: number
  recommendation: 'strong' | 'moderate' | 'weak' | 'none'
  side: 'home' | 'away' | 'neutral'
} {
  if (points.length < 4) {
    return { score: 0, recommendation: 'none', side: 'neutral' }
  }

  const filtered = points
    .filter((p) => Number.isFinite(p.minute) && Number.isFinite(p.value) && p.minute <= Math.max(minute, 1))
    .sort((a, b) => a.minute - b.minute)

  if (filtered.length < 4) {
    return { score: 0, recommendation: 'none', side: 'neutral' }
  }

  const recent = filtered.slice(-10)
  const previous = filtered.slice(-20, -10)

  const recentAvg = recent.reduce((sum, p) => sum + p.value, 0) / recent.length
  const previousAvg = previous.length > 0
    ? previous.reduce((sum, p) => sum + p.value, 0) / previous.length
    : 0

  const intensity = Math.min(1, Math.abs(recentAvg))
  const trend = Math.min(1, Math.abs(recentAvg - previousAvg))
  const side: 'home' | 'away' | 'neutral' = recentAvg > 0.05 ? 'home' : recentAvg < -0.05 ? 'away' : 'neutral'

  let score = 0
  score += intensity * 55
  score += trend * 25
  if (homeScore === awayScore) score += 10
  if (minute >= 60) score += 10

  if (side === 'neutral') score = Math.min(score, 20)
  const rounded = clamp(0, Math.round(score), 100)
  const recommendation = rounded >= 70 ? 'strong' : rounded >= 50 ? 'moderate' : rounded >= 30 ? 'weak' : 'none'

  return { score: rounded, recommendation, side }
}

function summarizeNews(news: NewsItem[]): string[] {
  return news
    .slice(0, 5)
    .map((item) => {
      const source = item.source ? ` (${item.source})` : ''
      return `${item.title}${source}`.trim()
    })
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end <= start) return null

  const candidate = raw.slice(start, end + 1)
  try {
    const parsed = JSON.parse(candidate)
    if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>
  } catch {
    return null
  }
  return null
}

function buildCoachPrompt(input: {
  homeTeam: string
  awayTeam: string
  league: string
  minute: number
  phase: string
  homeScore: number
  awayScore: number
  liveStats: LiveStatItem[]
  ppm: { score: number; recommendation: string; side: 'home' | 'away' | 'neutral' }
  newsSummary: string[]
  topSignals: Signal[]
  deterministic: { action: CoachAction; side: 'home' | 'away' | 'neutral'; market: string | null; confidence: number }
  gameContext: GameContext
}): string {
  const liveStatsBlock = input.liveStats.length > 0
    ? input.liveStats.slice(0, 8).map((s) => `- ${s.name}: ${s.home ?? 'N/A'} x ${s.away ?? 'N/A'}`).join('\n')
    : '- Sem estatisticas ao vivo relevantes no momento.'

  const newsBlock = input.newsSummary.length > 0
    ? input.newsSummary.map((n) => `- ${n}`).join('\n')
    : '- Sem noticias pre-jogo cadastradas.'

  const signalBlock = input.topSignals.length > 0
    ? input.topSignals.slice(0, 3).map((s) => `- ${s.market}: prob ${(s.probability * 100).toFixed(1)}%, confianca ${(s.confidence * 100).toFixed(1)}%`).join('\n')
    : '- Sem sinal pre-jogo relevante.'

  const { gameContext } = input
  const structuralLines: string[] = []

  if (gameContext.redCards.length > 0) {
    for (const rc of gameContext.redCards) {
      const side = rc.isHome ? input.homeTeam : input.awayTeam
      const player = rc.player ? ` (${rc.player})` : ''
      structuralLines.push(`- Cartao vermelho: ${side}${player} aos ${rc.minute}'`)
    }
    structuralLines.push(
      `- Jogadores em campo: ${input.homeTeam} ${gameContext.homePlayerCount} x ${gameContext.awayPlayerCount} ${input.awayTeam}`
    )
    if (gameContext.numericalAdvantage !== 'equal') {
      const advantageTeam = gameContext.numericalAdvantage === 'home' ? input.homeTeam : input.awayTeam
      structuralLines.push(`- Superioridade numerica: ${advantageTeam}`)
    }
  }

  if (gameContext.recentGoals.length > 0) {
    for (const g of gameContext.recentGoals) {
      const side = g.isHome ? input.homeTeam : input.awayTeam
      structuralLines.push(`- Gol recente: ${side} aos ${g.minute}'`)
    }
  }

  const structuralBlock = structuralLines.length > 0
    ? structuralLines.join('\n')
    : '- Sem eventos estruturais relevantes (11x11, sem gols recentes).'

  const { action, side, market, confidence } = input.deterministic
  const marketStr = market ? marketLabel(market) : 'indefinido'
  const sideStr = side === 'home' ? 'casa' : side === 'away' ? 'visitante' : 'neutro'
  const actionDesc =
    action === 'entrar_back'
      ? `ENTRAR BACK no mercado "${marketStr}" pelo lado ${sideStr} (back = apostar A FAVOR do resultado — voce ganha se o time ${sideStr} performar conforme esperado)`
      : action === 'entrar_lay'
        ? `ENTRAR LAY no mercado "${marketStr}" pelo lado ${sideStr} (lay = apostar CONTRA o resultado — voce atua como casa e ganha se o time ${sideStr} NAO performar conforme esperado)`
        : action === 'sair'
          ? 'SAIR da posicao atual (reduzir ou fechar exposicao)'
          : 'AGUARDAR (sem entrada recomendada neste momento)'

  return [
    'Voce e um coach de trading in-play em futebol, especializado em Betfair Exchange.',
    'Sua tarefa e redigir a mensagem operacional e os codigos de razao para uma decisao ja tomada pelo sistema.',
    'Responda SOMENTE em JSON valido, sem markdown, sem texto extra.',
    '',
    '## Glossario (obrigatorio ler)',
    '- Back: apostar A FAVOR de um resultado. Voce ganha se o evento acontecer. Ex: back home = apostar que o time da casa vai ganhar.',
    '- Lay: apostar CONTRA um resultado. Voce age como bookmaker e ganha se o evento NAO acontecer. Ex: lay home = apostar que o time da casa NAO vai ganhar (empate ou derrota).',
    '',
    '## Partida',
    `${input.homeTeam} x ${input.awayTeam} (${input.league})`,
    `Minuto: ${input.minute} | Fase: ${input.phase} | Placar: ${input.homeScore}x${input.awayScore}`,
    '',
    '## Eventos estruturais (cartoes vermelhos, superioridade numerica, gols recentes)',
    structuralBlock,
    '',
    '## Contexto ao vivo',
    liveStatsBlock,
    '',
    '## Momentum (PPM)',
    `score=${input.ppm.score}, recommendation=${input.ppm.recommendation}, side=${input.ppm.side}`,
    '',
    '## Sinais pre-jogo',
    signalBlock,
    '',
    '## Noticias pre-jogo',
    newsBlock,
    '',
    '## Decisao do sistema (nao altere — apenas justifique e escreva a mensagem)',
    `action: ${action}`,
    `descricao: ${actionDesc}`,
    `confidence: ${confidence}`,
    '',
    '## Sua tarefa',
    '- Escreva "text": uma mensagem curta (1-2 frases) orientando o usuario com base na decisao acima e no contexto da partida.',
    '- Use o glossario: se a acao for lay, deixe claro que e uma aposta CONTRA o lado indicado.',
    '- Se houver eventos estruturais relevantes (cartao vermelho, superioridade numerica), mencione-os na mensagem.',
    '- Nunca prometa lucro ou certeza. Tom operacional, direto.',
    '- Escreva "reasonCodes": lista de 2 a 4 codigos snake_case explicando os fatores que sustentam a decisao.',
    '',
    '## Formato de saida (obrigatorio)',
    '{',
    '  "text": "mensagem curta orientando o usuario",',
    '  "reasonCodes": ["codigo_1", "codigo_2"]',
    '}',
  ].join('\n')
}

function makeDisabledResponse(): CoachResponse {
  return {
    status: 'disabled',
    text: '',
    action: 'aguardar',
    market: null,
    side: 'neutral',
    confidence: 0,
    reasonCodes: ['coach_disabled'],
    cachedAt: 0,
    fromCache: false,
    contextUsed: { live: false, ppm: false, news: false },
    exposure: null,
  }
}

function makeInactiveResponse(newsCount: number): CoachResponse {
  return {
    status: 'inactive',
    text: '',
    action: 'aguardar',
    market: null,
    side: 'neutral',
    confidence: 0,
    reasonCodes: newsCount > 0 ? ['game_not_live', 'prematch_context_ready'] : ['game_not_live'],
    cachedAt: 0,
    fromCache: false,
    contextUsed: { live: false, ppm: false, news: newsCount > 0 },
    exposure: null,
  }
}

function buildSnapshotHash(input: {
  minute: number
  phase: string
  homeScore: number
  awayScore: number
  ppmScore: number
  ppmSide: 'home' | 'away' | 'neutral'
  topSignal: Signal | null
  newsSummary: string[]
  homePlayerCount: number
  awayPlayerCount: number
}): string {
  const minuteBucket = Math.floor(input.minute / 2)
  const topSignalPart = input.topSignal
    ? `${input.topSignal.market}:${input.topSignal.probability.toFixed(3)}:${input.topSignal.confidence.toFixed(3)}`
    : 'none'
  const newsPart = input.newsSummary.join('|').slice(0, 400)
  return [
    minuteBucket,
    input.phase,
    input.homeScore,
    input.awayScore,
    input.ppmScore,
    input.ppmSide,
    topSignalPart,
    newsPart,
    input.homePlayerCount,
    input.awayPlayerCount,
  ].join('::')
}

function buildFallbackReadyResponse(contextUsed: { live: boolean; ppm: boolean; news: boolean }, now: number): CoachResponse {
  return {
    status: 'ready',
    text: 'Mercado sem confirmacao forte neste momento. Aguarde mais 1 minuto para nova leitura antes de entrar.',
    action: 'aguardar',
    market: null,
    side: 'neutral',
    confidence: 30,
    reasonCodes: ['llm_fallback', 'wait_for_confirmation'],
    cachedAt: now,
    fromCache: false,
    contextUsed,
    exposure: null,
  }
}

function buildExposureGuidance(params: {
  minute: number
  action: CoachAction
  side: 'home' | 'away' | 'neutral'
  market: string | null
  ppm: { score: number; recommendation: 'strong' | 'moderate' | 'weak' | 'none' }
  homeScore: number
  awayScore: number
  gameContext: GameContext
}): CoachExposureGuidance | null {
  if (params.action !== 'entrar_back' && params.action !== 'entrar_lay') return null

  const baseByStrength: Record<'strong' | 'moderate' | 'weak' | 'none', { min: number; max: number }> = {
    strong: { min: 4, max: 8 },
    moderate: { min: 3, max: 6 },
    weak: { min: 2, max: 4 },
    none: { min: 2, max: 3 },
  }

  const base = baseByStrength[params.ppm.recommendation]
  let minMinutes = base.min
  let maxMinutes = base.max

  const scoreDiff = Math.abs(params.homeScore - params.awayScore)
  if (params.minute >= 75) {
    minMinutes -= 1
    maxMinutes -= 1
  }
  if (params.minute >= 85) {
    minMinutes -= 1
    maxMinutes -= 2
  }
  if (scoreDiff >= 2) {
    maxMinutes -= 1
  }
  if (params.ppm.score >= 82 && params.minute < 75) {
    maxMinutes += 1
  }

  // Adjust for numerical advantage/disadvantage
  const { numericalAdvantage } = params.gameContext
  const betSide = params.side
  if (numericalAdvantage !== 'equal') {
    if (numericalAdvantage === betSide) {
      // Betting with the numerically superior team — position safer, extend window
      maxMinutes += 2
    } else {
      // Betting against the superior team — tighten exit window and raise urgency
      minMinutes -= 1
      maxMinutes -= 2
    }
  }

  minMinutes = clamp(2, minMinutes, 8)
  maxMinutes = clamp(minMinutes, maxMinutes, 12)

  const reviewAtMinute = Math.min(120, params.minute + minMinutes)

  // Urgency: elevated automatically when betting against the numerically superior team
  const bettingAgainstAdvantage = numericalAdvantage !== 'equal' && numericalAdvantage !== betSide
  const urgency: 'baixa' | 'media' | 'alta' =
    bettingAgainstAdvantage || params.minute >= 82 || maxMinutes <= 4 || params.ppm.score < 60
      ? 'alta'
      : params.minute >= 70 || params.ppm.score < 72
        ? 'media'
        : 'baixa'

  const sideLabel = params.side === 'home' ? 'casa' : params.side === 'away' ? 'visitante' : 'neutro'
  const oppLabel = params.side === 'home' ? 'visitante' : 'casa'
  // For LAY, the momentum to watch is the adversary's (the side with the edge that justifies the lay).
  // For BACK, it's the side being backed.
  const momentumSide = params.action === 'entrar_lay' ? oppLabel : sideLabel
  const market = marketLabel(params.market)
  const exitTriggers = [
    `Saia se o momentum do lado ${momentumSide} cair por 2 leituras consecutivas.`,
    params.action === 'entrar_lay'
      ? `Saia se houver gol do lado em lay (${sideLabel}) ou se o momentum do ${sideLabel} aumentar contra sua tese.`
      : `Saia se o adversario assumir controle territorial e reduzir a vantagem do lado ${sideLabel}.`,
    `Se nao houver evolucao da tese no ${market} ate ${reviewAtMinute}, reavalie e considere reduzir exposicao.`,
  ]

  if (params.gameContext.redCards.length > 0) {
    exitTriggers.push('Saia imediatamente se o placar ou a vantagem numerica mudar.')
  }

  return {
    minMinutes,
    maxMinutes,
    reviewAtMinute,
    urgency,
    exitTriggers,
  }
}

function marketLabel(market: string | null): string {
  const labels: Record<string, string> = {
    backHome: 'Back Casa',
    backAway: 'Back Visitante',
    layHome: 'Lay Casa',
    layAway: 'Lay Visitante',
    over25: 'Over 2.5',
    under25: 'Under 2.5',
    btts: 'BTTS',
  }
  if (!market) return 'mercado indefinido'
  return labels[market] ?? market
}

function detectWaitTone(text: string): boolean {
  const normalized = text.toLowerCase()
  const waitMarkers = [
    'aguarde',
    'aguardar',
    'esperar',
    'espera',
    'sem setup',
    'sem entrada',
    'cautela',
    'nao entrar',
    'não entrar',
    'evitar entrada',
    'no-bet',
    'sem confirmacao',
    'sem confirmação',
  ]
  return waitMarkers.some((marker) => normalized.includes(marker))
}

function normalizeCoachText(input: {
  action: CoachAction
  side: 'home' | 'away' | 'neutral'
  market: string | null
  llmText: string
}): string {
  const trimmed = input.llmText.trim()
  const sideLabel = input.side === 'home' ? 'casa' : input.side === 'away' ? 'visitante' : 'mercado'
  const market = marketLabel(input.market)

  if (input.action === 'aguardar') {
    if (trimmed && detectWaitTone(trimmed)) return trimmed
    return 'Sem confirmacao forte neste minuto. Aguarde mais um ciclo para buscar entrada com melhor assimetria.'
  }

  if (input.action === 'sair') {
    return trimmed || `Leitura de risco aumentou. Priorize saida parcial/total no ${market} para proteger a posicao.`
  }

  if (trimmed && !detectWaitTone(trimmed)) return trimmed

  if (input.action === 'entrar_lay') {
    return `Entrada de lay no ${market} validada para o lado ${sideLabel}. Execute com stake disciplinada e reavalie se o momentum enfraquecer.`
  }

  return `Entrada de back no ${market} validada para o lado ${sideLabel}. Mantenha gestao de risco e confirme continuidade da pressao ofensiva.`
}

function getDirectionalSignal(signals: Signal[]): Signal | null {
  const directional = new Set(['backHome', 'backAway', 'layHome', 'layAway'])
  for (const signal of signals) {
    if (directional.has(signal.market)) return signal
  }
  return null
}

function buildDeterministicDecision(params: {
  minute: number
  ppm: { score: number; recommendation: 'strong' | 'moderate' | 'weak' | 'none'; side: 'home' | 'away' | 'neutral' }
  topSignals: Signal[]
  gameContext: GameContext
}): { action: CoachAction; side: 'home' | 'away' | 'neutral'; market: string | null; confidence: number; reasonCodes: string[] } {
  const { minute, ppm, topSignals, gameContext } = params
  const directionalSignal = getDirectionalSignal(topSignals)
  const signalConfidencePct = directionalSignal ? Math.round((directionalSignal.confidence ?? 0) * 100) : 0
  const blendedConfidence = clamp(0, Math.round(ppm.score * 0.65 + signalConfidencePct * 0.35), 100)

  if (!directionalSignal || ppm.side === 'neutral') {
    return {
      action: 'aguardar',
      side: 'neutral',
      market: null,
      confidence: clamp(30, Math.max(35, Math.round(ppm.score * 0.6)), 60),
      reasonCodes: ['deterministic_wait', 'missing_directional_alignment'],
    }
  }

  const strictMode = ppm.recommendation === 'strong'
  const mediumMode = ppm.recommendation === 'moderate' && minute >= 55
  if (!strictMode && !mediumMode) {
    return {
      action: 'aguardar',
      side: ppm.side,
      market: null,
      confidence: clamp(30, Math.max(35, Math.round(ppm.score * 0.65)), 60),
      reasonCodes: ['deterministic_wait', 'ppm_not_confirmed'],
    }
  }

  const map: Record<string, { action: CoachAction; side: 'home' | 'away' }> = {
    backHome: { action: 'entrar_back', side: 'home' },
    backAway: { action: 'entrar_back', side: 'away' },
    layHome: { action: 'entrar_lay', side: 'home' },
    layAway: { action: 'entrar_lay', side: 'away' },
  }

  const mapped = map[directionalSignal.market]
  if (!mapped) {
    return {
      action: 'aguardar',
      side: 'neutral',
      market: null,
      confidence: 35,
      reasonCodes: ['deterministic_wait', 'unsupported_market'],
    }
  }

  // For BACK: PPM must favor the same side being backed.
  // For LAY: PPM must favor the OPPOSITE side — you're betting against a team,
  // so momentum should be on the adversary's side, not on the team being laid.
  const oppositeSide: 'home' | 'away' = mapped.side === 'home' ? 'away' : 'home'
  const ppmAligned =
    mapped.action === 'entrar_back'
      ? ppm.side === mapped.side
      : ppm.side === oppositeSide

  if (!ppmAligned) {
    return {
      action: 'aguardar',
      side: ppm.side,
      market: null,
      confidence: clamp(35, Math.round(blendedConfidence * 0.75), 60),
      reasonCodes: ['deterministic_wait', 'ppm_signal_side_mismatch'],
    }
  }

  // Structural override: invalidate signals that contradict numerical advantage
  if (gameContext.numericalAdvantage !== 'equal') {
    const favored = gameContext.numericalAdvantage
    const disfavored: 'home' | 'away' = favored === 'home' ? 'away' : 'home'

    const layAgainstFavored = mapped.action === 'entrar_lay' && mapped.side === favored
    const backDisfavored = mapped.action === 'entrar_back' && mapped.side === disfavored

    if (layAgainstFavored || backDisfavored) {
      return {
        action: 'aguardar',
        side: mapped.side,
        market: null,
        confidence: clamp(30, Math.round(blendedConfidence * 0.5), 50),
        reasonCodes: ['deterministic_wait', 'signal_invalidated_numerical_advantage'],
      }
    }
  }

  // Penalize confidence when there's a structural shift (red card, multiple recent goals)
  // since pre-match signals were generated without knowledge of current game state
  const adjustedConfidence = gameContext.hasStructuralShift
    ? clamp(40, blendedConfidence - 20, 90)
    : clamp(55, blendedConfidence, 90)

  const reasonCodes: string[] = ['deterministic_action', `ppm_${ppm.recommendation}`, 'signal_alignment']
  if (gameContext.hasStructuralShift) reasonCodes.push('structural_shift_detected')

  return {
    action: mapped.action,
    side: mapped.side,
    market: directionalSignal.market,
    confidence: adjustedConfidence,
    reasonCodes,
  }
}

export async function getCoachSuggestion(input: CoachInput): Promise<CoachResponse> {
  const liveStatus = String(input.liveData.status ?? '').toLowerCase()
  const livePhase = String(input.liveData.clock?.phase ?? '').toLowerCase()
  const liveEligible = LIVE_STATUSES.has(liveStatus)
  const startedAt = Date.now()

  recordRequest(input.enabled, liveEligible)

  if (!input.enabled) {
    const response = makeDisabledResponse()
    recordCompletion(response, Date.now() - startedAt)
    logCoachEvent({
      gameId: input.gameId,
      status: response.status,
      action: response.action,
      confidence: response.confidence,
      latencyMs: Date.now() - startedAt,
      fromCache: response.fromCache,
    })
    return response
  }

  if (!liveEligible) {
    const response = makeInactiveResponse(input.news.length)
    recordCompletion(response, Date.now() - startedAt)
    logCoachEvent({
      gameId: input.gameId,
      status: response.status,
      action: response.action,
      confidence: response.confidence,
      latencyMs: Date.now() - startedAt,
      fromCache: response.fromCache,
    })
    return response
  }

  if (livePhase === 'halftime') {
    const now = Date.now()
    const response: CoachResponse = {
      status: 'ready',
      text: 'Intervalo de jogo. Aguarde o reinicio do 2o tempo para nova leitura de momentum.',
      action: 'aguardar',
      market: null,
      side: 'neutral',
      confidence: 45,
      reasonCodes: ['halftime_break', 'wait_second_half_restart'],
      cachedAt: now,
      fromCache: false,
      contextUsed: { live: true, ppm: input.graphPoints.length > 0, news: input.news.length > 0 },
      exposure: null,
    }
    recordCompletion(response, Date.now() - startedAt)
    logCoachEvent({
      gameId: input.gameId,
      status: response.status,
      action: response.action,
      confidence: response.confidence,
      latencyMs: Date.now() - startedAt,
      fromCache: response.fromCache,
      reasonCodes: response.reasonCodes,
    })
    return response
  }

  const minute = Number.isFinite(input.liveData.clock?.minute)
    ? Math.max(0, Math.floor(Number(input.liveData.clock?.minute)))
    : parseMinute(input.liveData.minute)
  const homeScore = Number.isFinite(input.liveData.homeScore) ? Number(input.liveData.homeScore) : 0
  const awayScore = Number.isFinite(input.liveData.awayScore) ? Number(input.liveData.awayScore) : 0

  const gameContext = extractGameContext(input.liveData, minute)
  const ppm = computePpmSignal(input.graphPoints, minute, homeScore, awayScore)
  const newsSummary = summarizeNews(input.news)
  const topSignals = input.signals.slice(0, 3)

  const snapshotHash = buildSnapshotHash({
    minute,
    phase: livePhase || 'unknown',
    homeScore,
    awayScore,
    ppmScore: ppm.score,
    ppmSide: ppm.side,
    topSignal: topSignals[0] ?? null,
    newsSummary,
    homePlayerCount: gameContext.homePlayerCount,
    awayPlayerCount: gameContext.awayPlayerCount,
  })

  const cached = coachCache.get(input.gameId)
  const now = Date.now()
  if (cached && cached.snapshotHash === snapshotHash && now - cached.response.cachedAt <= CACHE_TTL_MS) {
    telemetry.cacheHits += 1
    const response = { ...cached.response, fromCache: true }
    recordCompletion(response, Date.now() - startedAt)
    logCoachEvent({
      gameId: input.gameId,
      status: response.status,
      action: response.action,
      confidence: response.confidence,
      latencyMs: Date.now() - startedAt,
      fromCache: true,
    })
    return response
  }

  const deterministic = buildDeterministicDecision({ minute, ppm, topSignals, gameContext })

  const prompt = buildCoachPrompt({
    homeTeam: input.homeTeam,
    awayTeam: input.awayTeam,
    league: input.league,
    minute,
    phase: livePhase || 'unknown',
    homeScore,
    awayScore,
    liveStats: input.liveStats,
    ppm,
    newsSummary,
    topSignals,
    deterministic,
    gameContext,
  })

  const contextUsed = {
    live: true,
    ppm: input.graphPoints.length > 0,
    news: input.news.length > 0,
  }

  try {
    telemetry.llmCalls += 1
    const raw = (await generateReport(prompt)).trim()
    if (!raw) {
      const fallback = buildFallbackReadyResponse(contextUsed, now)
      coachCache.set(input.gameId, { snapshotHash, response: fallback })
      recordCompletion(fallback, Date.now() - startedAt)
      logCoachEvent({
        gameId: input.gameId,
        status: fallback.status,
        action: fallback.action,
        confidence: fallback.confidence,
        latencyMs: Date.now() - startedAt,
        fromCache: fallback.fromCache,
        reasonCodes: fallback.reasonCodes,
      })
      return fallback
    }

    const parsed = extractJsonObject(raw)
    if (!parsed) {
      const fallback: CoachResponse = {
        status: 'ready',
        text: raw.slice(0, 320),
        action: 'aguardar',
        market: null,
        side: 'neutral',
        confidence: 35,
        reasonCodes: ['unstructured_llm_output'],
        cachedAt: now,
        fromCache: false,
        contextUsed,
        exposure: null,
      }
      coachCache.set(input.gameId, { snapshotHash, response: fallback })
      recordCompletion(fallback, Date.now() - startedAt)
      logCoachEvent({
        gameId: input.gameId,
        status: fallback.status,
        action: fallback.action,
        confidence: fallback.confidence,
        latencyMs: Date.now() - startedAt,
        fromCache: fallback.fromCache,
        reasonCodes: fallback.reasonCodes,
      })
      return fallback
    }

    const llmText = typeof parsed.text === 'string' ? parsed.text : ''
    const llmReasonCodes = Array.isArray(parsed.reasonCodes)
      ? parsed.reasonCodes.filter((item): item is string => typeof item === 'string' && item.length > 0).slice(0, 6)
      : []
    const reasonCodes = [...deterministic.reasonCodes, ...llmReasonCodes].slice(0, 8)
    const exposure = buildExposureGuidance({
      minute,
      action: deterministic.action,
      side: deterministic.side,
      market: deterministic.market,
      ppm,
      homeScore,
      awayScore,
      gameContext,
    })
    const text = normalizeCoachText({
      action: deterministic.action,
      side: deterministic.side,
      market: deterministic.market,
      llmText,
    })

    const response: CoachResponse = {
      status: 'ready',
      text,
      action: deterministic.action,
      market: deterministic.market,
      side: deterministic.side,
      confidence: deterministic.confidence,
      reasonCodes,
      cachedAt: now,
      fromCache: false,
      contextUsed,
      exposure,
    }

    coachCache.set(input.gameId, { snapshotHash, response })
    recordCompletion(response, Date.now() - startedAt)
    logCoachEvent({
      gameId: input.gameId,
      status: response.status,
      action: response.action,
      confidence: response.confidence,
      latencyMs: Date.now() - startedAt,
      fromCache: response.fromCache,
      market: response.market,
      side: response.side,
      reasonCodes: response.reasonCodes,
    })
    return response
  } catch {
    const fallback = buildFallbackReadyResponse(contextUsed, now)
    coachCache.set(input.gameId, { snapshotHash, response: fallback })
    recordCompletion(fallback, Date.now() - startedAt)
    logCoachEvent({
      gameId: input.gameId,
      status: fallback.status,
      action: fallback.action,
      confidence: fallback.confidence,
      latencyMs: Date.now() - startedAt,
      fromCache: fallback.fromCache,
      reasonCodes: fallback.reasonCodes,
    })
    return fallback
  }
}

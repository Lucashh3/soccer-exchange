import { generateReport } from '../llm'
import type { CoachAction, CoachResponse, NewsItem, Signal } from '../types/index'

const CACHE_TTL_MS = 60 * 1000

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

  return [
    'Voce e um coach de trading in-play em futebol, focado em orientar entrada com cautela e objetividade.',
    'Responda SOMENTE em JSON valido, sem markdown, sem texto extra.',
    '',
    '## Partida',
    `${input.homeTeam} x ${input.awayTeam} (${input.league})`,
    `Minuto: ${input.minute} | Fase: ${input.phase} | Placar: ${input.homeScore}x${input.awayScore}`,
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
    '## Regras',
    '- Se o contexto estiver ambiguo, retorne action=aguardar.',
    '- Use noticias pre-jogo para modular confianca e risco.',
    '- Nunca prometa lucro ou certeza.',
    '- Tom de guia operacional, curto e claro.',
    '- confidence deve ser um inteiro de 0 a 100, sem simbolo de porcentagem.',
    '- Para action=aguardar, use confidence entre 30 e 60.',
    '- Para action=entrar_back ou entrar_lay, use confidence entre 55 e 90.',
    '- Use confidence=0 apenas quando status nao for ready (nao se aplica aqui).',
    '',
    '## Formato de saida (obrigatorio)',
    '{',
    '  "action": "entrar_back|entrar_lay|aguardar|sair",',
    '  "market": "string ou null",',
    '  "side": "home|away|neutral",',
    '  "confidence": 0,',
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
}): string {
  const minuteBucket = Math.floor(input.minute / 1)
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
  }
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
}): { action: CoachAction; side: 'home' | 'away' | 'neutral'; market: string | null; confidence: number; reasonCodes: string[] } {
  const { minute, ppm, topSignals } = params
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

  if (mapped.side !== ppm.side) {
    return {
      action: 'aguardar',
      side: ppm.side,
      market: null,
      confidence: clamp(35, Math.round(blendedConfidence * 0.75), 60),
      reasonCodes: ['deterministic_wait', 'ppm_signal_side_mismatch'],
    }
  }

  return {
    action: mapped.action,
    side: mapped.side,
    market: directionalSignal.market,
    confidence: clamp(55, blendedConfidence, 90),
    reasonCodes: ['deterministic_action', `ppm_${ppm.recommendation}`, 'signal_alignment'],
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

    const deterministic = buildDeterministicDecision({ minute, ppm, topSignals })
    const text = typeof parsed.text === 'string' && parsed.text.trim().length > 0
      ? parsed.text.trim()
      : 'Sem setup claro neste momento. Aguarde confirmacao antes de entrar.'
    const llmReasonCodes = Array.isArray(parsed.reasonCodes)
      ? parsed.reasonCodes.filter((item): item is string => typeof item === 'string' && item.length > 0).slice(0, 6)
      : []
    const reasonCodes = [...deterministic.reasonCodes, ...llmReasonCodes].slice(0, 8)

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

export interface PpmBlock {
  from: number
  to: number
  value: number
  side: 'home' | 'away' | 'neutral'
  intensity: number
}

export type TrendType = 'rising_home' | 'rising_away' | 'stable' | 'reversing'

export interface TrendResult {
  type: TrendType
  delta: number
  currentSide: 'home' | 'away' | 'neutral'
}

export interface EntrySignal {
  score: number
  recommendation: 'strong' | 'moderate' | 'weak' | 'none'
  side: 'home' | 'away'
  reason: string
}

interface MomentumPoint { minute: number; value: number }

export function calcPpm(points: MomentumPoint[], blockSize = 15): PpmBlock[] {
  const blocks: PpmBlock[] = []
  for (let from = 0; from < 90; from += blockSize) {
    const to = from + blockSize
    const inBlock = points.filter(p => p.minute >= from && p.minute < to)
    if (!inBlock.length) continue
    const avg = inBlock.reduce((s, p) => s + p.value, 0) / inBlock.length
    blocks.push({
      from,
      to,
      value: avg,
      side: avg > 0.1 ? 'home' : avg < -0.1 ? 'away' : 'neutral',
      intensity: Math.abs(avg),
    })
  }
  return blocks
}

export function detectTrend(blocks: PpmBlock[]): TrendResult | null {
  if (blocks.length < 2) return null
  const prev = blocks[blocks.length - 2]
  const curr = blocks[blocks.length - 1]
  const delta = curr.value - prev.value

  if (Math.abs(delta) < 0.1) return { type: 'stable', delta, currentSide: curr.side }
  if (delta > 0 && curr.side === 'home') return { type: 'rising_home', delta, currentSide: 'home' }
  if (delta < 0 && curr.side === 'away') return { type: 'rising_away', delta, currentSide: 'away' }
  return { type: 'reversing', delta, currentSide: curr.side }
}

function buildReason(
  trend: TrendResult,
  lastBlock: PpmBlock,
  minute: number,
  isScoreless: boolean,
): string {
  const side = lastBlock.side === 'home' ? 'Casa' : 'Visitante'
  const parts: string[] = []

  if (trend.type === 'rising_home' || trend.type === 'rising_away') {
    parts.push(`Pressão crescente do ${side} desde o min ${lastBlock.from}`)
  } else if (trend.type === 'reversing') {
    parts.push(`${side} assumiu o controle recentemente`)
  } else {
    parts.push(`${side} dominando`)
  }

  if (isScoreless) parts.push('placar ainda fechado')
  if (minute >= 70) parts.push('reta final do jogo')
  else if (minute >= 60) parts.push('segundo tempo avançado')

  return parts.join(', ')
}

export function calcEntrySignal(
  blocks: PpmBlock[],
  minute: number,
  homeScore: number,
  awayScore: number,
  rawPoints: MomentumPoint[] = [],
): EntrySignal | null {
  const trend = detectTrend(blocks)
  if (!trend || trend.type === 'stable' || trend.currentSide === 'neutral') return null

  const lastBlock = blocks[blocks.length - 1]
  if (lastBlock.side === 'neutral') return null

  // Current pressure: average of the last 5 raw momentum points
  // This reflects what's happening right now, not the 15-min block average
  const recentPoints = rawPoints.slice(-5)
  const currentIntensity = recentPoints.length > 0
    ? Math.abs(recentPoints.reduce((s, p) => s + p.value, 0) / recentPoints.length)
    : lastBlock.intensity

  // If current pressure has dropped below threshold, suppress the signal
  // regardless of what the block average shows
  if (currentIntensity < 0.15) return null

  // Current side from recent points — must match the block trend
  const currentAvg = recentPoints.length > 0
    ? recentPoints.reduce((s, p) => s + p.value, 0) / recentPoints.length
    : lastBlock.value
  const currentSide = currentAvg > 0.1 ? 'home' : currentAvg < -0.1 ? 'away' : 'neutral'
  if (currentSide === 'neutral' || currentSide !== lastBlock.side) return null

  const isScoreless = homeScore === 0 && awayScore === 0
  const isLateGame = minute >= 60

  let score = 0
  score += currentIntensity * 40             // pressão real do momento atual (0–40)
  score += Math.abs(trend.delta) * 30        // força da mudança de bloco (0–30)
  if (isScoreless) score += 15              // odds mais altas = mais valor
  if (isLateGame) score += 15               // pressão no final pesa mais
  if (trend.type === 'reversing') score -= 20 // virada recente = incerteza

  score = Math.max(0, Math.min(100, Math.round(score)))

  const recommendation =
    score >= 70 ? 'strong' :
    score >= 50 ? 'moderate' :
    score >= 30 ? 'weak' : 'none'

  const side = lastBlock.side as 'home' | 'away'
  const reason = buildReason(trend, lastBlock, minute, isScoreless)

  return { score, recommendation, side, reason }
}

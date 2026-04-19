/**
 * attackTracker.ts
 * Faz polling periódico na API de estatísticas da Bolsa de Aposta
 * e mantém snapshots em memória para calcular ritmo de ataques por janela de tempo.
 */

import axios from 'axios'

const STATS_API      = 'https://data-center-bolsa-statistics-api.layback.trade/api/event'
const STAT_ATTACKS   = 31
const STAT_DANGEROUS = 32
const MAX_SNAPSHOTS  = 120  // ~2h a 1 snapshot/min

interface AttackSnapshot {
  timestamp:  number
  attacks:    number
  dangerous:  number
  gameMinute: number   // minuto do jogo (0 = desconhecido)
}

interface SideSnapshots {
  home: AttackSnapshot[]
  away: AttackSnapshot[]
}

const store = new Map<string, SideSnapshots>()

export interface TeamAttackRates {
  total:       number
  perMin:      number | null
  last5min:    number | null
  last5trend:  'up' | 'down' | 'stable'
  last10min:   number | null
  last10trend: 'up' | 'down' | 'stable'
}

export interface AttackStats {
  home: {
    attacks:   TeamAttackRates
    dangerous: TeamAttackRates
  }
  away: {
    attacks:   TeamAttackRates
    dangerous: TeamAttackRates
  }
  updatedAt: number
}

function calcTrend(rate: number, baseline: number): 'up' | 'down' | 'stable' {
  if (rate > baseline * 1.1) return 'up'
  if (rate < baseline * 0.9) return 'down'
  return 'stable'
}

function closestSnapshot(snapshots: AttackSnapshot[], targetTs: number): AttackSnapshot {
  return snapshots.reduce((best, s) =>
    Math.abs(s.timestamp - targetTs) < Math.abs(best.timestamp - targetTs) ? s : best
  )
}

const MIN_5  = 4.5 * 60_000   // 4.5 min de histórico mínimo para janela de 5min
const MIN_10 = 9.0 * 60_000   // 9 min de histórico mínimo para janela de 10min

function calcRates(snapshots: AttackSnapshot[], field: 'attacks' | 'dangerous'): TeamAttackRates {
  if (snapshots.length === 0) {
    return { total: 0, perMin: null, last5min: null, last5trend: 'stable', last10min: null, last10trend: 'stable' }
  }

  const latest = snapshots[snapshots.length - 1]
  const oldest = snapshots[0]
  const total  = latest[field]
  const span   = latest.timestamp - oldest.timestamp  // ms de histórico disponível

  // perMin: taxa de ataques por minuto
  // Prioridade: 1) incremento no span observado  2) última janela ativa  3) total/minuto do jogo
  let perMin: number | null = null
  if (span >= 60_000 && latest[field] - oldest[field] > 0) {
    perMin = parseFloat(((latest[field] - oldest[field]) / (span / 60000)).toFixed(2))
  }
  if (!perMin) {
    // Busca última janela ativa (até 10 min atrás) com incremento real
    const tenMinAgo = latest.timestamp - 10 * 60_000
    for (let i = snapshots.length - 1; i >= 1; i--) {
      if (snapshots[i - 1].timestamp < tenMinAgo) break
      const dt = (snapshots[i].timestamp - snapshots[i - 1].timestamp) / 60000
      const inc = snapshots[i][field] - snapshots[i - 1][field]
      if (dt > 0 && inc > 0) { perMin = parseFloat((inc / dt).toFixed(2)); break }
    }
  }
  if (!perMin) {
    // Fallback: total / minuto do jogo (usa o minuto do snapshot mais recente com minuto > 0)
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].gameMinute > 0 && snapshots[i][field] > 0) {
        perMin = parseFloat((snapshots[i][field] / snapshots[i].gameMinute).toFixed(2))
        break
      }
    }
  }

  // Janela 5 min
  let last5min: number | null = null
  if (span >= MIN_5) {
    const snap5    = closestSnapshot(snapshots, latest.timestamp - 5 * 60_000)
    const elapsed5 = (latest.timestamp - snap5.timestamp) / 60000
    if (elapsed5 >= 4) {
      last5min = parseFloat((Math.max(latest[field] - snap5[field], 0) / elapsed5).toFixed(2))
    }
  }

  // Janela 10 min
  let last10min: number | null = null
  if (span >= MIN_10) {
    const snap10    = closestSnapshot(snapshots, latest.timestamp - 10 * 60_000)
    const elapsed10 = (latest.timestamp - snap10.timestamp) / 60000
    if (elapsed10 >= 8) {
      last10min = parseFloat((Math.max(latest[field] - snap10[field], 0) / elapsed10).toFixed(2))
    }
  }

  const baseline = perMin ?? 0
  return {
    total,
    perMin,
    last5min,
    last5trend:  last5min != null ? calcTrend(last5min, baseline) : 'stable',
    last10min,
    last10trend: last10min != null ? calcTrend(last10min, baseline) : 'stable',
  }
}

export async function pollAttackStats(exchangeEventId: string, gameMinute = 0): Promise<void> {
  try {
    const { data } = await axios.get<Array<{ statId: number; homeTeamValue: number; awayTeamValue: number }>>(
      `${STATS_API}/${exchangeEventId}/statistics`,
      { timeout: 8000 }
    )

    const attacksRow   = data.find(s => s.statId === STAT_ATTACKS)
    const dangerousRow = data.find(s => s.statId === STAT_DANGEROUS)
    if (!attacksRow || !dangerousRow) return

    const now = Date.now()
    if (!store.has(exchangeEventId)) store.set(exchangeEventId, { home: [], away: [] })
    const entry = store.get(exchangeEventId)!

    entry.home.push({ timestamp: now, gameMinute, attacks: attacksRow.homeTeamValue, dangerous: dangerousRow.homeTeamValue })
    entry.away.push({ timestamp: now, gameMinute, attacks: attacksRow.awayTeamValue, dangerous: dangerousRow.awayTeamValue })

    if (entry.home.length > MAX_SNAPSHOTS) entry.home.shift()
    if (entry.away.length > MAX_SNAPSHOTS) entry.away.shift()
  } catch {
    // stats API pode estar indisponível — ignorar silenciosamente
  }
}

export function getAttackStats(exchangeEventId: string): AttackStats | null {
  const entry = store.get(exchangeEventId)
  if (!entry || entry.home.length === 0) return null

  return {
    home: {
      attacks:   calcRates(entry.home, 'attacks'),
      dangerous: calcRates(entry.home, 'dangerous'),
    },
    away: {
      attacks:   calcRates(entry.away, 'attacks'),
      dangerous: calcRates(entry.away, 'dangerous'),
    },
    updatedAt: entry.home[entry.home.length - 1].timestamp,
  }
}

export function clearAttackStats(exchangeEventId: string): void {
  store.delete(exchangeEventId)
}

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
  timestamp: number
  attacks:   number
  dangerous: number
}

interface SideSnapshots {
  home: AttackSnapshot[]
  away: AttackSnapshot[]
}

const store = new Map<string, SideSnapshots>()

export interface TeamAttackRates {
  total:       number
  perMin:      number
  last5min:    number
  last5trend:  'up' | 'down' | 'stable'
  last10min:   number
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

function calcRates(snapshots: AttackSnapshot[], field: 'attacks' | 'dangerous'): TeamAttackRates {
  if (snapshots.length === 0) {
    return { total: 0, perMin: 0, last5min: 0, last5trend: 'stable', last10min: 0, last10trend: 'stable' }
  }

  const latest  = snapshots[snapshots.length - 1]
  const oldest  = snapshots[0]
  const total   = latest[field]
  const ageMin  = Math.max((latest.timestamp - oldest.timestamp) / 60000, 1)
  const perMin  = parseFloat((total / ageMin).toFixed(2))

  const snap5      = closestSnapshot(snapshots, latest.timestamp - 5 * 60_000)
  const elapsed5   = Math.max((latest.timestamp - snap5.timestamp) / 60000, 1)
  const last5min   = parseFloat((Math.max(latest[field] - snap5[field], 0) / elapsed5).toFixed(2))

  const snap10     = closestSnapshot(snapshots, latest.timestamp - 10 * 60_000)
  const elapsed10  = Math.max((latest.timestamp - snap10.timestamp) / 60000, 1)
  const last10min  = parseFloat((Math.max(latest[field] - snap10[field], 0) / elapsed10).toFixed(2))

  return {
    total,
    perMin,
    last5min,
    last5trend:  calcTrend(last5min, perMin),
    last10min,
    last10trend: calcTrend(last10min, perMin),
  }
}

export async function pollAttackStats(exchangeEventId: string): Promise<void> {
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

    entry.home.push({ timestamp: now, attacks: attacksRow.homeTeamValue, dangerous: dangerousRow.homeTeamValue })
    entry.away.push({ timestamp: now, attacks: attacksRow.awayTeamValue, dangerous: dangerousRow.awayTeamValue })

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

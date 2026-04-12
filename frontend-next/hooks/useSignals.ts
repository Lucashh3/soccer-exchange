'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchSignals, fetchGamesToday, fetchHealth } from '@/lib/api'

const POLL = 5 * 60 * 1000   // 5 min
const STALE = 60_000          // 1 min

export function useSignals(filters?: { market?: string; minConfidence?: number; postLineup?: boolean }) {
  return useQuery({
    queryKey: ['signals', filters],
    queryFn: () => fetchSignals(filters),
    refetchInterval: POLL,
    staleTime: STALE,
  })
}

export function useGamesToday(filters?: { league?: string; hasSignal?: boolean }) {
  return useQuery({
    queryKey: ['games-today', filters],
    queryFn: () => fetchGamesToday(filters),
    refetchInterval: POLL,
    staleTime: STALE,
  })
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  })
}

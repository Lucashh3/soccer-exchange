'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCoachHistory, fetchCoachHistoryByDate } from '@/lib/api'

export function useCoachHistory(months = 3) {
  return useQuery({
    queryKey: ['coach-history', months],
    queryFn: () => fetchCoachHistory(months),
    staleTime: 60 * 60 * 1000, // 1h
    refetchInterval: false,
  })
}

export function useCoachHistoryByDate(date: string | null) {
  return useQuery({
    queryKey: ['coach-history-date', date],
    queryFn: () => fetchCoachHistoryByDate(date!),
    enabled: !!date,
    staleTime: 60 * 60 * 1000,
  })
}

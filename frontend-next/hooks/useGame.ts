'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchAnalysis } from '@/lib/api'

export function useAnalysis(gameId: string) {
  return useQuery({
    queryKey: ['analysis', gameId],
    queryFn: () => fetchAnalysis(gameId),
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  })
}

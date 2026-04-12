'use client'

import { useQuery } from '@tanstack/react-query'

interface LiveData {
  status: string
  minute?: string
  homeScore: number
  awayScore: number
  events?: Array<{
    type: string
    minute?: string
    team?: string
    player?: string
  }>
}

export function useLiveData(gameId: string) {
  return useQuery({
    queryKey: ['live', gameId],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gameId}/live`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`${res.status}`)
      return res.json() as Promise<LiveData>
    },
    refetchInterval: 30000,
    enabled: true,
  })
}
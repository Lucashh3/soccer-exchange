import { useQuery } from '@tanstack/react-query'
import { fetchCoachSuggestions } from '@/lib/api'

export function useCoachSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: ['coach-suggestions'],
    queryFn: fetchCoachSuggestions,
    enabled,
    refetchInterval: 30 * 60 * 1000, // 30 min
    staleTime: 25 * 60 * 1000,
  })
}

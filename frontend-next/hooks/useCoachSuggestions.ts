import { useQuery } from '@tanstack/react-query'
import { fetchCoachSuggestions } from '@/lib/api'

export function useCoachSuggestions(enabled: boolean) {
  return useQuery({
    queryKey: ['coach-suggestions'],
    queryFn: fetchCoachSuggestions,
    enabled,
    refetchInterval: false,
    staleTime: 24 * 60 * 60 * 1000, // 24h — análise pré-jogo, gerada uma vez por dia
  })
}

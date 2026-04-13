'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchCoach } from '@/lib/api'
import { useCoachToggle } from '@/hooks/useCoachToggle'
import { cn } from '@/lib/utils'

function actionLabel(action: 'entrar_back' | 'entrar_lay' | 'aguardar' | 'sair'): string {
  if (action === 'entrar_back') return 'ENTRAR BACK'
  if (action === 'entrar_lay') return 'ENTRAR LAY'
  if (action === 'sair') return 'SAIR'
  return 'AGUARDAR'
}

function marketLabel(market: string | null): string | null {
  if (!market) return null

  const map: Record<string, string> = {
    backHome: 'Back Casa',
    backAway: 'Back Visitante',
    layHome: 'Lay Casa',
    layAway: 'Lay Visitante',
    over25: 'Over 2.5',
    under25: 'Under 2.5',
    btts: 'BTTS',
  }

  return map[market] ?? market
}

function urgencyLabel(urgency: 'baixa' | 'media' | 'alta'): string {
  if (urgency === 'alta') return 'Alta'
  if (urgency === 'media') return 'Media'
  return 'Baixa'
}

function urgencyTone(urgency: 'baixa' | 'media' | 'alta'): string {
  if (urgency === 'alta') return 'text-rose-300'
  if (urgency === 'media') return 'text-amber-300'
  return 'text-emerald-300'
}

export function CoachCard({ gameId, isLive }: { gameId: string; isLive: boolean }) {
  const { enabled, toggle, ready } = useCoachToggle(gameId)

  const { data, isLoading } = useQuery({
    queryKey: ['coach', gameId, enabled, isLive],
    queryFn: () => fetchCoach(gameId, enabled),
    enabled: ready && enabled && isLive,
    refetchInterval: 60_000,
    staleTime: 55_000,
  })

  const confidence = Math.max(0, Math.min(100, Math.round(data?.confidence ?? 0)))
  const sideTone = data?.side === 'home' ? 'text-sky-400' : data?.side === 'away' ? 'text-orange-400' : 'text-muted-foreground'

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Coach IA</p>
          <p className="text-xs text-muted-foreground">Assistente de entrada in-play (atualiza a cada 1 min)</p>
        </div>
        <button
          onClick={toggle}
          className={cn(
            'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
            enabled
              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300'
              : 'border-border bg-background text-muted-foreground hover:text-foreground'
          )}
        >
          {enabled ? 'Coach ativo' : 'Ativar Coach'}
        </button>
      </div>

      {!enabled && (
        <p className="text-sm text-muted-foreground">Ative o Coach para receber sugestoes de entrada durante o jogo.</p>
      )}

      {enabled && !isLive && (
        <p className="text-sm text-muted-foreground">Coach ligado. Ele inicia automaticamente quando a partida estiver ao vivo.</p>
      )}

      {enabled && isLive && isLoading && (
        <p className="text-sm text-muted-foreground">Analisando contexto ao vivo...</p>
      )}

      {enabled && isLive && data?.status === 'ready' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs px-2 py-1 rounded border border-white/10 bg-white/5">{actionLabel(data.action)}</span>
            <span className={cn('text-xs font-medium', sideTone)}>
              {data.side === 'home' ? 'Casa' : data.side === 'away' ? 'Visitante' : 'Neutro'}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{data.text}</p>
          {data.exposure && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>Exposicao: {data.exposure.minMinutes}-{data.exposure.maxMinutes} min</span>
                <span>· Revisar aos {data.exposure.reviewAtMinute}'</span>
                <span className={cn('font-medium', urgencyTone(data.exposure.urgency))}>
                  · Urgencia: {urgencyLabel(data.exposure.urgency)}
                </span>
              </div>
              {data.exposure.exitTriggers.length > 0 && (
                <p className="text-xs text-muted-foreground leading-relaxed">Saida: {data.exposure.exitTriggers[0]}</p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Confianca {confidence}%</span>
            {data.market && <span>· Mercado: {marketLabel(data.market)}</span>}
            {data.fromCache && <span>· cache</span>}
          </div>
        </div>
      )}

      {enabled && isLive && data?.status === 'inactive' && (
        <p className="text-sm text-muted-foreground">Sem contexto ao vivo suficiente agora. Aguarde a proxima leitura.</p>
      )}
    </div>
  )
}

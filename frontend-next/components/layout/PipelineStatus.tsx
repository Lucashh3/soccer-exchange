'use client'

import { useHealth } from '@/hooks/useSignals'
import { cn } from '@/lib/utils'

export function PipelineStatus() {
  const { data, isLoading } = useHealth()

  const ok = !isLoading && data?.status === 'ok'

  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          isLoading ? 'bg-muted-foreground animate-pulse' :
          ok ? 'bg-emerald-400' : 'bg-red-400'
        )}
        style={ok ? { boxShadow: '0 0 6px rgba(52,211,153,0.7)' } : undefined}
      />
      <span className="text-muted-foreground hidden sm:inline font-mono">
        {isLoading ? '...' : ok
          ? `${data.gamesLoaded}j · ${data.signalsGenerated}s`
          : 'offline'
        }
      </span>
    </div>
  )
}

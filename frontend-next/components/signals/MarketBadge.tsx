import type { MarketType } from '@/types'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const MARKET_CONFIG: Record<MarketType, {
  label: string
  color: string
  bg: string
  border: string
  glow: string
}> = {
  over25:   { label: 'Over 2.5',     color: '#f97316', bg: 'rgba(249,115,22,0.12)',   border: 'rgba(249,115,22,0.3)',   glow: 'glow-over'  },
  under25:  { label: 'Under 2.5',    color: '#818cf8', bg: 'rgba(129,140,248,0.12)',  border: 'rgba(129,140,248,0.3)',  glow: ''           },
  lay00:    { label: 'Lay 0-0',      color: '#a855f7', bg: 'rgba(168,85,247,0.12)',   border: 'rgba(168,85,247,0.3)',   glow: ''           },
  value:    { label: 'Value',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',   border: 'rgba(251,191,36,0.3)',   glow: ''           },
  backHome: { label: 'Back Casa',    color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',   border: 'rgba(56,189,248,0.3)',   glow: 'glow-back'  },
  layHome:  { label: 'Lay Casa',     color: '#fb7185', bg: 'rgba(251,113,133,0.12)',  border: 'rgba(251,113,133,0.3)',  glow: 'glow-lay'   },
  backAway: { label: 'Back Visit.',  color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',   border: 'rgba(56,189,248,0.25)',  glow: 'glow-back'  },
  layAway:  { label: 'Lay Visit.',   color: '#fb7185', bg: 'rgba(251,113,133,0.08)',  border: 'rgba(251,113,133,0.25)', glow: 'glow-lay'   },
}

interface Props {
  market: MarketType
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function MarketBadge({ market, size = 'sm', className }: Props) {
  const c = MARKET_CONFIG[market]
  const sizeClass = size === 'lg' ? 'px-3 py-1 text-sm' : size === 'md' ? 'px-2.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs'

  if (!c) return null

  return (
    <Badge
      variant="outline"
      className={cn('font-semibold rounded-xl border font-mono tracking-wide', sizeClass, className)}
      style={{
        color: c.color,
        backgroundColor: c.bg,
        borderColor: c.border,
        boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.06)`,
      }}
    >
      {c.label}
    </Badge>
  )
}

export function marketColor(m: MarketType) { return MARKET_CONFIG[m]?.color ?? '#6b7280' }

interface Props {
  label: string
  home?: number | null
  away?: number | null
  format?: 'num' | 'pct'
  higherIsBetter?: boolean
}

function fmt(v: number | undefined | null, format: 'num' | 'pct') {
  if (v == null) return '—'
  return format === 'pct' ? `${(v * 100).toFixed(0)}%` : v.toFixed(2)
}

export function StatRow({ label, home, away, format = 'num', higherIsBetter = true }: Props) {
  const homeWins = home != null && away != null && (higherIsBetter ? home > away : home < away)
  const awayWins = home != null && away != null && (higherIsBetter ? away > home : away < home)

  return (
    <div className="flex items-center py-2 border-b border-border/50 last:border-0">
      <span
        className={`w-16 text-right text-sm font-mono tabular-nums ${homeWins ? 'text-sky-400 font-semibold' : 'text-foreground/70'}`}
      >
        {fmt(home, format)}
      </span>
      <span className="flex-1 text-center text-xs text-muted-foreground uppercase tracking-widest px-3">
        {label}
      </span>
      <span
        className={`w-16 text-left text-sm font-mono tabular-nums ${awayWins ? 'text-orange-400 font-semibold' : 'text-foreground/70'}`}
      >
        {fmt(away, format)}
      </span>
    </div>
  )
}

'use client'

import { cn } from '@/lib/utils'

interface ChipOption { label: string; value: number }

interface FilterChipGroupProps {
  label: string
  options: ChipOption[]
  value: number
  onChange: (v: number) => void
  format?: 'pct' | 'dec'
}

export function FilterChipGroup({ label, options, value, onChange, format = 'pct' }: FilterChipGroupProps) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'px-2 py-1 rounded text-xs font-mono transition-all border',
              value === opt.value
                ? 'bg-primary/15 text-primary border-primary/40'
                : 'bg-transparent text-muted-foreground border-border hover:border-white/20 hover:text-foreground'
            )}
          >
            {format === 'pct' ? `${opt.value}%` : opt.value.toFixed(1)}
          </button>
        ))}
      </div>
    </div>
  )
}

interface ToggleChipProps {
  label: string
  active: boolean
  onChange: (v: boolean) => void
}

export function ToggleChip({ label, active, onChange }: ToggleChipProps) {
  return (
    <button
      onClick={() => onChange(!active)}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
        active
          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
          : 'bg-transparent text-muted-foreground border-border hover:border-white/20 hover:text-foreground'
      )}
    >
      {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
      {label}
    </button>
  )
}

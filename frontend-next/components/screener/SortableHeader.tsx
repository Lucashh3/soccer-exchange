'use client'

import { cn } from '@/lib/utils'

type Direction = 'asc' | 'desc' | null

interface Props {
  label: string
  field: string
  current: { field: string; dir: Direction }
  onSort: (field: string) => void
  className?: string
}

export function SortableHeader({ label, field, current, onSort, className }: Props) {
  const active = current.field === field
  const dir = active ? current.dir : null

  return (
    <th
      className={cn(
        'text-xs uppercase tracking-widest px-3 py-3 font-medium cursor-pointer select-none whitespace-nowrap',
        active ? 'text-foreground/80' : 'text-muted-foreground hover:text-foreground/60',
        className
      )}
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1 justify-end">
        {label}
        <span className="font-mono text-[9px]">
          {dir === 'asc' ? '↑' : dir === 'desc' ? '↓' : '⇅'}
        </span>
      </span>
    </th>
  )
}

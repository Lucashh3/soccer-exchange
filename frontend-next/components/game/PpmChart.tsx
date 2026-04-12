'use client'

import type { PpmBlock, EntrySignal } from '@/lib/ppm'

interface Props {
  blocks: PpmBlock[]
  signal: EntrySignal | null
  homeTeam: string
  awayTeam: string
}

const RECOMMENDATION_LABEL: Record<string, string> = {
  strong:   'FORTE',
  moderate: 'MODERADO',
  weak:     'FRACO',
}

const RECOMMENDATION_COLOR: Record<string, string> = {
  strong:   'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
  moderate: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  weak:     'text-muted-foreground bg-white/5 border-border',
}

export function PpmChart({ blocks, signal, homeTeam, awayTeam }: Props) {
  if (!blocks.length) return null

  const maxIntensity = Math.max(...blocks.map(b => b.intensity), 0.1)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground/50 text-[10px] uppercase tracking-widest">
          Pressão por Bloco (PPM)
        </span>
      </div>

      {/* Block visualization */}
      <div className="flex gap-1 items-end" style={{ height: '52px' }}>
        {blocks.map((block, i) => {
          const heightPct = (block.intensity / maxIntensity) * 100
          const color =
            block.side === 'home'
              ? `rgba(56,189,248,${0.3 + block.intensity * 0.6})`
              : block.side === 'away'
              ? `rgba(251,146,60,${0.3 + block.intensity * 0.6})`
              : 'rgba(255,255,255,0.12)'
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <span className="text-[9px] font-mono text-muted-foreground/50 tabular-nums">
                {block.value > 0 ? '+' : ''}{block.value.toFixed(1)}
              </span>
              <div className="w-full flex items-end" style={{ height: '32px' }}>
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max(heightPct, 8)}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums">
                {block.from}–{block.to}
              </span>
            </div>
          )
        })}
      </div>

      {/* Entry signal */}
      {signal && signal.recommendation !== 'none' && (
        <div className="rounded-lg border p-3 space-y-1.5 bg-white/[0.02]"
          style={{
            borderColor: signal.side === 'home' ? 'rgba(56,189,248,0.2)' : 'rgba(251,146,60,0.2)',
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${RECOMMENDATION_COLOR[signal.recommendation]}`}>
              {RECOMMENDATION_LABEL[signal.recommendation]}
            </span>
            <span className={`text-sm font-bold font-mono ${signal.side === 'home' ? 'text-sky-400' : 'text-orange-400'}`}>
              ↑ {signal.side === 'home' ? homeTeam : awayTeam}
            </span>
            <span className="text-xs font-mono text-muted-foreground ml-auto">
              Score {signal.score}/100
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground/70 italic leading-snug">
            {signal.reason}
          </p>
        </div>
      )}
    </div>
  )
}

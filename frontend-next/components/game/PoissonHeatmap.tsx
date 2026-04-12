'use client'

import { useMemo } from 'react'
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'

function poissonProb(lambda: number, k: number): number {
  let result = Math.exp(-lambda)
  for (let i = 1; i <= k; i++) result *= lambda / i
  return result
}

function buildMatrix(homeGoals: number, awayGoals: number, size = 5) {
  const matrix: number[][] = []
  let max = 0
  for (let h = 0; h < size; h++) {
    matrix[h] = []
    for (let a = 0; a < size; a++) {
      const p = poissonProb(homeGoals, h) * poissonProb(awayGoals, a)
      matrix[h][a] = p
      if (p > max) max = p
    }
  }
  return { matrix, max }
}

interface Props {
  homeGoals: number
  awayGoals: number
  homeTeam: string
  awayTeam: string
}

export function PoissonHeatmap({ homeGoals, awayGoals, homeTeam, awayTeam }: Props) {
  const { matrix, max } = useMemo(() => buildMatrix(homeGoals, awayGoals), [homeGoals, awayGoals])

  return (
    <TooltipProvider>
      <div>
        {/* Away goals header */}
        <div className="flex mb-1 ml-6">
          {[0,1,2,3,4].map(a => (
            <div key={a} className="w-10 text-center text-xs text-muted-foreground font-mono">{a}</div>
          ))}
        </div>

        {matrix.map((row, h) => (
          <div key={h} className="flex items-center mb-1">
            {/* Home goals label */}
            <div className="w-5 text-right text-xs text-muted-foreground font-mono mr-1">{h}</div>
            {row.map((prob, a) => {
              const intensity = max > 0 ? prob / max : 0
              const alpha = 0.08 + intensity * 0.72
              const pct = (prob * 100).toFixed(1)
              return (
                <Tooltip key={a}>
                  <TooltipTrigger>
                    <div
                      className="w-10 h-9 rounded flex items-center justify-center cursor-default transition-opacity hover:opacity-80 mx-0.5 font-mono text-xs"
                      style={{ backgroundColor: `rgba(56,189,248,${alpha.toFixed(2)})` }}
                    >
                      <span style={{ color: alpha > 0.5 ? '#090b12' : '#e8eaf0' }}>
                        {pct}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-mono text-xs">
                    {homeTeam} {h} – {a} {awayTeam}: {pct}%
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ))}

        {/* Labels */}
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>↑ {homeTeam} (casa)</span>
          <span>{awayTeam} (visit.) →</span>
        </div>
      </div>
    </TooltipProvider>
  )
}

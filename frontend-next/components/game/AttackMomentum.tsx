'use client'

import type { MomentumPoint } from '@/lib/api'

export interface EventMarker {
  type: 'goal' | 'shotOnGoal' | 'shot' | 'corner' | 'card'
  minute: number
  isHome: boolean
  cardClass?: 'yellow' | 'red' | 'yellowRed'
}

interface Props {
  points: MomentumPoint[]
  homeTeam: string
  awayTeam: string
  periodTime?: number
  events?: EventMarker[]
}

function MarkerIcon({ type, cardClass }: { type: EventMarker['type']; cardClass?: EventMarker['cardClass'] }) {
  if (type === 'goal') {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10">
        <circle cx="5" cy="5" r="4.5" fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
        <circle cx="5" cy="5" r="2" fill="rgba(0,0,0,0.25)" />
        <circle cx="3.2" cy="3.2" r="1" fill="rgba(0,0,0,0.18)" />
        <circle cx="6.8" cy="3.2" r="1" fill="rgba(0,0,0,0.18)" />
        <circle cx="5" cy="7" r="1" fill="rgba(0,0,0,0.18)" />
      </svg>
    )
  }
  if (type === 'shotOnGoal') {
    return <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.8)]" />
  }
  if (type === 'shot') {
    return <div className="w-1.5 h-1.5 rounded-full bg-sky-400 opacity-70" />
  }
  if (type === 'corner') {
    return (
      <svg width="8" height="9" viewBox="0 0 8 9">
        <rect x="0" y="6" width="1.5" height="3" fill="rgba(255,255,255,0.5)" rx="0.5" />
        <polygon points="1.5,0 1.5,6 8,3" fill="rgba(251,146,60,0.9)" />
      </svg>
    )
  }
  if (type === 'card') {
    const color = cardClass === 'red' ? '#f87171' : cardClass === 'yellowRed' ? '#fb923c' : '#fbbf24'
    return (
      <svg width="6" height="9" viewBox="0 0 6 9">
        <rect x="0" y="0" width="6" height="9" rx="1" fill={color} />
      </svg>
    )
  }
  return null
}

export function AttackMomentum({ points, homeTeam, awayTeam, periodTime = 45, events = [] }: Props) {
  if (!points.length) return (
    <p className="text-sm text-muted-foreground text-center py-4">Sem dados de momentum</p>
  )

  const TOTAL = 90
  const W = 600
  const H = 120
  const midY = H / 2
  const maxVal = Math.max(...points.map(p => Math.abs(p.value)), 1)

  const toX = (minute: number) => (minute / TOTAL) * W

  // Bar width: one slot per minute across the full 90-min range
  const barW = Math.max(W / TOTAL - 0.5, 1)

  const htX = toX(periodTime)

  const recentPoints = points.slice(-10)
  const recentAvg = recentPoints.reduce((s, p) => s + p.value, 0) / recentPoints.length
  const dominantHome = recentAvg > 0

  const homeMarkers = events.filter(e => e.isHome)
  const awayMarkers = events.filter(e => !e.isHome)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className={`font-medium ${dominantHome ? 'text-sky-400' : 'text-muted-foreground'}`}>
          {homeTeam}
        </span>
        <span className="text-muted-foreground/50 text-[10px] uppercase tracking-widest">Momentum</span>
        <span className={`font-medium ${!dominantHome ? 'text-orange-400' : 'text-muted-foreground'}`}>
          {awayTeam}
        </span>
      </div>

      <div className="rounded-lg bg-white/[0.03] border border-border/50 overflow-hidden">
        {/* Home markers row — above the bars */}
        <div className="relative w-full" style={{ height: '14px' }}>
          {homeMarkers.map((ev, i) => (
            <div
              key={`h-${i}`}
              className="absolute flex items-center justify-center"
              style={{ left: `${(ev.minute / TOTAL) * 100}%`, top: 0, bottom: 0, transform: 'translateX(-50%)' }}
            >
              <MarkerIcon type={ev.type} cardClass={ev.cardClass} />
            </div>
          ))}
        </div>

        {/* Bars SVG */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: '70px', display: 'block' }}
        >
          <line x1="0" y1={midY} x2={W} y2={midY} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
          <line x1={htX} y1="0" x2={htX} y2={H} stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3,3" />
          {points.map((p, i) => {
            const x = toX(p.minute) - barW / 2
            if (p.value === 0) return null
            const isHome = p.value > 0
            const barH = (Math.abs(p.value) / maxVal) * (midY - 4)
            const y = isHome ? midY - barH : midY
            return (
              <rect key={i} x={x} y={y} width={barW} height={barH}
                fill={isHome ? 'rgba(56,189,248,0.55)' : 'rgba(251,146,60,0.55)'}
                rx="1"
              />
            )
          })}
        </svg>

        {/* Away markers row — below the bars */}
        <div className="relative w-full" style={{ height: '14px' }}>
          {awayMarkers.map((ev, i) => (
            <div
              key={`a-${i}`}
              className="absolute flex items-center justify-center"
              style={{ left: `${(ev.minute / TOTAL) * 100}%`, top: 0, bottom: 0, transform: 'translateX(-50%)' }}
            >
              <MarkerIcon type={ev.type} cardClass={ev.cardClass} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-muted-foreground/40 font-mono px-0.5">
        <span>0'</span>
        <span>{periodTime}'</span>
        <span>{TOTAL}'</span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 flex-wrap">
        <span className="flex items-center gap-1">
          <svg width="8" height="8" viewBox="0 0 10 10">
            <circle cx="5" cy="5" r="4.5" fill="white" stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
            <circle cx="5" cy="5" r="2" fill="rgba(0,0,0,0.25)" />
          </svg>
          Gol
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-400" />
          Chute a gol
        </span>
        <span className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-sky-400 opacity-70" />
          Chute
        </span>
        <span className="flex items-center gap-1">
          <svg width="8" height="9" viewBox="0 0 8 9">
            <rect x="0" y="6" width="1.5" height="3" fill="rgba(255,255,255,0.5)" rx="0.5" />
            <polygon points="1.5,0 1.5,6 8,3" fill="rgba(251,146,60,0.9)" />
          </svg>
          Escanteio
        </span>
        <span className="flex items-center gap-1">
          <svg width="6" height="9" viewBox="0 0 6 9"><rect x="0" y="0" width="6" height="9" rx="1" fill="#fbbf24" /></svg>
          <svg width="6" height="9" viewBox="0 0 6 9"><rect x="0" y="0" width="6" height="9" rx="1" fill="#f87171" /></svg>
          Cartão
        </span>
      </div>
    </div>
  )
}

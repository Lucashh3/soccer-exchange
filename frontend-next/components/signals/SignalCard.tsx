'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MarketBadge, marketColor, MARKET_CONFIG } from './MarketBadge'
import type { Game } from '@/types'
import { cn } from '@/lib/utils'
import { TeamLogo } from '@/components/ui/TeamLogo'
import type { EntrySignal } from '@/lib/ppm'

// ── Momentum chart ────────────────────────────────────────────────────────────

interface MomentumPoint { minute: number; value: number }
interface EventMarker { type: 'goal' | 'shotOnGoal' | 'shot' | 'corner' | 'card'; minute: number; isHome: boolean; cardClass?: string }

interface TooltipState { minute: number; value: number; xPct: number }

function MiniMomentum({ points, events = [] }: { points: MomentumPoint[]; events?: EventMarker[] }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const TOTAL = 90
  const W     = 400
  const H     = 80        // internal SVG height — taller bars
  const midY  = H / 2
  const maxVal = Math.max(...points.map(p => Math.abs(p.value)), 1)
  const toX    = (m: number) => (m / TOTAL) * W
  const barW   = Math.max(W / TOTAL - 0.5, 1.2)
  // hit-area width per bar for hover — wider than the visual bar
  const hitW   = Math.max(W / TOTAL, 3)

  const markerColor = (ev: EventMarker) => {
    if (ev.type === 'goal')       return 'rgba(255,255,255,0.95)'
    if (ev.type === 'shotOnGoal') return 'rgba(52,211,153,0.9)'
    if (ev.type === 'corner')     return 'rgba(251,146,60,0.75)'
    if (ev.type === 'card')       return ev.cardClass === 'red' ? '#f87171' : ev.cardClass === 'yellowRed' ? '#fb923c' : '#fbbf24'
    return 'rgba(56,189,248,0.65)'
  }
  const markerR = (type: EventMarker['type']) => type === 'goal' ? 4 : type === 'shotOnGoal' ? 2.5 : 2

  const homeEvents = events.filter(e => e.isHome)
  const awayEvents = events.filter(e => !e.isHome)

  // clamp tooltip so it doesn't overflow the card edges
  const tooltipLeft = (xPct: number) =>
    xPct < 12 ? '0%' : xPct > 88 ? '100%' : `${xPct}%`
  const tooltipTranslate = (xPct: number) =>
    xPct < 12 ? 'translateX(0)' : xPct > 88 ? 'translateX(-100%)' : 'translateX(-50%)'

  return (
    <div className="w-full relative select-none">

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-20 pointer-events-none bottom-[calc(100%-14px)] mb-1"
          style={{
            left: tooltipLeft(tooltip.xPct),
            transform: tooltipTranslate(tooltip.xPct),
          }}
        >
          <div className="rounded-lg px-2 py-1 text-[10px] font-mono leading-tight whitespace-nowrap shadow-lg"
            style={{
              background: 'rgba(9,11,18,0.92)',
              border: `1px solid ${tooltip.value >= 0 ? 'rgba(56,189,248,0.30)' : 'rgba(251,146,60,0.30)'}`,
              color: tooltip.value >= 0 ? 'rgba(56,189,248,0.95)' : 'rgba(251,146,60,0.95)',
            }}
          >
            <span className="text-white/50">{tooltip.minute}&apos;</span>
            {' '}
            <span className="font-semibold">
              PPM {tooltip.value >= 0 ? '+' : ''}{tooltip.value.toFixed(1)}
            </span>
          </div>
          {/* Arrow */}
          <div className="w-2 h-1 mx-auto overflow-hidden" style={{ marginTop: -1 }}>
            <div className="w-2 h-2 rotate-45 -translate-y-1 mx-auto"
              style={{ background: tooltip.value >= 0 ? 'rgba(56,189,248,0.30)' : 'rgba(251,146,60,0.30)' }} />
          </div>
        </div>
      )}

      {/* Home event markers */}
      <div className="relative w-full" style={{ height: 14 }}>
        {homeEvents.map((ev, i) => (
          <div key={i} className="absolute flex items-center justify-center"
            style={{ left: `${(ev.minute / TOTAL) * 100}%`, top: 0, bottom: 0, transform: 'translateX(-50%)' }}>
            <div className="shrink-0" style={{
              width:  ev.type === 'card' ? 3 : markerR(ev.type) * 2,
              height: ev.type === 'card' ? 5 : markerR(ev.type) * 2,
              borderRadius: ev.type === 'card' ? 1 : '50%',
              backgroundColor: markerColor(ev),
              boxShadow: ev.type === 'goal' ? '0 0 5px rgba(255,255,255,0.8)' : 'none',
            }} />
          </div>
        ))}
      </div>

      {/* SVG chart */}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        preserveAspectRatio="none"
        style={{ height: 110, display: 'block' }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="gradHome" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="rgba(56,189,248,0.25)" />
            <stop offset="100%" stopColor="rgba(56,189,248,0.70)" />
          </linearGradient>
          <linearGradient id="gradAway" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(251,146,60,0.25)" />
            <stop offset="100%" stopColor="rgba(251,146,60,0.70)" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1="0" y1={midY} x2={W} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth="0.8" />
        <line x1={toX(45)} y1="0" x2={toX(45)} y2={H}
          stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" strokeDasharray="3,3" />

        {/* Quarter lines (faint) */}
        {[22, 67].map(m => (
          <line key={m} x1={toX(m)} y1="0" x2={toX(m)} y2={H}
            stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" strokeDasharray="2,4" />
        ))}

        {/* Bars */}
        {points.map((p, i) => {
          if (p.value === 0) return null
          const isHome = p.value > 0
          const barH   = (Math.abs(p.value) / maxVal) * (midY - 3)
          return (
            <rect key={i}
              x={toX(p.minute) - barW / 2}
              y={isHome ? midY - barH : midY}
              width={barW} height={barH}
              fill={isHome ? 'url(#gradHome)' : 'url(#gradAway)'}
              rx="0.8"
            />
          )
        })}

        {/* Invisible hit-area rects for hover */}
        {points.map((p, i) => (
          <rect key={`hit-${i}`}
            x={toX(p.minute) - hitW / 2} y={0}
            width={hitW} height={H}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setTooltip({ minute: p.minute, value: p.value, xPct: (p.minute / TOTAL) * 100 })}
          />
        ))}

        {/* Highlight hovered bar */}
        {tooltip && (() => {
          const p = points.find(pt => pt.minute === tooltip.minute)
          if (!p || p.value === 0) return null
          const isHome = p.value > 0
          const barH   = (Math.abs(p.value) / maxVal) * (midY - 3)
          return (
            <rect
              x={toX(p.minute) - barW / 2 - 0.5}
              y={isHome ? midY - barH - 0.5 : midY - 0.5}
              width={barW + 1} height={barH + 1}
              fill="none"
              stroke={isHome ? 'rgba(56,189,248,0.8)' : 'rgba(251,146,60,0.8)'}
              strokeWidth="0.8"
              rx="0.8"
            />
          )
        })()}
      </svg>

      {/* Away event markers */}
      <div className="relative w-full" style={{ height: 14 }}>
        {awayEvents.map((ev, i) => (
          <div key={i} className="absolute flex items-center justify-center"
            style={{ left: `${(ev.minute / TOTAL) * 100}%`, top: 0, bottom: 0, transform: 'translateX(-50%)' }}>
            <div className="shrink-0" style={{
              width:  ev.type === 'card' ? 3 : markerR(ev.type) * 2,
              height: ev.type === 'card' ? 5 : markerR(ev.type) * 2,
              borderRadius: ev.type === 'card' ? 1 : '50%',
              backgroundColor: markerColor(ev),
              boxShadow: ev.type === 'goal' ? '0 0 5px rgba(255,255,255,0.8)' : 'none',
            }} />
          </div>
        ))}
      </div>

    </div>
  )
}

// ── Confidence bar ────────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const gradient = pct >= 80
    ? 'linear-gradient(90deg, #10b981, #34d399)'
    : pct >= 65
    ? 'linear-gradient(90deg, #d97706, #fbbf24)'
    : 'linear-gradient(90deg, #4b5563, #6b7280)'
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-0.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: gradient }} />
      </div>
      <span className="text-[11px] font-mono text-muted-foreground/60 tabular-nums w-7 text-right">{pct}%</span>
    </div>
  )
}

// ── Stat dual-bar ─────────────────────────────────────────────────────────────

function StatBar({ label, home, away, isPercent = false, decimals = 0 }: {
  label: string; home: number; away: number; isPercent?: boolean; decimals?: number
}) {
  const total = home + away || 1
  const homePct = Math.round((home / total) * 100)
  const awayPct = 100 - homePct
  const fmt = (v: number) => isPercent ? `${v.toFixed(decimals)}%` : v.toFixed(decimals)

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-1">
        <span className="text-[11px] font-mono font-semibold text-sky-400 tabular-nums w-9 text-left">{fmt(home)}</span>
        <span className="text-[9px] text-muted-foreground/45 uppercase tracking-wider text-center flex-1">{label}</span>
        <span className="text-[11px] font-mono font-semibold text-orange-400 tabular-nums w-9 text-right">{fmt(away)}</span>
      </div>
      <div className="flex gap-0.5 h-[3px] rounded-full overflow-hidden">
        <div className="rounded-l-full transition-all duration-700"
          style={{ width: `${homePct}%`, background: 'linear-gradient(90deg, rgba(56,189,248,0.25), rgba(56,189,248,0.6))' }} />
        <div className="rounded-r-full transition-all duration-700"
          style={{ width: `${awayPct}%`, background: 'linear-gradient(90deg, rgba(251,146,60,0.6), rgba(251,146,60,0.25))' }} />
      </div>
    </div>
  )
}

// ── Mini SVG Donut ────────────────────────────────────────────────────────────

const HOME_CLR  = 'rgba(56,189,248,0.80)'
const AWAY_CLR  = 'rgba(251,146,60,0.80)'
const TRACK_CLR = 'rgba(255,255,255,0.05)'

function MiniDonut({ homeVal, awayVal, title }: { homeVal: number; awayVal: number; title: string }) {
  const R = 16, CX = 22, CY = 22, SW = 5
  const circ = 2 * Math.PI * R
  const total = homeVal + awayVal || 1
  const homeArc = (homeVal / total) * circ
  const awayArc = circ - homeArc

  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span className="text-[9px] text-muted-foreground/45 uppercase tracking-wider">{title}</span>
      <div className="relative" style={{ width: 44, height: 44 }}>
        <svg width="44" height="44" viewBox="0 0 44 44">
          {/* Track */}
          <circle cx={CX} cy={CY} r={R} fill="none" stroke={TRACK_CLR} strokeWidth={SW} />
          {/* Away arc */}
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke={AWAY_CLR} strokeWidth={SW}
            strokeDasharray={`${awayArc} ${circ}`}
            strokeDashoffset={-homeArc}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
          {/* Home arc */}
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke={HOME_CLR} strokeWidth={SW}
            strokeDasharray={`${homeArc} ${circ}`}
            strokeDashoffset={0}
            strokeLinecap="butt"
            transform={`rotate(-90 ${CX} ${CY})`}
          />
        </svg>
        {/* Center values */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-px">
          <span className="text-[8px] font-bold font-mono leading-none" style={{ color: HOME_CLR }}>{homeVal}</span>
          <span className="text-[6px] text-muted-foreground/30 leading-none">vs</span>
          <span className="text-[8px] font-bold font-mono leading-none" style={{ color: AWAY_CLR }}>{awayVal}</span>
        </div>
      </div>
    </div>
  )
}

// ── Attack rate table ─────────────────────────────────────────────────────────

type Trend = 'up' | 'down' | 'stable'

function TrendIcon({ t }: { t: Trend }) {
  if (t === 'up')   return <span className="text-emerald-400">↑</span>
  if (t === 'down') return <span className="text-red-400/70">↓</span>
  return <span className="text-muted-foreground/30">→</span>
}

interface AttackRates {
  total: number
  perMin: number | null
  last5min: number | null
  last5trend: Trend
  last10min: number | null
  last10trend: Trend
}

function RateTable({ home, away }: { home: AttackRates; away: AttackRates }) {
  const row = (
    label: string,
    hVal: number | null,
    hTrend: Trend | null,
    aVal: number | null,
    aTrend: Trend | null,
  ) => (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-1">
      <span className="flex items-center gap-0.5 text-[10px] font-mono text-sky-300/80 tabular-nums">
        {hVal != null ? hVal : <span className="text-muted-foreground/30">—</span>}
        {hTrend && hVal != null && <TrendIcon t={hTrend} />}
      </span>
      <span className="text-[8px] text-muted-foreground/35 uppercase tracking-wide text-center w-7">{label}</span>
      <span className="flex items-center justify-end gap-0.5 text-[10px] font-mono text-orange-300/80 tabular-nums">
        {aTrend && aVal != null && <TrendIcon t={aTrend} />}
        {aVal != null ? aVal : <span className="text-muted-foreground/30">—</span>}
      </span>
    </div>
  )

  return (
    <div className="space-y-0.5 w-full">
      {row('/min',  home.perMin,   null,           away.perMin,   null)}
      {row('5min',  home.last5min, home.last5trend, away.last5min, away.last5trend)}
      {row('10min', home.last10min, home.last10trend, away.last10min, away.last10trend)}
    </div>
  )
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function kickoffBRT(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
  })
}

function parseStat(v: string | number | null | undefined): number {
  if (v == null) return 0
  const n = parseFloat(String(v).replace('%', ''))
  return isNaN(n) ? 0 : n
}

// ── Live data types ───────────────────────────────────────────────────────────

interface LiveData {
  status: string
  minute?: string
  clock?: { minute?: number; display?: string; phase?: string; period?: number | null }
  homeScore: number
  awayScore: number
  events?: { type: string; minute: number; isHome: boolean; class?: string }[]
}

interface StatEntry { name: string; home: string | number | null; away: string | number | null }

interface LiveStats {
  xg:            { home: number; away: number } | null
  possession:    { home: number; away: number } | null
  shots:         { home: number; away: number } | null
  shotsOnTarget: { home: number; away: number } | null
  corners:       { home: number; away: number } | null
}

function parseLiveStats(stats: StatEntry[]): LiveStats {
  const find = (...terms: string[]) =>
    stats.find(s => terms.some(t => s.name.toLowerCase().includes(t.toLowerCase())))

  const xgStat       = find('expected goals', 'xgoal', 'xg')
  const possession   = find('possession')
  const totalShots   = find('total shots', 'shots total')
    ?? stats.find(s => /^shots$/i.test(s.name.trim()))
  const shotsOnTarget = find('shots on target', 'on target')
  const corners      = find('corner')

  return {
    xg:            xgStat        ? { home: parseStat(xgStat.home),        away: parseStat(xgStat.away)        } : null,
    possession:    possession    ? { home: parseStat(possession.home),    away: parseStat(possession.away)    } : null,
    shots:         totalShots    ? { home: parseStat(totalShots.home),    away: parseStat(totalShots.away)    } : null,
    shotsOnTarget: shotsOnTarget ? { home: parseStat(shotsOnTarget.home), away: parseStat(shotsOnTarget.away) } : null,
    corners:       corners       ? { home: parseStat(corners.home),       away: parseStat(corners.away)       } : null,
  }
}

interface AttackStats {
  home: { attacks: AttackRates; dangerous: AttackRates }
  away: { attacks: AttackRates; dangerous: AttackRates }
}

// ── Card ──────────────────────────────────────────────────────────────────────

interface Props {
  game: Game
  className?: string
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
}

export function SignalCard({ game, className, isFavorite = false, onToggleFavorite }: Props) {
  const router = useRouter()
  const [liveData,    setLiveData]    = useState<LiveData | null>(null)
  const [liveStats,   setLiveStats]   = useState<LiveStats>({ possession: null, shotsOnTarget: null, corners: null, xg: null })
  const [attackStats, setAttackStats] = useState<AttackStats | null>(null)
  const [momentumPoints, setMomentumPoints] = useState<MomentumPoint[]>([])
  const [ppmSignal,   setPpmSignal]   = useState<EntrySignal | null>(null)

  const signal     = game.topSignal
  const isLive     = game.status === 'inprogress' || game.status === 'halftime'
  const isFinished = game.status === 'finished'   || game.status === 'completed'
  const hasScore   = (isLive || isFinished) && game.homeScore != null && game.awayScore != null

  const displayHomeScore = liveData ? liveData.homeScore : (game.homeScore ?? 0)
  const displayAwayScore = liveData ? liveData.awayScore : (game.awayScore ?? 0)

  const isHalftime = (liveData?.clock?.phase ?? '').toLowerCase() === 'halftime'
    || (liveData?.status ?? game.status) === 'halftime'

  const minuteDisplay = isHalftime
    ? 'INT'
    : (liveData?.clock?.display ?? liveData?.minute)
    ? `${liveData?.clock?.display ?? liveData?.minute}'`
    : 'AO VIVO'

  // ── Data fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!isLive) return

    const sig = AbortSignal.timeout(5000)

    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/live`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          const LIVE = new Set(['inprogress', 'halftime', 'finished', 'pause', 'interrupted', 'overtime', 'penaltyshootout', 'awaiting'])
          if (LIVE.has(data.status)) setLiveData(data)
        }
      } catch {}
    }

    const fetchMatchStats = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/live-stats`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.stats) && data.stats.length > 0) setLiveStats(parseLiveStats(data.stats))
        }
      } catch {}
    }

    const fetchAttack = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/attack-stats`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          if (data?.home && data?.away) setAttackStats(data)
        }
      } catch {}
    }

    const fetchMomentum = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/graph`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          if (data.points?.length > 0) setMomentumPoints(data.points)
        }
      } catch {}
    }

    const fetchPpm = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/ppm`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          setPpmSignal(data.signal?.score >= 50 ? data.signal : null)
        }
      } catch {}
    }

    fetchLive(); fetchMatchStats(); fetchAttack(); fetchMomentum(); fetchPpm()
    const interval = setInterval(() => {
      fetchLive(); fetchMatchStats(); fetchAttack(); fetchMomentum(); fetchPpm()
    }, 30_000)
    return () => clearInterval(interval)
  }, [game.id, game.status])

  // ── Pressure detection ──────────────────────────────────────────────────────

  const pressure = useMemo(() => {
    if (!isLive || momentumPoints.length < 4) return null
    const recent = momentumPoints.slice(-8)
    const avg = recent.reduce((s, p) => s + p.value, 0) / recent.length
    const maxVal = Math.max(...momentumPoints.map(p => Math.abs(p.value)), 1)
    const intensity = Math.abs(avg) / maxVal
    if (intensity < 0.45) return null
    return { side: avg > 0 ? 'home' : 'away', intensity }
  }, [momentumPoints, isLive])

  const noSignal = !signal
  const bottomBg = signal && MARKET_CONFIG[signal.market] ? MARKET_CONFIG[signal.market].bg : undefined

  const hasMatchStats = isLive && (liveStats.xg || liveStats.possession || liveStats.shots || liveStats.shotsOnTarget || liveStats.corners)
  const hasAttackData = isLive && attackStats != null

  // ── Card border/glow style ─────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = (() => {
    const base = 'inset 0 1px 0 0 rgba(255,255,255,0.07)'
    if (isLive && pressure) return {
      borderColor: `rgba(139,92,246,${0.40 + pressure.intensity * 0.45})`,
      boxShadow: `${base}, 0 0 20px rgba(139,92,246,${0.15 + pressure.intensity * 0.25})`,
    }
    if (isLive) return {
      borderColor: 'rgba(52,211,153,0.22)',
      borderLeftColor: 'rgba(52,211,153,0.55)',
      borderLeftWidth: '2px',
      boxShadow: `${base}, 0 0 16px rgba(16,185,129,0.06)`,
    }
    if (signal && !isFinished) return {
      borderColor: `${marketColor(signal.market)}1a`,
      boxShadow: `${base}, 0 8px 24px rgba(0,0,0,0.2)`,
    }
    return { boxShadow: base }
  })()

  return (
    <div
      className={cn(
        'glass rounded-[20px] flex flex-col overflow-hidden',
        'cursor-pointer transition-all duration-300',
        !isFinished && 'hover:-translate-y-0.5 hover:bg-white/[0.04]',
        isFinished && 'opacity-60',
        noSignal && !isLive && 'opacity-50',
        className
      )}
      style={cardStyle}
      onClick={() => router.push(`/game/${game.id}`)}
    >

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-3.5 pt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] text-muted-foreground/45 truncate leading-none">
          {game.league}
          {game.country ? <span className="opacity-70"> · {game.country}</span> : null}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {onToggleFavorite && (
            <button
              onClick={e => { e.stopPropagation(); onToggleFavorite(game.id) }}
              className={cn('transition-colors', isFavorite ? 'text-yellow-400' : 'text-muted-foreground/30 hover:text-yellow-400/60')}
              aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          )}

          {game.exchangeUrl && (
            <a href={game.exchangeUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-400/25 text-emerald-400/70 hover:text-emerald-300 hover:border-emerald-300/40 transition-colors"
            >Bolsa</a>
          )}

          {isLive ? (
            <span className="flex items-center gap-1 text-emerald-400 text-[11px] font-mono font-bold">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              {minuteDisplay}
            </span>
          ) : isFinished ? (
            <span className="text-[11px] text-muted-foreground/40 font-mono">Final</span>
          ) : (
            <span className="text-[11px] font-mono text-muted-foreground/70 tabular-nums">
              {kickoffBRT(game.kickoffAt)}
            </span>
          )}
        </div>
      </div>

      {/* ── Teams + Score ───────────────────────────────────────────────────── */}
      <div className="px-3.5 pt-2.5 pb-2 space-y-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo teamId={game.homeTeamId} teamName={game.homeTeam} size={16} />
          <span className={cn('text-[13px] font-semibold truncate flex-1 leading-tight',
            isLive && displayHomeScore > displayAwayScore ? 'text-foreground' : 'text-foreground/85')}>
            {game.homeTeam}
          </span>
          {hasScore && (
            <span className={cn('text-[16px] font-bold font-mono tabular-nums shrink-0 w-5 text-right leading-tight',
              isLive && displayHomeScore > displayAwayScore ? 'text-foreground' : 'text-foreground/60')}>
              {displayHomeScore}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <TeamLogo teamId={game.awayTeamId} teamName={game.awayTeam} size={16} />
          <span className={cn('text-[13px] font-semibold truncate flex-1 leading-tight',
            isLive && displayAwayScore > displayHomeScore ? 'text-foreground' : 'text-foreground/65')}>
            {game.awayTeam}
          </span>
          {hasScore && (
            <span className={cn('text-[16px] font-bold font-mono tabular-nums shrink-0 w-5 text-right leading-tight',
              isLive && displayAwayScore > displayHomeScore ? 'text-foreground' : 'text-foreground/60')}>
              {displayAwayScore}
            </span>
          )}
        </div>
      </div>

      {/* ── Momentum sparkline ──────────────────────────────────────────────── */}
      {isLive && momentumPoints.length > 0 && (
        <div className="px-3.5 pb-1">
          <MiniMomentum
            points={momentumPoints}
            events={(liveData?.events ?? [])
              .filter(e => e.minute != null && ['goal', 'shotOnGoal', 'shot', 'corner', 'card'].includes(e.type))
              .map(e => ({ type: e.type as EventMarker['type'], minute: e.minute, isHome: e.isHome, cardClass: e.class }))
            }
          />
        </div>
      )}

      {/* ── Live stats panel ────────────────────────────────────────────────── */}
      {(hasMatchStats || hasAttackData) && (
        <div className="mx-3.5 mb-2 rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
        >

          {/* Stat bars: possession / shots / corners / xG */}
          {hasMatchStats && (
            <div className="px-3 pt-2.5 pb-2 space-y-2">
              {liveStats.xg            && <StatBar label="xG"            home={liveStats.xg.home}            away={liveStats.xg.away}            decimals={2} />}
              {liveStats.possession    && <StatBar label="Posse"         home={liveStats.possession.home}    away={liveStats.possession.away}    isPercent />}
              {liveStats.shots         && <StatBar label="Chutes"        home={liveStats.shots.home}         away={liveStats.shots.away}         />}
              {liveStats.shotsOnTarget && <StatBar label="Chutes a Gol"  home={liveStats.shotsOnTarget.home} away={liveStats.shotsOnTarget.away} />}
              {liveStats.corners       && <StatBar label="Escanteios"    home={liveStats.corners.home}       away={liveStats.corners.away}       />}
            </div>
          )}

          {/* Divider between sections */}
          {hasMatchStats && hasAttackData && (
            <div className="mx-3 border-t border-white/[0.04]" />
          )}

          {/* Attack donuts + rate tables */}
          {hasAttackData && attackStats && (
            <div className="px-3 pt-2.5 pb-3">

              {/* Legend row */}
              <div className="flex justify-between mb-2 px-0.5">
                <span className="text-[9px] font-semibold text-sky-400/70 uppercase tracking-wider">
                  {game.homeTeam.split(' ')[0]}
                </span>
                <span className="text-[9px] font-semibold text-orange-400/70 uppercase tracking-wider">
                  {game.awayTeam.split(' ')[0]}
                </span>
              </div>

              {/* Donuts row */}
              <div className="flex items-start gap-2 mb-2">
                <MiniDonut
                  title="Ataques"
                  homeVal={attackStats.home.attacks.total}
                  awayVal={attackStats.away.attacks.total}
                />
                {/* Vertical divider */}
                <div className="w-px self-stretch mt-5" style={{ background: 'rgba(255,255,255,0.05)' }} />
                <MiniDonut
                  title="Perigosos"
                  homeVal={attackStats.home.dangerous.total}
                  awayVal={attackStats.away.dangerous.total}
                />
              </div>

              {/* Rate tables — one per donut column */}
              <div className="grid grid-cols-[1fr_1px_1fr] gap-x-2">
                <RateTable home={attackStats.home.attacks}   away={attackStats.away.attacks}   />
                <div style={{ background: 'rgba(255,255,255,0.05)' }} />
                <RateTable home={attackStats.home.dangerous} away={attackStats.away.dangerous} />
              </div>

            </div>
          )}

        </div>
      )}

      {/* ── Signal footer ───────────────────────────────────────────────────── */}
      <div className="mt-auto px-3.5 pb-3 pt-2 border-t border-white/[0.04]"
        style={bottomBg ? { backgroundColor: bottomBg } : undefined}
      >
        {noSignal ? (
          <p className="text-[11px] text-muted-foreground/35">Sem sinal</p>
        ) : (
          <div className="flex items-center gap-2">
            <MarketBadge market={signal.market} />
            <span className="text-[15px] font-bold font-mono tabular-nums shrink-0"
              style={{ color: marketColor(signal.market) }}>
              {Math.round(signal.probability * 100)}%
            </span>
            <ConfidenceBar value={signal.confidence} />
            {isLive && ppmSignal && (
              <span className={cn(
                'text-[10px] font-mono font-semibold shrink-0 px-1.5 py-0.5 rounded-lg border',
                ppmSignal.side === 'home'
                  ? 'text-sky-400 border-sky-400/20 bg-sky-400/[0.07]'
                  : 'text-orange-400 border-orange-400/20 bg-orange-400/[0.07]'
              )}>
                PPM {ppmSignal.score}
              </span>
            )}
          </div>
        )}
      </div>

    </div>
  )
}

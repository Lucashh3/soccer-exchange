'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { MarketBadge, marketColor, MARKET_CONFIG } from './MarketBadge'
import type { Game } from '@/types'
import { cn } from '@/lib/utils'
import { TeamLogo } from '@/components/ui/TeamLogo'
import type { EntrySignal } from '@/lib/ppm'

interface MomentumPoint { minute: number; value: number }
interface EventMarker { type: 'goal' | 'shotOnGoal' | 'shot' | 'corner' | 'card'; minute: number; isHome: boolean; cardClass?: string }

function MiniMomentum({ points, events = [] }: { points: MomentumPoint[]; events?: EventMarker[] }) {
  const TOTAL = 90
  const W = 400
  const H = 36
  const midY = H / 2
  const maxVal = Math.max(...points.map(p => Math.abs(p.value)), 1)
  const toX = (m: number) => (m / TOTAL) * W
  const barW = Math.max(W / TOTAL - 0.3, 0.8)

  const markerColor = (ev: EventMarker) => {
    if (ev.type === 'goal') return 'rgba(255,255,255,0.95)'
    if (ev.type === 'shotOnGoal') return 'rgba(52,211,153,0.9)'
    if (ev.type === 'corner') return 'rgba(251,146,60,0.85)'
    if (ev.type === 'card') return ev.cardClass === 'red' ? '#f87171' : ev.cardClass === 'yellowRed' ? '#fb923c' : '#fbbf24'
    return 'rgba(56,189,248,0.7)'
  }
  const markerR = (type: EventMarker['type']) => type === 'goal' ? 3.5 : type === 'shotOnGoal' ? 2.5 : type === 'card' ? 2 : 2

  const homeEvents = events.filter(e => e.isHome)
  const awayEvents = events.filter(e => !e.isHome)

  return (
    <div className="w-full">
      {/* Home markers */}
      <div className="relative w-full" style={{ height: '14px' }}>
        {homeEvents.map((ev, i) => (
          <div key={i} className="absolute flex items-center justify-center"
            style={{ left: `${(ev.minute / TOTAL) * 100}%`, top: 0, bottom: 0, transform: 'translateX(-50%)' }}
          >
            <div className="shrink-0" style={{
              width: ev.type === 'card' ? '4px' : `${markerR(ev.type) * 2}px`,
              height: ev.type === 'card' ? '6px' : `${markerR(ev.type) * 2}px`,
              borderRadius: ev.type === 'card' ? '1px' : '50%',
              backgroundColor: markerColor(ev),
              boxShadow: ev.type === 'goal' ? '0 0 3px rgba(255,255,255,0.6)' :
                         ev.type === 'shotOnGoal' ? '0 0 3px rgba(52,211,153,0.7)' : 'none',
            }} />
          </div>
        ))}
      </div>

      {/* Bars */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: '44px', display: 'block' }}>
        <line x1="0" y1={midY} x2={W} y2={midY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1={toX(45)} y1="0" x2={toX(45)} y2={H} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2,2" />
        {points.map((p, i) => {
          if (p.value === 0) return null
          const isHome = p.value > 0
          const barH = (Math.abs(p.value) / maxVal) * (midY - 2)
          return (
            <rect key={i} x={toX(p.minute) - barW / 2} y={isHome ? midY - barH : midY}
              width={barW} height={barH}
              fill={isHome ? 'rgba(56,189,248,0.55)' : 'rgba(251,146,60,0.55)'}
              rx="0.5"
            />
          )
        })}
      </svg>

      {/* Away markers */}
      <div className="relative w-full" style={{ height: '14px' }}>
        {awayEvents.map((ev, i) => (
          <div key={i} className="absolute flex items-center justify-center"
            style={{ left: `${(ev.minute / TOTAL) * 100}%`, top: 0, bottom: 0, transform: 'translateX(-50%)' }}
          >
            <div className="shrink-0" style={{
              width: ev.type === 'card' ? '4px' : `${markerR(ev.type) * 2}px`,
              height: ev.type === 'card' ? '6px' : `${markerR(ev.type) * 2}px`,
              borderRadius: ev.type === 'card' ? '1px' : '50%',
              backgroundColor: markerColor(ev),
              boxShadow: ev.type === 'goal' ? '0 0 3px rgba(255,255,255,0.6)' :
                         ev.type === 'shotOnGoal' ? '0 0 3px rgba(52,211,153,0.7)' : 'none',
            }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function kickoffBRT(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
  })
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#34d399' : pct >= 65 ? '#fbbf24' : '#6b7280'
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1 bg-white/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-muted-foreground tabular-nums w-7 text-right">{pct}%</span>
    </div>
  )
}

interface LiveData {
  status: string
  minute?: string
  clock?: {
    minute?: number
    display?: string
    phase?: string
    period?: number | null
  }
  homeScore: number
  awayScore: number
  events?: { type: string; minute: number; isHome: boolean; class?: string }[]
}

interface Props {
  game: Game
  className?: string
  isFavorite?: boolean
  onToggleFavorite?: (id: string) => void
}

export function SignalCard({ game, className, isFavorite = false, onToggleFavorite }: Props) {
  const router = useRouter()
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [momentumPoints, setMomentumPoints] = useState<MomentumPoint[]>([])
  const [liveStats, setLiveStats] = useState<{ name: string; home: string | number | null; away: string | number | null }[]>([])
  const [latestComment, setLatestComment] = useState<{ text: string; minute?: number } | null>(null)
  const [ppmSignal, setPpmSignal] = useState<EntrySignal | null>(null)
  const attackHistoryRef = useRef<{ minute: number; attacks: { h: number; a: number }; dangerous: { h: number; a: number } }[]>([])
  const signal = game.topSignal
  const isLive = game.status === 'inprogress' || game.status === 'halftime'
  const hasScore = (game.status === 'inprogress' || game.status === 'halftime' || game.status === 'finished')
    && game.homeScore != null && game.awayScore != null

  useEffect(() => {
    if (!isLive) return

    const fetchLive = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/live`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          const LIVE_STATUSES = new Set(['inprogress', 'halftime', 'finished', 'pause', 'interrupted', 'overtime', 'penaltyshootout', 'awaiting'])
          if (LIVE_STATUSES.has(data.status)) setLiveData(data)
        }
      } catch {}
    }

    const fetchMomentum = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/graph`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.points?.length > 0) setMomentumPoints(data.points)
        }
      } catch {}
    }

    const fetchStats = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/live-stats`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          if (data.stats?.length > 0) setLiveStats(data.stats)
        }
      } catch {}
    }

    const fetchCommentary = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/commentary`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          const first = data.comments?.[0]
          if (first?.text) setLatestComment({ text: first.text, minute: first.time })
        }
      } catch {}
    }

    const fetchPpm = async () => {
      try {
        const res = await fetch(`/api/game/${game.id}/ppm`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(5000),
        })
        if (res.ok) {
          const data = await res.json()
          setPpmSignal(data.signal?.score >= 50 ? data.signal : null)
        }
      } catch {}
    }

    fetchLive()
    fetchMomentum()
    fetchStats()
    fetchCommentary()
    fetchPpm()
    const interval = setInterval(() => { fetchLive(); fetchMomentum(); fetchStats(); fetchCommentary(); fetchPpm() }, 30000)
    return () => clearInterval(interval)
  }, [game.id, game.status])

  useEffect(() => {
    const currentMinute = (liveData?.clock?.minute ?? parseInt(String(liveData?.minute ?? '0'))) || 0
    if (!currentMinute || !liveStats.length) return
    const norm = (n: string) => n.toLowerCase().trim()
    const toNum = (v: string | number | null) => parseFloat(String(v ?? '0')) || 0
    const findStat = (pred: (n: string) => boolean) => {
      const s = liveStats.find(s => pred(norm(s.name)))
      return s ? { h: toNum(s.home), a: toNum(s.away) } : null
    }
    const attacks = findStat(n => n.includes('attack') && !n.includes('dangerous'))
    const dangerous = findStat(n => n.includes('dangerous'))
    if (attacks && dangerous) {
      const hist = attackHistoryRef.current
      if (!hist.length || hist[hist.length - 1].minute !== currentMinute) {
        hist.push({ minute: currentMinute, attacks, dangerous })
        if (hist.length > 20) hist.shift()
      }
    }
  }, [liveData, liveStats])

  const noSignal = !signal

  // Detect high pressure: avg of last 8 momentum points exceeds threshold
  const pressure = useMemo(() => {
    if (!isLive || momentumPoints.length < 4) return null
    const recent = momentumPoints.slice(-8)
    const avg = recent.reduce((s, p) => s + p.value, 0) / recent.length
    const maxVal = Math.max(...momentumPoints.map(p => Math.abs(p.value)), 1)
    const intensity = Math.abs(avg) / maxVal  // 0–1
    if (intensity < 0.45) return null
    return { side: avg > 0 ? 'home' : 'away', intensity }
  }, [momentumPoints, isLive])

  // Bottom zone background tint from market color at 8% opacity
  const bottomBg = signal
    ? MARKET_CONFIG[signal.market].bg
    : undefined

  return (
    <Card
      className={cn(
        'glass cursor-pointer hover:border-white/15 transition-all overflow-hidden min-h-[104px] flex flex-col',
        isLive && !pressure && 'border-emerald-500/30',
        isLive && pressure && 'border-violet-500/60',
        noSignal && 'opacity-60',
        className
      )}
      style={
        isLive && pressure
          ? {
              borderColor: `rgba(139,92,246,${0.5 + pressure.intensity * 0.5})`,
              borderWidth: '2px',
              boxShadow: `0 0 20px 4px rgba(139,92,246,${0.25 + pressure.intensity * 0.35})`,
            }
          : signal && !isLive ? { borderColor: `${marketColor(signal.market)}20` } : undefined
      }
      onClick={() => router.push(`/game/${game.id}`)}
    >

      {/* Top zone */}
      <div className="p-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground truncate">
            {game.league} · {game.country}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {onToggleFavorite && (
              <button
                onClick={e => { e.stopPropagation(); onToggleFavorite(game.id) }}
                className={cn(
                  'transition-colors',
                  isFavorite ? 'text-yellow-400' : 'text-muted-foreground/40 hover:text-yellow-400/70'
                )}
                aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            )}
            {game.exchangeUrl && (
              <a
                href={game.exchangeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border border-emerald-400/30 text-emerald-300 hover:text-emerald-200 hover:border-emerald-300/50 transition-colors"
              >
                Bolsa
              </a>
            )}
            {isLive ? (
            <span className="text-xs font-mono text-emerald-400 shrink-0 flex items-center gap-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              {((liveData?.clock?.phase ?? '').toLowerCase() === 'halftime' || (liveData?.status ?? game.status) === 'halftime')
                ? 'INTERVALO'
                : `LIVE${(liveData?.clock?.display ?? liveData?.minute) ? ` ${liveData?.clock?.display ?? liveData?.minute}` : ''}`}
            </span>
          ) : (
            <span className="text-xs font-mono text-muted-foreground tabular-nums">
              {kickoffBRT(game.kickoffAt)}
            </span>
          )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-1 min-w-0">
          <TeamLogo teamId={game.homeTeamId} teamName={game.homeTeam} size={18} />
          <span className="text-sm font-semibold truncate flex-1 min-w-0">
            {game.homeTeam}
          </span>
          {hasScore ? (
            <span className="font-mono tabular-nums text-sm font-bold shrink-0 px-1">
              {liveData ? liveData.homeScore : game.homeScore}–{liveData ? liveData.awayScore : game.awayScore}
            </span>
          ) : (
            <span className="text-muted-foreground font-normal text-xs shrink-0 px-1">vs</span>
          )}
          <span className="text-sm font-semibold truncate flex-1 min-w-0 text-right">
            {game.awayTeam}
          </span>
          <TeamLogo teamId={game.awayTeamId} teamName={game.awayTeam} size={18} />
        </div>
      </div>

      {/* Mini momentum — only for live games with data */}
      {isLive && momentumPoints.length > 0 && (
        <div className="px-3 pb-1">
          <MiniMomentum
            points={momentumPoints}
            events={(liveData?.events ?? [])
              .filter(e => e.minute != null && ['goal','shotOnGoal','shot','corner','card'].includes(e.type))
              .map(e => ({ type: e.type as EventMarker['type'], minute: e.minute, isHome: e.isHome, cardClass: e.class }))
            }
          />
        </div>
      )}

      {/* Latest commentary */}
      {isLive && latestComment && (
        <div className="px-3 pb-1.5 flex items-baseline gap-1.5">
          {latestComment.minute != null && (
            <span className="text-[10px] font-mono text-emerald-400/70 shrink-0">{latestComment.minute}'</span>
          )}
          <p className="text-[10px] text-muted-foreground/70 leading-snug line-clamp-1 italic">
            {latestComment.text}
          </p>
        </div>
      )}

      {/* Live stats strip */}
      {isLive && liveStats.length > 0 && (() => {
        const norm = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()
        const toNum = (v: string | number | null) => parseFloat(String(v ?? '0').replace('%', '')) || 0
        const byName = new Map(liveStats.map(s => [norm(s.name), s] as const))
        const find = (...keys: string[]) => keys.map(k => byName.get(norm(k))).find(Boolean) ?? null

        const currentMinute = (liveData?.clock?.minute ?? parseInt(String(liveData?.minute ?? '0'))) || 0

        type StatEntry = { label: string; h: number; a: number; isRate?: boolean }
        const rows: StatEntry[] = []

        const add = (label: string, ...keys: string[]) => {
          const s = find(...keys)
          if (s) rows.push({ label, h: toNum(s.home), a: toNum(s.away) })
          return s
        }

        add('xG', 'expected goals', 'expected goals (xg)', 'xg')
        add('Posse', 'ball possession')
        add('Chutes a gol', 'shots on target')
        add('Chutes', 'total shots')

        const atkStat = find('attacks')
        const dngStat = find('dangerous attacks')

        if (atkStat) {
          const h = toNum(atkStat.home), a = toNum(atkStat.away)
          rows.push({ label: 'Ataques', h, a })
          if (currentMinute > 0) rows.push({ label: '/min', h: h / currentMinute, a: a / currentMinute, isRate: true })
        }
        if (dngStat) {
          const h = toNum(dngStat.home), a = toNum(dngStat.away)
          rows.push({ label: 'At. Per.', h, a })
          if (currentMinute > 0) rows.push({ label: '/min', h: h / currentMinute, a: a / currentMinute, isRate: true })
        }

        if (!rows.length) return null
        return (
          <div className="px-3 pb-2 space-y-1">
            {rows.map(({ label, h, a, isRate }, i) => {
              const total = h + a || 1
              return (
                <div key={i} className={isRate ? undefined : 'space-y-0.5'}>
                  <div className="flex items-center justify-between" style={{ fontSize: isRate ? '9px' : '10px' }}>
                    <span className={`font-mono tabular-nums w-8 ${isRate ? 'text-sky-400/50' : 'text-sky-400'}`}>
                      {isRate ? h.toFixed(1) : h || '—'}
                    </span>
                    <span className={isRate ? 'text-muted-foreground/40' : 'text-muted-foreground/60'}>{label}</span>
                    <span className={`font-mono tabular-nums w-8 text-right ${isRate ? 'text-orange-400/50' : 'text-orange-400'}`}>
                      {isRate ? a.toFixed(1) : a || '—'}
                    </span>
                  </div>
                  {!isRate && (
                    <div className="flex h-0.5 rounded-full overflow-hidden bg-white/5">
                      <div className="h-full bg-sky-400/50" style={{ width: `${(h / total) * 100}%` }} />
                      <div className="h-full bg-orange-400/50" style={{ width: `${(a / total) * 100}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Bottom zone */}
      <div
        className={cn(
          'px-3 pb-3 pt-2',
          noSignal && 'bg-white/[0.03]'
        )}
        style={bottomBg ? { backgroundColor: bottomBg } : undefined}
      >
        {noSignal ? (
          <p className="text-xs text-muted-foreground">Sem sinal</p>
        ) : (
          <div className="flex items-center gap-2">
            <MarketBadge market={signal.market} />
            <span
              className="text-lg font-bold font-mono tabular-nums shrink-0"
              style={{ color: marketColor(signal.market) }}
            >
              {Math.round(signal.probability * 100)}%
            </span>
            <ConfidenceBar value={signal.confidence} />
            {game.homeStats?.xgAvg != null && game.awayStats?.xgAvg != null && (
              <span className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums">
                {game.homeStats.xgAvg.toFixed(1)}/{game.awayStats.xgAvg.toFixed(1)}
              </span>
            )}
            {isLive && ppmSignal && (
              <span className={cn(
                'text-xs font-mono font-bold shrink-0 px-1.5 py-0.5 rounded border',
                ppmSignal.side === 'home'
                  ? 'text-sky-400 border-sky-400/30 bg-sky-400/10'
                  : 'text-orange-400 border-orange-400/30 bg-orange-400/10'
              )}>
                ↑ PPM {ppmSignal.score}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGraph } from '@/lib/api'
import { AttackMomentum } from './AttackMomentum'
import { CoachCard } from './CoachCard'
import { TeamLogo } from '@/components/ui/TeamLogo'

interface MatchEvent {
  type: 'goal' | 'card' | 'shotOnGoal' | 'shot' | 'corner'
  class: string // 'regular' | 'ownGoal' | 'yellow' | 'red'
  minute: number
  isHome: boolean
  player: string | null
  assist: string | null
  homeScore?: number
  awayScore?: number
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
  events: MatchEvent[]
}

interface LiveStats {
  stats: { name: string; home: string | number | null; away: string | number | null }[]
}

interface Props {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeTeamId?: number | null
  awayTeamId?: number | null
}

const KEY_STATS = ['Ball possession', 'Expected goals', 'Total shots', 'Shots on target', 'Corner kicks', 'Big chances']

const STAT_LABELS: Record<string, string> = {
  'Ball possession':  'Posse de bola',
  'Expected goals':   'Gols esperados (xG)',
  'Total shots':      'Chutes totais',
  'Shots on target':  'Chutes no gol',
  'Corner kicks':     'Escanteios',
  'Big chances':      'Grandes chances',
}

function StatBar({ name, home, away }: { name: string; home: string | number | null; away: string | number | null }) {
  const parseVal = (v: string | number | null): number => {
    if (v === null || v === undefined) return 0
    return parseFloat(String(v).replace('%', '')) || 0
  }
  const h = parseVal(home)
  const a = parseVal(away)
  const total = h + a || 1
  const homePct = (h / total) * 100
  const awayPct = (a / total) * 100

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-mono tabular-nums text-sky-400 w-10">{home ?? '—'}</span>
        <span className="text-muted-foreground text-[11px]">{name}</span>
        <span className="font-mono tabular-nums text-orange-400 w-10 text-right">{away ?? '—'}</span>
      </div>
      <div className="flex h-1 rounded-full overflow-hidden bg-white/5">
        <div className="h-full bg-sky-400/60 transition-all" style={{ width: `${homePct}%` }} />
        <div className="h-full bg-orange-400/60 transition-all" style={{ width: `${awayPct}%` }} />
      </div>
    </div>
  )
}

function EventIcon({ type, cls }: { type: string; cls: string }) {
  if (type === 'goal') {
    if (cls === 'ownGoal') return <span title="Gol contra" className="text-red-400">⚽</span>
    return <span title="Gol" className="text-white">⚽</span>
  }
  if (type === 'card') {
    if (cls === 'red') return <span title="Cartão vermelho" className="inline-block w-3 h-4 rounded-[2px] bg-red-500 shrink-0" />
    return <span title="Cartão amarelo" className="inline-block w-3 h-4 rounded-[2px] bg-yellow-400 shrink-0" />
  }
  return null
}

function EventRow({ event, homeTeam, awayTeam }: { event: MatchEvent; homeTeam: string; awayTeam: string }) {
  const isHome = event.isHome
  return (
    <div className={`flex items-center gap-2 text-xs py-1 ${isHome ? 'flex-row' : 'flex-row-reverse'}`}>
      <span className="font-mono text-muted-foreground w-7 shrink-0 text-center">{event.minute}'</span>
      <EventIcon type={event.type} cls={event.class} />
      <div className={`flex flex-col min-w-0 ${isHome ? '' : 'items-end'}`}>
        <span className="font-medium truncate">{event.player ?? '—'}</span>
        {event.assist && (
          <span className="text-muted-foreground text-[10px] truncate">assist: {event.assist}</span>

        )}
      </div>
      {event.homeScore != null && (
        <span className="font-mono text-muted-foreground text-[10px] shrink-0 ml-auto mr-auto">
          {event.homeScore}–{event.awayScore}
        </span>
      )}
    </div>
  )
}

export function MatchOverview({ gameId, homeTeam, awayTeam, homeTeamId, awayTeamId }: Props) {
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)

  const { data: graphData } = useQuery({
    queryKey: ['graph', gameId],
    queryFn: () => fetchGraph(gameId),
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  useEffect(() => {
    const fetch = async () => {
      try {
        const [liveRes, statsRes] = await Promise.all([
          window.fetch(`/api/game/${gameId}/live`, { cache: 'no-store' }),
          window.fetch(`/api/game/${gameId}/live-stats`, { cache: 'no-store' }),
        ])
        if (liveRes.ok) setLiveData(await liveRes.json())
        if (statsRes.ok) setLiveStats(await statsRes.json())
      } catch { } finally { setLoading(false) }
    }
    fetch()
    const interval = setInterval(fetch, 30_000)
    return () => clearInterval(interval)
  }, [gameId])

  if (loading) return (
    <div className="space-y-3 animate-pulse">
      <div className="h-24 rounded-xl bg-white/5" />
      <div className="h-32 rounded-xl bg-white/5" />
    </div>
  )

  const isLive = liveData && liveData.status !== 'unavailable'
  const keyStats = liveStats?.stats.filter(s => KEY_STATS.includes(s.name)) ?? []
  const events = (liveData?.events ?? []).filter(e => e.type === 'goal' || e.type === 'card')

  return (
    <div className="space-y-4">

      {/* Score header */}
      <div className="flex items-center justify-between gap-3 py-5 px-4 bg-emerald-500/8 border border-emerald-500/20 rounded-xl">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TeamLogo teamId={homeTeamId} teamName={homeTeam} size={32} />
          <span className="text-sm font-semibold truncate">{homeTeam}</span>
        </div>
        <div className="text-center shrink-0">
          {isLive ? (
            <>
              <p className="text-3xl font-bold font-mono tabular-nums">
                {liveData!.homeScore} <span className="text-muted-foreground font-light">–</span> {liveData!.awayScore}
              </p>
              <p className="text-xs font-mono text-emerald-400 mt-1 flex items-center justify-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                {liveData!.clock?.display ?? liveData!.minute ?? 'LIVE'}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Dados indisponíveis</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
          <span className="text-sm font-semibold truncate text-right">{awayTeam}</span>
          <TeamLogo teamId={awayTeamId} teamName={awayTeam} size={32} />
        </div>
      </div>

      {/* Events timeline */}
      {events.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Eventos</p>
          <div className="divide-y divide-border/40">
            {[...events].sort((a, b) => b.minute - a.minute).map((ev, i) => (
              <EventRow key={i} event={ev} homeTeam={homeTeam} awayTeam={awayTeam} />
            ))}
          </div>
        </div>
      )}

      {/* Attack momentum */}
      {graphData && graphData.points.length > 0 && (
        <AttackMomentum
          points={graphData.points}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          periodTime={graphData.periodTime}
          events={(liveData?.events ?? [])
            .filter(e => e.minute != null)
            .map(e => ({ type: e.type as 'goal' | 'shotOnGoal' | 'shot' | 'corner', minute: e.minute, isHome: e.isHome }))
          }
        />
      )}

      <CoachCard gameId={gameId} isLive={Boolean(isLive)} />

      {/* Stats bars */}
      {keyStats.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
            <span className="text-sky-400/80 truncate max-w-[40%]">{homeTeam}</span>
            <span className="opacity-50">Estatísticas</span>
            <span className="text-orange-400/80 truncate max-w-[40%] text-right">{awayTeam}</span>
          </div>
          {keyStats.map((s, i) => (
            <StatBar key={i} name={STAT_LABELS[s.name] ?? s.name} home={s.home} away={s.away} />
          ))}
        </div>
      )}
    </div>
  )
}

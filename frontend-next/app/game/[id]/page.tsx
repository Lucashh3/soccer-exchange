'use client'

import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, Activity, LineChart, Sparkles, ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAnalysis } from '@/hooks/useGame'
import { MarketBadge } from '@/components/signals/MarketBadge'
import { PoissonHeatmap } from '@/components/game/PoissonHeatmap'
import { FormPills } from '@/components/game/FormPills'
import { StatRow } from '@/components/game/StatRow'
import { XGChart } from '@/components/game/XGChart'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  fetchOdds, fetchManagers,
  fetchCommentary, fetchHighlights, fetchH2HEvents,
  fetchBestPlayers, fetchSquad, fetchShotmap, fetchVotes, fetchGraph, fetchPpm,
  type H2HEvent, type OddsMarket, type SquadPlayer, type BestPlayer,
} from '@/lib/api'
import { AttackMomentum } from '@/components/game/AttackMomentum'
import { MatchOverview } from '@/components/game/MatchOverview'
import { PpmChart } from '@/components/game/PpmChart'
import { CoachCard } from '@/components/game/CoachCard'
import { AttackDonut } from '@/components/game/AttackDonut'

function kickoffBRT(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Analysis report (JSON format) ────────────────────────────────────────────

interface AnalysisReport {
  signal: {
    status: 'ENTRADA_VALIDADA' | 'ALERTA_DE_RISCO' | 'NO_BET'
    market: string
    direction: 'BACK_HOME' | 'BACK_AWAY' | 'LAY_HOME' | 'LAY_AWAY' | 'NONE'
    probability: number
    confidence: number
  }
  evidences: string[]
  counterEvidences: string[]
  invalidationConditions: string[]
  decision: {
    stake: '1.0u' | '0.5u' | '0.0u'
    noBetReason: string | null
  }
}

function parseReport(raw: string): AnalysisReport | null {
  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    const parsed = JSON.parse(raw.slice(start, end + 1))
    if (parsed?.signal?.status) return parsed as AnalysisReport
  } catch {}
  return null
}

const STATUS_STYLES: Record<string, string> = {
  ENTRADA_VALIDADA: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  ALERTA_DE_RISCO: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  NO_BET: 'border-white/10 bg-white/5 text-muted-foreground',
}
const STATUS_LABELS: Record<string, string> = {
  ENTRADA_VALIDADA: 'Entrada Validada',
  ALERTA_DE_RISCO: 'Alerta de Risco',
  NO_BET: 'No Bet',
}
const DIRECTION_LABELS: Record<string, string> = {
  BACK_HOME: 'Back Casa',
  BACK_AWAY: 'Back Visitante',
  LAY_HOME: 'Lay Casa',
  LAY_AWAY: 'Lay Visitante',
  NONE: '—',
}

function AnalysisReportView({ report }: { report: AnalysisReport }) {
  const { signal, evidences, counterEvidences, invalidationConditions, decision } = report
  const statusStyle = STATUS_STYLES[signal.status] ?? STATUS_STYLES['NO_BET']

  return (
    <div className="space-y-4">
      {/* Signal header */}
      <div className={cn('rounded-lg border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2', statusStyle)}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {STATUS_LABELS[signal.status] ?? signal.status}
          </span>
          {signal.direction !== 'NONE' && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10">
              {DIRECTION_LABELS[signal.direction] ?? signal.direction}
            </span>
          )}
          {signal.market && signal.market !== '—' && (
            <span className="text-xs opacity-70">{signal.market}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs opacity-80">
          <span>Prob. {Number(signal.probability).toFixed(1)}%</span>
          <span>Conf. {signal.confidence}</span>
          <span className={cn('font-semibold', decision.stake === '0.0u' ? 'opacity-40' : '')}>
            {decision.stake}
          </span>
        </div>
      </div>

      {/* Evidences */}
      {evidences.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Evidências</p>
          <ul className="space-y-1.5">
            {evidences.map((e, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/80 leading-snug">
                <span className="text-emerald-400/80 shrink-0 mt-0.5 font-bold">+</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Counter evidences */}
      {counterEvidences.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Contraevidências</p>
          <ul className="space-y-1.5">
            {counterEvidences.map((e, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/60 leading-snug">
                <span className="text-amber-400/80 shrink-0 mt-0.5 font-bold">−</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Invalidation conditions */}
      {invalidationConditions.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Condições de Invalidação</p>
          <ul className="space-y-1.5">
            {invalidationConditions.map((c, i) => (
              <li key={i} className="flex gap-2 text-sm text-foreground/60 leading-snug">
                <span className="text-rose-400/80 shrink-0 mt-0.5">!</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No-bet reason */}
      {decision.noBetReason && (
        <p className="text-xs text-muted-foreground border border-white/10 rounded-lg px-3 py-2 leading-relaxed">
          {decision.noBetReason}
        </p>
      )}
    </div>
  )
}

// ── Collapsible Section ───────────────────────────────────────────────────────

function Section({
  title,
  type = 'analysis',
  defaultOpen,
  children,
}: {
  title: string
  type?: 'live' | 'analysis'
  defaultOpen: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isLive = type === 'live'
  const Icon = isLive ? Activity : LineChart

  return (
    <section className={cn('rounded-[20px] overflow-hidden transition-colors duration-300', isLive ? 'glass-live' : 'glass-analysis')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 group focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-1.5 rounded-xl flex items-center justify-center transition-colors', isLive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/[0.04] text-white/40')}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h3 className={cn('font-semibold tracking-tight text-sm', isLive ? 'text-foreground' : 'text-foreground/75')}>
            {title}
          </h3>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="text-white/30 group-hover:text-white/60">
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="px-4 pb-5 pt-1 border-t border-white/[0.04]">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

// ── Live Stats section ────────────────────────────────────────────────────────

interface AttackSnapshot {
  minute: number
  attacks: { h: number; a: number }
  dangerous: { h: number; a: number }
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
interface LiveStats { stats: { name: string; home: string | number | null; away: string | number | null }[] }

function LiveSection({ gameId, homeTeam, awayTeam }: { gameId: string; homeTeam: string; awayTeam: string }) {
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const attackHistoryRef = useRef<AttackSnapshot[]>([])

  const { data: graphData } = useQuery({
    queryKey: ['graph', gameId],
    queryFn: () => fetchGraph(gameId),
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  const { data: ppmData } = useQuery({
    queryKey: ['ppm', gameId],
    queryFn: () => fetchPpm(gameId),
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  useEffect(() => {
    const fetchLiveData = async () => {
      try {
        const [liveRes, statsRes] = await Promise.all([
          fetch(`/api/game/${gameId}/live`, { cache: 'no-store' }),
          fetch(`/api/game/${gameId}/live-stats`, { cache: 'no-store' }),
        ])
        const [liveJson, statsJson] = await Promise.all([liveRes.json(), statsRes.json()])
        const currentMinute = (liveJson?.clock?.minute ?? parseInt(String(liveJson?.minute ?? '0'))) || 0
        if (currentMinute > 0 && statsJson?.stats?.length) {
          const norm = (n: string) => n.toLowerCase().trim()
          const toNum = (v: string | number | null) => parseFloat(String(v ?? '0')) || 0
          const findStat = (pred: (n: string) => boolean) => {
            const s = statsJson.stats.find((s: { name: string }) => pred(norm(s.name)))
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
        }
        setLiveData(liveJson)
        setLiveStats(statsJson)
      } catch { /* ignore */ } finally { setLoading(false) }
    }
    fetchLiveData()
    const interval = setInterval(fetchLiveData, 30000)
    return () => clearInterval(interval)
  }, [gameId])

  const liveAvailable = liveData && liveData.status !== 'unavailable'
  const liveStatus = String(liveData?.status ?? '').toLowerCase()
  const coachLive = ['inprogress', 'live', 'halftime', 'pause', 'overtime', 'penaltyshootout'].includes(liveStatus)

  if (loading) return <div className="space-y-3"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>

  return (
    <div className="space-y-4">
      {liveAvailable ? (
        <div className="flex items-center justify-center gap-6 py-4 bg-emerald-500/10 rounded-xl">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{homeTeam}</p>
            <p className="text-3xl font-bold font-mono tabular-nums">{liveData!.homeScore}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-mono text-muted-foreground">{(liveData!.clock?.display ?? liveData!.minute) || 'LIVE'}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">{awayTeam}</p>
            <p className="text-3xl font-bold font-mono tabular-nums">{liveData!.awayScore}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-2">Placar não disponível</p>
      )}
      {graphData && graphData.points.length > 0 && (
        <>
          <AttackMomentum
            points={graphData.points}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            periodTime={graphData.periodTime}
            events={(liveData?.events ?? [])
              .filter(e => e.minute != null && ['goal', 'shotOnGoal', 'shot', 'corner', 'card'].includes(e.type))
              .map(e => ({
                type: e.type as 'goal' | 'shotOnGoal' | 'shot' | 'corner' | 'card',
                minute: e.minute,
                isHome: e.isHome,
                cardClass: e.type === 'card' ? (e.class as 'yellow' | 'red' | 'yellowRed' | undefined) : undefined,
              }))
            }
          />
          {ppmData && ppmData.blocks.length > 0 && (
            <PpmChart
              blocks={ppmData.blocks}
              signal={ppmData.signal}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
            />
          )}
        </>
      )}
      <AttackDonut gameId={gameId} homeTeam={homeTeam} awayTeam={awayTeam} />
      <CoachCard gameId={gameId} isLive={coachLive} />
      {liveAvailable && (() => {
        if (!liveStats?.stats?.length) {
          return <p className="text-center text-muted-foreground text-sm py-2">Estatísticas não disponíveis</p>
        }
        const norm = (n: string) => n.toLowerCase().replace(/\s+/g, ' ').trim()
        const toNum = (v: string | number | null) => parseFloat(String(v ?? '0')) || 0
        const byName = new Map(liveStats.stats.map(s => [norm(s.name), s] as const))
        const find = (...keys: string[]) => keys.map(k => byName.get(norm(k))).find(Boolean) ?? null

        const currentMinute = (liveData?.clock?.minute ?? parseInt(String(liveData?.minute ?? '0'))) || 0
        const hist = attackHistoryRef.current
        const findSnap = (target: number) => {
          let best: AttackSnapshot | null = null, bestD = Infinity
          for (const s of hist) { const d = Math.abs(s.minute - target); if (d < bestD) { bestD = d; best = s } }
          return bestD <= 3 ? best : null
        }
        const rv = (curr: number, prev: number, dt: number) => dt > 0 ? (curr - prev) / dt : 0
        const snap5 = hist.length ? findSnap(currentMinute - 5) : null
        const snap10 = hist.length ? findSnap(currentMinute - 10) : null
        const fmt = (v: number) => v.toFixed(1)

        const atkStat = find('attacks')
        const dngStat = find('dangerous attacks')

        return (
          <div className="space-y-2">
            {liveStats.stats.map((stat, i) => (
              <div key={i} className="flex items-center text-sm">
                <span className="w-24 text-muted-foreground text-right pr-2">{stat.home}</span>
                <span className="flex-1 text-center text-muted-foreground text-xs">{stat.name}</span>
                <span className="w-24 text-right pl-2 font-mono">{stat.away}</span>
              </div>
            ))}
            {(atkStat || dngStat) && (
              <div className="space-y-2 border-t border-border/40 pt-2">
                {([
                  { label: 'Ataques', stat: atkStat, snapKey: 'attacks' as const },
                  { label: 'At. Perigosos', stat: dngStat, snapKey: 'dangerous' as const },
                ]).filter(r => r.stat).map(({ label, stat, snapKey }) => {
                  const h = toNum(stat!.home), a = toNum(stat!.away)
                  const s5 = snap5?.[snapKey], s10 = snap10?.[snapKey]
                  return (
                    <div key={label} className="space-y-0.5">
                      <div className="flex items-center text-sm">
                        <span className="w-24 font-mono tabular-nums text-right pr-2 text-sky-400">{h}</span>
                        <span className="flex-1 text-center text-xs font-medium text-muted-foreground">{label}</span>
                        <span className="w-24 text-right pl-2 font-mono tabular-nums text-orange-400">{a}</span>
                      </div>
                      {currentMinute > 0 && (
                        <div className="flex items-center">
                          <span className="w-24 font-mono tabular-nums text-right pr-2 text-xs text-sky-400/60">{fmt(h / currentMinute)}</span>
                          <span className="flex-1 text-center text-[11px] text-muted-foreground/50">por min</span>
                          <span className="w-24 text-right pl-2 font-mono tabular-nums text-xs text-orange-400/60">{fmt(a / currentMinute)}</span>
                        </div>
                      )}
                      {s5 && snap5 && (
                        <div className="flex items-center">
                          <span className="w-24 font-mono tabular-nums text-right pr-2 text-xs text-sky-400/60">{fmt(rv(h, s5.h, currentMinute - snap5.minute))}</span>
                          <span className="flex-1 text-center text-[11px] text-muted-foreground/50">últ. 5&apos;</span>
                          <span className="w-24 text-right pl-2 font-mono tabular-nums text-xs text-orange-400/60">{fmt(rv(a, s5.a, currentMinute - snap5.minute))}</span>
                        </div>
                      )}
                      {s10 && snap10 && (
                        <div className="flex items-center">
                          <span className="w-24 font-mono tabular-nums text-right pr-2 text-xs text-sky-400/60">{fmt(rv(h, s10.h, currentMinute - snap10.minute))}</span>
                          <span className="flex-1 text-center text-[11px] text-muted-foreground/50">últ. 10&apos;</span>
                          <span className="w-24 text-right pl-2 font-mono tabular-nums text-xs text-orange-400/60">{fmt(rv(a, s10.a, currentMinute - snap10.minute))}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── H2H section ───────────────────────────────────────────────────────────────

function H2HSection({ gameId, homeTeam, awayTeam }: { gameId: string; homeTeam: string; awayTeam: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['h2h', gameId],
    queryFn: () => fetchH2HEvents(gameId),
    staleTime: 5 * 60_000,
    enabled: true,
  })

  if (isLoading) return <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>

  const events: H2HEvent[] = data?.events ?? []
  if (!events.length) return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
      <p className="text-2xl opacity-20">⊞</p>
      <p className="text-sm text-muted-foreground">Nenhum confronto direto encontrado</p>
    </div>
  )

  const homeKey = homeTeam.toLowerCase().split(' ')[0]
  const homeWins = events.filter(e => {
    const isHome = e.homeTeam.toLowerCase().includes(homeKey)
    return isHome ? (e.homeScore ?? 0) > (e.awayScore ?? 0) : (e.awayScore ?? 0) > (e.homeScore ?? 0)
  }).length
  const draws = events.filter(e => e.homeScore === e.awayScore).length
  const awayWins = events.length - homeWins - draws

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 text-center py-3 bg-white/5 rounded-xl">
        <div>
          <p className="text-xl font-bold text-sky-400">{homeWins}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate px-1">{homeTeam}</p>
        </div>
        <div>
          <p className="text-xl font-bold text-muted-foreground">{draws}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Empates</p>
        </div>
        <div>
          <p className="text-xl font-bold text-orange-400">{awayWins}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate px-1">{awayTeam}</p>
        </div>
      </div>
      <div className="space-y-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-1.5 border-b border-border/40 last:border-0">
            <span className="text-muted-foreground w-20 shrink-0">{e.date}</span>
            <div className="flex items-center gap-1.5 flex-1 justify-center">
              <span className="truncate max-w-[70px] text-right">{e.homeTeam}</span>
              <span className="font-mono font-bold tabular-nums px-1.5 py-0.5 bg-white/8 rounded text-xs">
                {e.homeScore ?? '?'} – {e.awayScore ?? '?'}
              </span>
              <span className="truncate max-w-[70px]">{e.awayTeam}</span>
            </div>
            <span className="text-xs text-muted-foreground/50 shrink-0 truncate max-w-[60px]">{e.tournament}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Odds section ──────────────────────────────────────────────────────────────

function fractionalToDecimal(frac: string): string {
  try {
    const [n, d] = frac.split('/').map(Number)
    return (n / d + 1).toFixed(2)
  } catch { return frac }
}

function OddsSection({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['odds', gameId],
    queryFn: () => fetchOdds(gameId),
    staleTime: 2 * 60_000,
    enabled: true,
  })

  if (isLoading) return <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>

  const markets: OddsMarket[] = data?.markets ?? []
  if (!markets.length) return <p className="text-sm text-muted-foreground text-center py-4">Odds não disponíveis</p>

  const priority = ['Full time', 'Both teams to score', 'Asian handicap', 'Double chance', 'Draw no bet', 'Goals', 'Over/Under']
  const sorted = [...markets].sort((a, b) => {
    const ai = priority.findIndex(p => a.marketName.toLowerCase().includes(p.toLowerCase()))
    const bi = priority.findIndex(p => b.marketName.toLowerCase().includes(p.toLowerCase()))
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
  })

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto">
      {sorted.slice(0, 15).map((market, mi) => (
        <div key={mi}>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5">{market.marketName}</p>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(market.choices.length, 4)}, 1fr)` }}>
            {market.choices.slice(0, 4).map((choice, ci) => (
              <div key={ci} className={cn(
                'flex flex-col items-center py-2 px-1 rounded-lg border text-xs',
                choice.winning ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-border bg-white/4'
              )}>
                <span className="text-muted-foreground text-xs mb-1 truncate w-full text-center">{choice.name}</span>
                <span className="font-mono font-bold tabular-nums">{fractionalToDecimal(choice.fractionalValue)}</span>
                {choice.change !== undefined && choice.change !== 0 && (
                  <span className={cn('text-xs mt-0.5', choice.change > 0 ? 'text-emerald-400' : 'text-red-400')}>
                    {choice.change > 0 ? '↑' : '↓'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Squad / Lineups section ───────────────────────────────────────────────────

function SquadSection({ gameId, homeTeam, awayTeam }: { gameId: string; homeTeam: string; awayTeam: string }) {
  const { data: homeSquad, isLoading: hLoading } = useQuery({
    queryKey: ['squad', gameId, 'home'],
    queryFn: () => fetchSquad(gameId, 'home'),
    staleTime: 10 * 60_000,
    enabled: true,
  })
  const { data: awaySquad, isLoading: aLoading } = useQuery({
    queryKey: ['squad', gameId, 'away'],
    queryFn: () => fetchSquad(gameId, 'away'),
    staleTime: 10 * 60_000,
    enabled: true,
  })

  if (hLoading || aLoading) return <div className="space-y-2"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>

  const posOrder: Record<string, number> = { G: 0, D: 1, M: 2, F: 3 }
  const posLabel: Record<string, string> = { G: 'GK', D: 'DEF', M: 'MID', F: 'FWD' }

  function renderSquad(players: SquadPlayer[], teamName: string, color: string) {
    if (!players.length) return <p className="text-xs text-muted-foreground text-center py-4">Indisponível</p>
    const sorted = [...players].sort((a, b) => (posOrder[a.position] ?? 9) - (posOrder[b.position] ?? 9))
    const grouped = sorted.reduce((acc, p) => {
      const pos = p.position ?? '?'
      if (!acc[pos]) acc[pos] = []
      acc[pos].push(p)
      return acc
    }, {} as Record<string, SquadPlayer[]>)

    return (
      <div>
        <p className={cn('text-xs font-semibold uppercase tracking-widest mb-2', color)}>{teamName}</p>
        {Object.entries(grouped).map(([pos, ps]) => (
          <div key={pos} className="mb-2">
            <p className="text-xs text-muted-foreground/50 uppercase tracking-widest mb-1">{posLabel[pos] ?? pos}</p>
            {ps.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-0.5 border-b border-border/20 last:border-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground w-4 text-center font-mono">{p.jerseyNumber}</span>
                  <span className="text-xs">{p.shortName ?? p.name}</span>
                </div>
                {p.marketValue && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {p.marketValue >= 1_000_000
                      ? `€${(p.marketValue / 1_000_000).toFixed(1)}M`
                      : `€${(p.marketValue / 1000).toFixed(0)}K`}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 text-sm max-h-[480px] overflow-y-auto">
      {renderSquad(homeSquad?.players ?? [], homeTeam, 'text-sky-400')}
      {renderSquad(awaySquad?.players ?? [], awayTeam, 'text-orange-400')}
    </div>
  )
}

// ── Commentary section ────────────────────────────────────────────────────────

function CommentarySection({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['commentary', gameId],
    queryFn: () => fetchCommentary(gameId),
    staleTime: 2 * 60_000,
    enabled: true,
  })

  if (isLoading) return <div className="space-y-2"><Skeleton className="h-6" /><Skeleton className="h-6" /><Skeleton className="h-6" /></div>

  const comments = data?.comments ?? []
  if (!comments.length) return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
      <p className="text-2xl opacity-20">💬</p>
      <p className="text-sm text-muted-foreground">Comentários não disponíveis</p>
    </div>
  )

  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
      {comments.slice(0, 40).map((c, i) => (
        <div key={i} className="flex gap-2 text-xs border-b border-border/30 last:border-0 pb-1.5">
          {c.time > 0 && <span className="font-mono text-muted-foreground/60 shrink-0 w-7 text-right">{c.time}'</span>}
          <p className="text-foreground/80 leading-relaxed">{c.text}</p>
        </div>
      ))}
    </div>
  )
}

// ── Highlights section ────────────────────────────────────────────────────────

function HighlightsSection({ gameId }: { gameId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['highlights', gameId],
    queryFn: () => fetchHighlights(gameId),
    staleTime: 10 * 60_000,
    enabled: true,
  })

  if (isLoading) return <div className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-10" /></div>

  const highlights = data?.highlights ?? []
  if (!highlights.length) return (
    <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
      <p className="text-2xl opacity-20">▶</p>
      <p className="text-sm text-muted-foreground">Sem destaques disponíveis</p>
    </div>
  )

  return (
    <div className="space-y-2">
      {highlights.slice(0, 3).map((h, i) => (
        <a key={i} href={h.url} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <span className="text-red-400 text-sm shrink-0">▶</span>
          <span className="text-xs truncate flex-1">{h.title}</span>
          {h.keyHighlight && <span className="text-xs text-yellow-400 shrink-0">★</span>}
        </a>
      ))}
    </div>
  )
}

// ── Votes widget ──────────────────────────────────────────────────────────────

function VotesWidget({ gameId, homeTeam, awayTeam }: { gameId: string; homeTeam: string; awayTeam: string }) {
  const { data } = useQuery({
    queryKey: ['votes', gameId],
    queryFn: () => fetchVotes(gameId),
    staleTime: 5 * 60_000,
  })
  const v = (data as { vote?: { vote1?: number; voteX?: number; vote2?: number } } | null)?.vote
  if (!v || (!v.vote1 && !v.vote2)) return null
  const total = (v.vote1 ?? 0) + (v.voteX ?? 0) + (v.vote2 ?? 0)
  if (!total) return null
  const pct = (n: number) => Math.round((n / total) * 100)

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground uppercase tracking-widest">Votação dos torcedores</p>
      <div className="flex gap-2 text-xs">
        {[
          { label: homeTeam, p: pct(v.vote1 ?? 0), color: '#38bdf8' },
          { label: 'Empate', p: pct(v.voteX ?? 0), color: '#a1a1aa' },
          { label: awayTeam, p: pct(v.vote2 ?? 0), color: '#fb923c' },
        ].map(({ label, p, color }) => (
          <div key={label} className="flex-1 text-center">
            <div className="h-1 rounded-full mb-1" style={{ backgroundColor: color, opacity: 0.7 }} />
            <span style={{ color }} className="font-mono font-bold">{p}%</span>
            <p className="text-muted-foreground/60 truncate mt-0.5 text-xs">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Best players widget ───────────────────────────────────────────────────────

function BestPlayersWidget({ gameId, homeTeam, awayTeam }: { gameId: string; homeTeam: string; awayTeam: string }) {
  const { data } = useQuery({
    queryKey: ['best-players', gameId],
    queryFn: () => fetchBestPlayers(gameId),
    staleTime: 5 * 60_000,
  })
  const home: BestPlayer[] = data?.home ?? []
  const away: BestPlayer[] = data?.away ?? []
  const motm = data?.motm

  if (!home.length && !away.length) return null

  return (
    <div className="space-y-2">
      {motm?.name && (
        <div className="flex items-center gap-2 py-2 px-3 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
          <span className="text-yellow-400">★</span>
          <div>
            <p className="text-xs text-yellow-400/70 uppercase tracking-widest">Jogador da partida</p>
            <p className="text-xs font-semibold">{motm.name} <span className="text-muted-foreground font-normal">{motm.rating}</span></p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[
          { team: homeTeam, players: home, color: 'text-sky-400' },
          { team: awayTeam, players: away, color: 'text-orange-400' },
        ].map(({ team, players, color }) => (
          <div key={team}>
            <p className={cn('text-xs uppercase tracking-widest mb-1', color)}>{team}</p>
            {players.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <span className="text-xs truncate">{p.name}</span>
                <span className="text-xs font-mono text-muted-foreground ml-1 shrink-0">{p.rating}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Managers widget ───────────────────────────────────────────────────────────

function ManagersWidget({ gameId }: { gameId: string }) {
  const { data } = useQuery({
    queryKey: ['managers', gameId],
    queryFn: () => fetchManagers(gameId),
    staleTime: 60 * 60_000,
  })
  if (!data?.homeManager && !data?.awayManager) return null
  return (
    <div className="flex justify-between text-xs text-muted-foreground mt-1">
      <span>Técnico: <span className="text-foreground/70">{data.homeManager?.name ?? '—'}</span></span>
      <span>Técnico: <span className="text-foreground/70">{data.awayManager?.name ?? '—'}</span></span>
    </div>
  )
}

// ── Confidence meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100)
  const color = pct >= 80 ? '#34d399' : pct >= 65 ? '#fbbf24' : '#6b7280'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Confiança</span>
        <span className="font-mono tabular-nums" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GamePage({ params }: { params: { id: string } }) {
  const id = params.id
  const router = useRouter()
  const { data, isLoading, error } = useAnalysis(id)

  if (isLoading) {
    return (
      <div className="p-5 max-w-5xl mx-auto space-y-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-32">
        <p className="text-muted-foreground text-sm">Jogo não encontrado</p>
        <button onClick={() => router.push('/')} className="text-primary text-sm hover:underline">← Voltar</button>
      </div>
    )
  }

  const { game, signals, homeStats: h, awayStats: a, report, news = [] } = data
  const topSignal = signals?.[0]
  const homeGoals = h?.goalsScoredAvg ?? 1.2
  const awayGoals = a?.goalsScoredAvg ?? 1.0
  const isLive = game.status === 'inprogress' || game.status === 'halftime'
  const isFinished = game.status === 'finished'

  // Win probabilities derived from Poisson
  const poissonWin = (() => {
    let home = 0, draw = 0, away = 0
    for (let hg = 0; hg < 6; hg++) {
      for (let ag = 0; ag < 6; ag++) {
        const p = Math.exp(-homeGoals) * Math.pow(homeGoals, hg) / factorial(hg)
               * Math.exp(-awayGoals) * Math.pow(awayGoals, ag) / factorial(ag)
        if (hg > ag) home += p
        else if (hg === ag) draw += p
        else away += p
      }
    }
    return { home, draw, away }
  })()

  function factorial(n: number): number {
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r
  }

  return (
    <div className="flex flex-col">
      {/* Premium sticky header */}
      <div className="sticky top-0 z-10 glass-topbar px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={() => router.back()}
            className="shrink-0 flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Voltar</span>
          </button>

          {/* Centered scoreboard */}
          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <span className="text-sm font-semibold truncate text-right flex-1 min-w-0">
              {game.homeTeam}
            </span>
            <div className="shrink-0 flex flex-col items-center gap-0.5">
              {isLive ? (
                <span className="flex items-center gap-1 text-emerald-400 text-[10px] font-semibold tracking-wide uppercase">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                  </span>
                  Ao Vivo
                </span>
              ) : (
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide">
                  {isFinished ? 'Encerrado' : kickoffBRT(game.kickoffAt)}
                </span>
              )}
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-white/[0.04] rounded-md border border-white/[0.06] font-mono">
                vs
              </span>
            </div>
            <span className="text-sm font-semibold truncate text-left flex-1 min-w-0">
              {game.awayTeam}
            </span>
          </div>

          {/* Signal badge */}
          <div className="shrink-0 flex items-center gap-2">
            {!isLive && !isFinished && (
              <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
                {kickoffBRT(game.kickoffAt)}
              </span>
            )}
            {topSignal && <MarketBadge market={topSignal.market} size="sm" />}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center mt-0.5 max-w-5xl mx-auto">
          {game.league} · {game.country}
        </p>
      </div>

      {/* Main layout */}
      <div className="max-w-5xl mx-auto w-full px-4 py-4">
        <div className="flex gap-5 items-start">

          {/* ── Left column: tabbed content ─────────────────────────── */}
          <div className="flex-1 min-w-0">
            <GameTabs
              isLive={isLive}
              isFinished={isFinished}
              game={game}
              h={h}
              a={a}
              report={report}
              signals={signals}
              news={news}
              homeGoals={homeGoals}
              awayGoals={awayGoals}
              poissonWin={poissonWin}
            />
          </div>

          {/* ── Right sidebar: sticky action zone ───────────────────── */}
          <div className="w-72 shrink-0 space-y-2 hidden lg:block sticky top-[72px]">
            <SignalsPanel signals={signals} />
            <Section title="Odds" type="analysis" defaultOpen={true}>
              <OddsSection gameId={game.id} />
            </Section>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Signals panel ─────────────────────────────────────────────────────────────

type Signal = NonNullable<NonNullable<ReturnType<typeof useAnalysis>['data']>['signals']>[number]

function SignalsPanel({ signals }: { signals: Signal[] | null | undefined }) {
  if (!signals || signals.length === 0) {
    return (
      <div className="glass-analysis rounded-[20px] px-4 py-5 flex flex-col items-center gap-2 text-center">
        <p className="text-2xl opacity-10">◈</p>
        <p className="text-xs text-muted-foreground">Nenhum sinal gerado</p>
      </div>
    )
  }
  return (
    <div className="glass-analysis rounded-[20px] px-4 py-4 space-y-3">
      <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-medium">Sinais</p>
      {signals.map(s => (
        <div key={s.id} className="space-y-2 pb-3 border-b border-white/[0.04] last:border-0 last:pb-0">
          <div className="flex items-center justify-between">
            <MarketBadge market={s.market} size="md" />
            <span className="text-xl font-bold font-mono tabular-nums">{Math.round(s.probability * 100)}%</span>
          </div>
          <ConfidenceMeter value={s.confidence} />
          {s.ev != null && (
            <p className="text-xs font-mono">
              EV: <span className={s.ev >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {s.ev >= 0 ? '+' : ''}{s.ev.toFixed(1)}%
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── News list ─────────────────────────────────────────────────────────────────

function NewsList({ news }: { news: Array<{ title: string; url?: string; source?: string; publishedAt?: string }> }) {
  if (!news.length) return null
  return (
    <ul className="space-y-3">
      {news.map((item, i) => (
        <li key={i} className="flex gap-2.5 items-start">
          <div className="shrink-0 w-1 h-1 rounded-full bg-violet-400/50 mt-2" />
          <div className="min-w-0">
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="text-sm text-foreground/80 hover:text-foreground leading-snug line-clamp-2 transition-colors">
                {item.title}
              </a>
            ) : (
              <p className="text-sm text-foreground/80 leading-snug line-clamp-2">{item.title}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground/60">{item.source}</span>
              {item.publishedAt && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="text-xs text-muted-foreground/40">
                    {new Date(item.publishedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </span>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

// ── Game tabs ─────────────────────────────────────────────────────────────────

type GameTabsProps = {
  isLive: boolean
  isFinished: boolean
  game: NonNullable<ReturnType<typeof useAnalysis>['data']>['game']
  h: NonNullable<ReturnType<typeof useAnalysis>['data']>['homeStats']
  a: NonNullable<ReturnType<typeof useAnalysis>['data']>['awayStats']
  report: string | null | undefined
  signals: NonNullable<ReturnType<typeof useAnalysis>['data']>['signals']
  news: Array<{ title: string; url?: string; source?: string; publishedAt?: string }>
  homeGoals: number
  awayGoals: number
  poissonWin: { home: number; draw: number; away: number }
}

function GameTabs({ isLive, isFinished, game, h, a, report, signals, news, homeGoals, awayGoals, poissonWin }: GameTabsProps) {
  const tabs = [
    ...(isLive ? [{ id: 'live', label: 'Ao Vivo', isLive: true }] : []),
    { id: 'intelligence', label: 'Inteligência', isLive: false },
    { id: 'stats', label: 'Stats', isLive: false },
    { id: 'lineups', label: 'Escalação', isLive: false },
  ]

  const [activeTab, setActiveTab] = useState<string>(isLive ? 'live' : 'intelligence')

  return (
    <div className="flex flex-col gap-4">
      {/* Tab bar */}
      <div className="flex p-1 gap-0.5 bg-white/[0.025] backdrop-blur-xl border border-white/[0.05] rounded-2xl w-fit overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-xl transition-colors duration-200 outline-none whitespace-nowrap z-10',
                isActive ? 'text-foreground' : 'text-foreground/40 hover:text-foreground/70 hover:bg-white/[0.02]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="game-tab-pill"
                  className={cn(
                    'absolute inset-0 rounded-xl -z-10',
                    'bg-white/[0.06] border border-white/[0.10]',
                    'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)]',
                    tab.isLive && 'border-emerald-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_0_16px_rgba(16,185,129,0.08)]'
                  )}
                  transition={{ type: 'spring', bounce: 0.18, duration: 0.55 }}
                />
              )}
              {tab.isLive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className={cn('absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75', isActive && 'animate-ping')} />
                  <span className={cn('relative inline-flex rounded-full h-1.5 w-1.5', isActive ? 'bg-emerald-400' : 'bg-emerald-600/50')} />
                </span>
              )}
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(3px)' }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'live' && (
            <div className="space-y-3">
              {/* Coach — aurora glow wrapper */}
              <div className="relative">
                <div className="absolute -inset-6 bg-violet-600/[0.08] blur-[60px] rounded-full pointer-events-none" />
                <CoachCard gameId={game.id} isLive={true} />
              </div>

              <div className="glass-live rounded-[20px] overflow-hidden">
                <div className="px-4 py-4">
                  <MatchOverview
                    gameId={game.id}
                    homeTeam={game.homeTeam}
                    awayTeam={game.awayTeam}
                    homeTeamId={game.homeTeamId}
                    awayTeamId={game.awayTeamId}
                  />
                </div>
              </div>

              <div className="glass-live rounded-[20px] overflow-hidden">
                <div className="px-4 py-4">
                  <AttackDonut
                    gameId={game.id}
                    homeTeam={game.homeTeam}
                    awayTeam={game.awayTeam}
                  />
                </div>
              </div>

              {(isLive || isFinished) && (
                <Section title="Narração" type="live" defaultOpen={false}>
                  <CommentarySection gameId={game.id} />
                </Section>
              )}
              {(isLive || isFinished) && (
                <Section title="Destaques" type="live" defaultOpen={false}>
                  <HighlightsSection gameId={game.id} />
                </Section>
              )}

              {/* Mobile-only signals + odds */}
              <div className="lg:hidden space-y-2 pt-1">
                <SignalsPanel signals={signals} />
                <Section title="Odds" type="analysis" defaultOpen={true}>
                  <OddsSection gameId={game.id} />
                </Section>
              </div>
            </div>
          )}

          {activeTab === 'intelligence' && (
            <div className="space-y-3">
              <div className="glass-analysis rounded-[20px] px-4 py-5">
                {report ? (
                  (() => {
                    const parsed = parseReport(report)
                    return parsed ? (
                      <AnalysisReportView report={parsed} />
                    ) : (
                      <ul className="space-y-1.5">
                        {report.split('\n').filter(Boolean).map((line, i) => (
                          <li key={i} className="flex gap-2 text-sm text-foreground/70 leading-relaxed">
                            <span className="text-violet-400/60 shrink-0 mt-0.5">·</span>
                            <span>{line.replace(/^[-•·#]\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                    )
                  })()
                ) : (
                  <div className="space-y-2">
                    {[60, 85, 70, 90, 50].map((w, i) => (
                      <Skeleton key={i} className="h-3 rounded" style={{ width: `${w}%` }} />
                    ))}
                    <p className="text-xs text-muted-foreground/50 pt-1">Aguardando análise...</p>
                  </div>
                )}
              </div>

              <div className="glass-analysis rounded-[20px] px-4 py-5 space-y-4">
                <p className="text-xs text-muted-foreground/60 uppercase tracking-widest font-medium">Distribuição Poisson</p>
                <PoissonHeatmap
                  homeGoals={homeGoals}
                  awayGoals={awayGoals}
                  homeTeam={game.homeTeam}
                  awayTeam={game.awayTeam}
                />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: game.homeTeam, value: poissonWin.home, color: 'text-sky-400' },
                    { label: 'Empate', value: poissonWin.draw, color: 'text-muted-foreground' },
                    { label: game.awayTeam, value: poissonWin.away, color: 'text-orange-400' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center py-3 bg-white/[0.03] rounded-xl">
                      <p className={cn('text-lg font-bold font-mono tabular-nums', color)}>
                        {(value * 100).toFixed(0)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate px-1">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile-only signals + odds */}
              <div className="lg:hidden space-y-2 pt-1">
                <SignalsPanel signals={signals} />
                <Section title="Odds" type="analysis" defaultOpen={false}>
                  <OddsSection gameId={game.id} />
                </Section>
              </div>
            </div>
          )}

          {activeTab === 'stats' && (
            <div className="space-y-3">
              <div className="glass-analysis rounded-[20px] px-4 py-5 space-y-1">
                <div className="flex justify-between text-xs font-semibold mb-3">
                  <span className="text-sky-400">{game.homeTeam}</span>
                  <span className="text-orange-400">{game.awayTeam}</span>
                </div>
                <StatRow label="xG marc." home={h?.xgAvg} away={a?.xgAvg} />
                <StatRow label="xG sofr." home={h?.xgConcededAvg} away={a?.xgConcededAvg} higherIsBetter={false} />
                <StatRow label="Gols marc." home={h?.goalsScoredAvg} away={a?.goalsScoredAvg} />
                <StatRow label="Gols sofr." home={h?.goalsConcededAvg} away={a?.goalsConcededAvg} higherIsBetter={false} />
                <StatRow label="Over 2.5 %" home={h?.over25Pct} away={a?.over25Pct} format="pct" />
                {h?.possessionAvg != null && <StatRow label="Posse %" home={h.possessionAvg} away={a?.possessionAvg} format="pct" />}
                {(h?.formLast5 || a?.formLast5) && (
                  <div className="mt-3 pt-3 border-t border-white/[0.04]">
                    <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-2">Forma recente</p>
                    <div className="flex items-center justify-between">
                      <FormPills form={h?.formLast5} />
                      <span className="text-xs text-muted-foreground">vs</span>
                      <FormPills form={a?.formLast5} />
                    </div>
                  </div>
                )}
                {(h || a) && (
                  <div className="pt-3">
                    <XGChart
                      homeTeam={game.homeTeam}
                      awayTeam={game.awayTeam}
                      homeXg={h?.xgAvg}
                      awayXg={a?.xgAvg}
                      homeGoals={h?.goalsScoredAvg}
                      awayGoals={a?.goalsScoredAvg}
                      homeXgConceded={h?.xgConcededAvg}
                      awayXgConceded={a?.xgConcededAvg}
                    />
                  </div>
                )}
                <VotesWidget gameId={game.id} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
                <ManagersWidget gameId={game.id} />
                {(isLive || isFinished) && (
                  <BestPlayersWidget gameId={game.id} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
                )}
              </div>

              <div className="glass-analysis rounded-[20px] px-4 py-5">
                <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-3 font-medium">H2H</p>
                <H2HSection gameId={game.id} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
              </div>
            </div>
          )}

          {activeTab === 'lineups' && (
            <div className="space-y-3">
              <div className="glass-analysis rounded-[20px] px-4 py-5">
                <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-3 font-medium">Elenco</p>
                <SquadSection gameId={game.id} homeTeam={game.homeTeam} awayTeam={game.awayTeam} />
              </div>
              {news.length > 0 && (
                <div className="glass-analysis rounded-[20px] px-4 py-5">
                  <p className="text-xs text-muted-foreground/60 uppercase tracking-widest mb-3 font-medium">
                    Notícias ({news.length})
                  </p>
                  <NewsList news={news} />
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

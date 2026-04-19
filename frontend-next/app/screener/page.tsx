'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useGamesToday } from '@/hooks/useSignals'
import { MarketBadge } from '@/components/signals/MarketBadge'
import { FormPills } from '@/components/game/FormPills'
import { TeamLogo } from '@/components/game/TeamLogo'
import { FilterChipGroup, ToggleChip } from '@/components/screener/FilterChips'
import { SortableHeader } from '@/components/screener/SortableHeader'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Game } from '@/types'

interface Filters {
  minOver25Pct: number
  minXg: number
  hasSignal: boolean
}

type SortField = 'kickoffAt' | 'over25' | 'xg' | 'confidence'
type SortDir = 'asc' | 'desc'

function kickoffBRT(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
  })
}

function isLive(status: string) {
  return ['inprogress', 'live', 'first_half', 'second_half', 'halftime',
    'extra_time_first', 'extra_time_second', 'pause'].includes(status)
}

function isFinished(status: string) {
  return ['finished', 'completed', 'ended'].includes(status)
}

function passes(game: Game, f: Filters): boolean {
  const h = game.homeStats
  const a = game.awayStats
  if (f.hasSignal && game.signalCount === 0) return false
  if (h && a) {
    const avgOver = ((h.over25Pct ?? 0) + (a.over25Pct ?? 0)) / 2
    if (avgOver < f.minOver25Pct) return false
    const avgXg = ((h.xgAvg ?? 0) + (a.xgAvg ?? 0)) / 2
    if (avgXg < f.minXg) return false
  }
  return true
}

/* ── Status pill ── */
function StatusPill({ game }: { game: Game }) {
  const live = isLive(game.status)
  const finished = isFinished(game.status)

  if (live) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          <span className="text-[10px] font-mono text-red-400 font-semibold tracking-wider">LIVE</span>
        </div>
        {game.homeScore != null && game.awayScore != null && (
          <span className="text-sm font-bold font-mono tabular-nums">
            {game.homeScore}–{game.awayScore}
          </span>
        )}
      </div>
    )
  }

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        {game.homeScore != null && game.awayScore != null && (
          <span className="text-sm font-bold font-mono tabular-nums text-muted-foreground">
            {game.homeScore}–{game.awayScore}
          </span>
        )}
        <span className="text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">FT</span>
      </div>
    )
  }

  return (
    <span className="font-mono text-xs text-muted-foreground tabular-nums">
      {kickoffBRT(game.kickoffAt)}
    </span>
  )
}

/* ── Times lado a lado (sem score — fica só no StatusPill) ── */
function MatchupCell({ game }: { game: Game }) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {/* Home */}
        <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
          <span className="text-sm font-medium truncate text-right">{game.homeTeam}</span>
          <TeamLogo teamId={game.homeTeamId} teamName={game.homeTeam} size={22} className="shrink-0" />
        </div>

        {/* vs */}
        <div className="shrink-0 w-6 text-center">
          <span className="text-xs text-muted-foreground/40 font-mono">vs</span>
        </div>

        {/* Away */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TeamLogo teamId={game.awayTeamId} teamName={game.awayTeam} size={22} className="shrink-0" />
          <span className="text-sm font-medium truncate">{game.awayTeam}</span>
        </div>
      </div>

      {/* Liga */}
      <div className="flex justify-center">
        <span className="text-[10px] text-muted-foreground/40 font-mono">{game.league}</span>
      </div>
    </div>
  )
}

/* ── Forma lado a lado ── */
function FormCell({ game }: { game: Game }) {
  const h = game.homeStats
  const a = game.awayStats
  if (!h?.formLast5 && !a?.formLast5) {
    return <span className="text-muted-foreground/30 text-xs">—</span>
  }
  return (
    <div className="flex items-center justify-center gap-2">
      <FormPills form={h?.formLast5} max={5} />
      <span className="text-muted-foreground/20 text-xs">|</span>
      <FormPills form={a?.formLast5} max={5} />
    </div>
  )
}

/* ── Stat cell com cor condicional ── */
function StatCell({ value, threshold, format }: {
  value: number | null
  threshold: number
  format: (v: number) => string
}) {
  if (value === null) return <span className="text-muted-foreground/30 text-sm font-mono">—</span>
  return (
    <span className={`text-sm font-mono tabular-nums ${value >= threshold ? 'text-orange-400' : 'text-muted-foreground'}`}>
      {format(value)}
    </span>
  )
}

/* ── Filtros ── */
function FilterPanel({ filters, setFilter, onClear }: {
  filters: Filters
  setFilter: <K extends keyof Filters>(key: K, val: Filters[K]) => void
  onClear: () => void
  hasActive: boolean
}) {
  const hasActive = filters.minOver25Pct > 0 || filters.minXg > 0 || filters.hasSignal

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Filtros</span>
        {hasActive && (
          <button
            onClick={onClear}
            className="text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            Limpar
          </button>
        )}
      </div>
      <FilterChipGroup
        label="Over 2.5 mín."
        options={[0, 40, 50, 60, 70].map(v => ({ label: `${v}%`, value: v }))}
        value={filters.minOver25Pct}
        onChange={v => setFilter('minOver25Pct', v)}
      />
      <FilterChipGroup
        label="xG médio mín."
        options={[0, 0.5, 1.0, 1.5, 2.0].map(v => ({ label: v.toFixed(1), value: v }))}
        value={filters.minXg}
        onChange={v => setFilter('minXg', v)}
        format="dec"
      />
      <ToggleChip
        label="Com sinal"
        active={filters.hasSignal}
        onChange={v => setFilter('hasSignal', v)}
      />
    </div>
  )
}

/* ── Page ── */
export default function Screener() {
  const router = useRouter()
  const { data: games, isLoading, dataUpdatedAt, refetch } = useGamesToday()
  const [filters, setFilters] = useState<Filters>({ minOver25Pct: 0, minXg: 0, hasSignal: false })
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'kickoffAt', dir: 'asc' })
  const [drawerOpen, setDrawerOpen] = useState(false)

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters(f => ({ ...f, [key]: val }))

  const clearFilters = () => setFilters({ minOver25Pct: 0, minXg: 0, hasSignal: false })

  const handleSort = (field: string) =>
    setSort(s => ({
      field: field as SortField,
      dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc',
    }))

  const activeFilterCount =
    (filters.minOver25Pct > 0 ? 1 : 0) +
    (filters.minXg > 0 ? 1 : 0) +
    (filters.hasSignal ? 1 : 0)

  const totalGames = (games ?? []).length

  const rows = useMemo(() => {
    const filtered = (games ?? []).filter(g => passes(g, filters))
    return filtered.sort((a, b) => {
      // Live games sempre primeiro
      const aLive = isLive(a.status) ? 0 : 1
      const bLive = isLive(b.status) ? 0 : 1
      if (aLive !== bLive) return aLive - bLive

      let av = 0, bv = 0
      if (sort.field === 'kickoffAt') {
        av = new Date(a.kickoffAt).getTime()
        bv = new Date(b.kickoffAt).getTime()
      } else if (sort.field === 'over25') {
        av = a.homeStats && a.awayStats ? ((a.homeStats.over25Pct ?? 0) + (a.awayStats.over25Pct ?? 0)) / 2 : 0
        bv = b.homeStats && b.awayStats ? ((b.homeStats.over25Pct ?? 0) + (b.awayStats.over25Pct ?? 0)) / 2 : 0
      } else if (sort.field === 'xg') {
        av = a.homeStats && a.awayStats ? ((a.homeStats.xgAvg ?? 0) + (a.awayStats.xgAvg ?? 0)) / 2 : 0
        bv = b.homeStats && b.awayStats ? ((b.homeStats.xgAvg ?? 0) + (b.awayStats.xgAvg ?? 0)) / 2 : 0
      } else if (sort.field === 'confidence') {
        av = a.topSignal?.confidence ?? 0
        bv = b.topSignal?.confidence ?? 0
      }
      return sort.dir === 'asc' ? av - bv : bv - av
    })
  }, [games, filters, sort])

  const sortState = { field: sort.field, dir: sort.dir as 'asc' | 'desc' | null }
  const liveCount = (games ?? []).filter(g => isLive(g.status)).length

  const lastUpdatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="p-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight">Screener</h1>
            {liveCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                </span>
                {liveCount} ao vivo
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground font-mono">
              {isLoading ? '...' : (
                activeFilterCount > 0
                  ? `${rows.length} de ${totalGames} jogo${totalGames !== 1 ? 's' : ''}`
                  : `${rows.length} jogo${rows.length !== 1 ? 's' : ''}`
              )}
            </p>
            {lastUpdatedLabel && (
              <>
                <span className="text-muted-foreground/20 text-xs">·</span>
                <button
                  onClick={() => refetch()}
                  className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors font-mono"
                  title="Atualizar"
                >
                  {lastUpdatedLabel} ↺
                </button>
              </>
            )}
          </div>
        </div>
        <button
          className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-all"
          onClick={() => setDrawerOpen(true)}
        >
          ⊞ Filtros
          {activeFilterCount > 0 && (
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 py-4 border-b border-border">
            <SheetTitle className="text-sm font-semibold">Filtros</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <FilterPanel filters={filters} setFilter={setFilter} onClear={clearFilters} hasActive={activeFilterCount > 0} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex gap-5">
        {/* Filtros — desktop */}
        <aside className="hidden md:block w-48 shrink-0 sticky top-4 self-start">
          <FilterPanel filters={filters} setFilter={setFilter} onClear={clearFilters} hasActive={activeFilterCount > 0} />
        </aside>

        {/* Tabela */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-28 text-center"
            >
              <p className="text-4xl mb-3 opacity-30">⊞</p>
              <p className="text-sm text-muted-foreground">Nenhum jogo com esses critérios</p>
              {activeFilterCount > 0 && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs text-muted-foreground/60 hover:text-foreground underline underline-offset-2 transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </motion.div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="overflow-y-auto max-h-[calc(100vh-160px)]">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-background border-b border-border">
                    <TableRow className="border-0 hover:bg-transparent">
                      <SortableHeader label="Hora" field="kickoffAt" current={sortState} onSort={handleSort} className="text-center pl-4 w-16" />
                      <th className="text-center text-xs text-muted-foreground uppercase tracking-widest px-3 py-3">Partida</th>
                      <th className="text-center text-xs text-muted-foreground uppercase tracking-widest px-3 py-3 w-52">Forma H · A</th>
                      <SortableHeader label="O2.5%" field="over25" current={sortState} onSort={handleSort} className="w-16 text-right" />
                      <SortableHeader label="xG" field="xg" current={sortState} onSort={handleSort} className="w-14 text-right" />
                      <SortableHeader label="Conf" field="confidence" current={sortState} onSort={handleSort} className="w-20 text-right" />
                      <th className="text-center text-xs text-muted-foreground uppercase tracking-widest px-3 py-3 w-28">Sinal</th>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((game, i) => {
                      const h = game.homeStats
                      const a = game.awayStats
                      const avgOver = h && a ? ((h.over25Pct ?? 0) + (a.over25Pct ?? 0)) / 2 : null
                      const avgXg   = h && a ? ((h.xgAvg ?? 0) + (a.xgAvg ?? 0)) / 2 : null
                      const highConf = (game.topSignal?.confidence ?? 0) >= 0.8
                      const live = isLive(game.status)

                      return (
                        <motion.tr
                          key={game.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() => router.push(`/game/${game.id}`)}
                          className={[
                            'border-border cursor-pointer transition-colors',
                            live ? 'hover:bg-red-500/[0.06] border-l-2 border-l-red-500/30' : 'hover:bg-white/[0.06]',
                            highConf && !live ? 'bg-emerald-500/[0.03]' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          {/* Hora / Status */}
                          <TableCell className="pl-4 text-center align-middle">
                            <StatusPill game={game} />
                          </TableCell>

                          {/* Partida */}
                          <TableCell className="py-3">
                            <MatchupCell game={game} />
                          </TableCell>

                          {/* Forma H · A */}
                          <TableCell className="text-center">
                            <FormCell game={game} />
                          </TableCell>

                          {/* Over 2.5% */}
                          <TableCell className="text-right">
                            <StatCell
                              value={avgOver}
                              threshold={60}
                              format={v => `${v.toFixed(0)}%`}
                            />
                          </TableCell>

                          {/* xG */}
                          <TableCell className="text-right">
                            <StatCell
                              value={avgXg}
                              threshold={1.5}
                              format={v => v.toFixed(2)}
                            />
                          </TableCell>

                          {/* Confiança */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {game.topSignal ? (
                                <>
                                  <div className="w-14 h-1.5 bg-white/8 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full transition-all"
                                      style={{
                                        width: `${Math.round(game.topSignal.confidence * 100)}%`,
                                        backgroundColor:
                                          game.topSignal.confidence >= 0.8 ? '#34d399' :
                                          game.topSignal.confidence >= 0.65 ? '#fbbf24' : '#6b7280',
                                      }}
                                    />
                                  </div>
                                  <span className={`text-sm font-mono tabular-nums ${
                                    game.topSignal.confidence >= 0.8 ? 'text-emerald-400' :
                                    game.topSignal.confidence >= 0.65 ? 'text-amber-400' : 'text-muted-foreground'
                                  }`}>
                                    {Math.round(game.topSignal.confidence * 100)}%
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted-foreground/30 text-sm font-mono">—</span>
                              )}
                            </div>
                          </TableCell>

                          {/* Sinal */}
                          <TableCell className="text-center pr-4">
                            {game.topSignal ? (
                              <MarketBadge market={game.topSignal.market} />
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </TableCell>
                        </motion.tr>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

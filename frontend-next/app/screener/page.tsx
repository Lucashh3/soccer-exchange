'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { useGamesToday } from '@/hooks/useSignals'
import { MarketBadge } from '@/components/signals/MarketBadge'
import { FormPills } from '@/components/game/FormPills'
import { FilterChipGroup, ToggleChip } from '@/components/screener/FilterChips'
import { SortableHeader } from '@/components/screener/SortableHeader'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Game } from '@/types'

interface Filters {
  minBttsPct: number
  minOver25Pct: number
  minXg: number
  hasSignal: boolean
}

type SortField = 'kickoffAt' | 'btts' | 'over25' | 'xg' | 'confidence'
type SortDir = 'asc' | 'desc'

function kickoffBRT(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit', minute: '2-digit',
  })
}

function passes(game: Game, f: Filters): boolean {
  const h = game.homeStats
  const a = game.awayStats
  if (f.hasSignal && game.signalCount === 0) return false
  if (h && a) {
    const avgBtts = ((h.bttsPct ?? 0) + (a.bttsPct ?? 0)) / 2
    if (avgBtts < f.minBttsPct) return false
    const avgOver = ((h.over25Pct ?? 0) + (a.over25Pct ?? 0)) / 2
    if (avgOver < f.minOver25Pct) return false
    const avgXg = ((h.xgAvg ?? 0) + (a.xgAvg ?? 0)) / 2
    if (avgXg < f.minXg) return false
  }
  return true
}

function FilterPanel({
  filters,
  setFilter,
}: {
  filters: Filters
  setFilter: <K extends keyof Filters>(key: K, val: Filters[K]) => void
}) {
  return (
    <div className="space-y-4">
      <FilterChipGroup
        label="BTTS mín."
        options={[0, 40, 50, 60, 70].map(v => ({ label: `${v}%`, value: v }))}
        value={filters.minBttsPct}
        onChange={v => setFilter('minBttsPct', v)}
      />
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

export default function Screener() {
  const router = useRouter()
  const { data: games, isLoading } = useGamesToday()
  const [filters, setFilters] = useState<Filters>({ minBttsPct: 0, minOver25Pct: 0, minXg: 0, hasSignal: false })
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'kickoffAt', dir: 'asc' })
  const [drawerOpen, setDrawerOpen] = useState(false)

  const setFilter = <K extends keyof Filters>(key: K, val: Filters[K]) =>
    setFilters(f => ({ ...f, [key]: val }))

  const handleSort = (field: string) => {
    setSort(s => ({
      field: field as SortField,
      dir: s.field === field && s.dir === 'asc' ? 'desc' : 'asc',
    }))
  }

  const rows = useMemo(() => {
    const filtered = (games ?? []).filter(g => passes(g, filters))
    return filtered.sort((a, b) => {
      let av = 0, bv = 0
      if (sort.field === 'kickoffAt') {
        av = new Date(a.kickoffAt).getTime()
        bv = new Date(b.kickoffAt).getTime()
      } else if (sort.field === 'btts') {
        av = a.homeStats && a.awayStats ? ((a.homeStats.bttsPct ?? 0) + (a.awayStats.bttsPct ?? 0)) / 2 : 0
        bv = b.homeStats && b.awayStats ? ((b.homeStats.bttsPct ?? 0) + (b.awayStats.bttsPct ?? 0)) / 2 : 0
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

  return (
    <div className="p-5 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Screener</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {isLoading ? '...' : `${rows.length} jogo${rows.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {/* Mobile filter button */}
        <button
          className="md:hidden flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-white/20 transition-all"
          onClick={() => setDrawerOpen(true)}
        >
          ⊞ Filtros
        </button>
      </div>

      {/* Mobile filter drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 py-4 border-b border-border">
            <SheetTitle className="text-sm font-semibold">Filtros</SheetTitle>
          </SheetHeader>
          <div className="p-4">
            <FilterPanel filters={filters} setFilter={setFilter} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex gap-5">
        {/* Filter panel — desktop only */}
        <aside className="hidden md:block w-48 shrink-0 space-y-4 sticky top-4 self-start">
          <FilterPanel filters={filters} setFilter={setFilter} />
        </aside>

        {/* Table */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
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
            </motion.div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <SortableHeader label="Hora" field="kickoffAt" current={sortState} onSort={handleSort} className="text-left pl-4" />
                    <th className="text-left text-xs text-muted-foreground uppercase tracking-widest px-3 py-3">Jogo</th>
                    <SortableHeader label="BTTS" field="btts" current={sortState} onSort={handleSort} />
                    <SortableHeader label="O2.5" field="over25" current={sortState} onSort={handleSort} />
                    <SortableHeader label="xG" field="xg" current={sortState} onSort={handleSort} />
                    <th className="text-center text-xs text-muted-foreground uppercase tracking-widest px-3 py-3">Forma</th>
                    <SortableHeader label="Conf" field="confidence" current={sortState} onSort={handleSort} />
                    <th className="text-center text-xs text-muted-foreground uppercase tracking-widest px-3 py-3">Sinal</th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((game, i) => {
                    const h = game.homeStats
                    const a = game.awayStats
                    const avgBtts = h && a ? ((h.bttsPct ?? 0) + (a.bttsPct ?? 0)) / 2 : null
                    const avgOver = h && a ? ((h.over25Pct ?? 0) + (a.over25Pct ?? 0)) / 2 : null
                    const avgXg   = h && a ? ((h.xgAvg ?? 0) + (a.xgAvg ?? 0)) / 2 : null
                    const highConf = (game.topSignal?.confidence ?? 0) >= 0.8

                    return (
                      <motion.tr
                        key={game.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.025 }}
                        onClick={() => router.push(`/game/${game.id}`)}
                        className={`border-border hover:bg-white/[0.03] cursor-pointer transition-colors${highConf ? ' bg-emerald-500/[0.04]' : ''}`}
                      >
                        <TableCell className="pl-4 font-mono text-xs text-muted-foreground tabular-nums">
                          {kickoffBRT(game.kickoffAt)}
                        </TableCell>
                        <TableCell>
                          <p className="text-sm font-medium">
                            {game.homeTeam} <span className="text-muted-foreground text-xs">vs</span> {game.awayTeam}
                          </p>
                          <p className="text-xs text-muted-foreground">{game.league}</p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-mono tabular-nums ${avgBtts !== null && avgBtts >= 60 ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                            {avgBtts !== null ? `${avgBtts.toFixed(0)}%` : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-mono tabular-nums ${avgOver !== null && avgOver >= 60 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                            {avgOver !== null ? `${avgOver.toFixed(0)}%` : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`text-sm font-mono tabular-nums ${avgXg !== null && avgXg >= 1.5 ? 'text-sky-400' : 'text-muted-foreground'}`}>
                            {avgXg !== null ? avgXg.toFixed(2) : '—'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <FormPills form={h?.formLast5} max={5} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {game.topSignal && (
                              <div className="w-12 h-1 bg-white/8 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.round(game.topSignal.confidence * 100)}%`,
                                    backgroundColor: game.topSignal.confidence >= 0.8 ? '#34d399' : game.topSignal.confidence >= 0.65 ? '#fbbf24' : '#6b7280',
                                  }}
                                />
                              </div>
                            )}
                            <span className="text-sm font-mono tabular-nums text-muted-foreground">
                              {game.topSignal ? `${Math.round(game.topSignal.confidence * 100)}%` : '—'}
                            </span>
                          </div>
                        </TableCell>
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
          )}
        </div>
      </div>
    </div>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useGamesToday } from '@/hooks/useSignals'
import { SignalCard } from '@/components/signals/SignalCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { Game, MarketType } from '@/types'
import { cn } from '@/lib/utils'
import { useFavorites } from '@/hooks/useFavorites'
import { useCoachSuggestions } from '@/hooks/useCoachSuggestions'
import { CoachCalendar } from '@/components/coach/CoachCalendar'
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BarChart2 } from 'lucide-react'

type FilterTab = 'all' | MarketType
type SortKey = 'time' | 'confidence' | 'probability'
type StatusFilter =
  | 'all' | 'live' | 'finished' | 'scheduled'
  | 'first_half' | 'second_half' | 'draw'
  | 'strong_superiority' | 'strong_pressure'
  | 'coach_suggestions'

const MARKET_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',      label: 'Todos'       },
  { id: 'over25',   label: 'Over 2.5'    },
  { id: 'backHome', label: 'Back Casa'   },
  { id: 'layHome',  label: 'Lay Casa'    },
  { id: 'backAway', label: 'Back Visit.' },
  { id: 'layAway',  label: 'Lay Visit.'  },
]

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all',                label: 'Todos'               },
  { id: 'live',               label: 'Ao Vivo'             },
  { id: 'scheduled',          label: 'A Iniciar'           },
  { id: 'finished',           label: 'Finalizados'         },
  { id: 'first_half',         label: '1º Tempo'            },
  { id: 'second_half',        label: '2º Tempo'            },
  { id: 'draw',               label: 'Empates'             },
  { id: 'strong_superiority', label: 'Forte Superioridade' },
  { id: 'strong_pressure',    label: 'Forte Pressão'       },
  { id: 'coach_suggestions',  label: 'Sugestão do Coach'   },
]

function isGameLive(g: Game)      { return g.status === 'inprogress' || g.status === 'live' || g.status === 'halftime' || g.status === 'pause' }
function isGameFinished(g: Game)  { return g.status === 'finished' || g.status === 'completed' }
function isGameScheduled(g: Game) { return g.status === 'scheduled' || g.status === 'notstarted' }

/** Estimate which half a live game is in based on elapsed time since kickoff */
function getGameHalf(g: Game): 1 | 2 | null {
  if (g.status === 'halftime') return null
  if (g.status !== 'inprogress' && g.status !== 'pause') return null
  const elapsedMin = (Date.now() - new Date(g.kickoffAt).getTime()) / 60000
  if (elapsedMin <= 50) return 1
  if (elapsedMin > 60) return 2
  return null
}

function isGameDraw(g: Game): boolean {
  return isGameLive(g) && g.homeScore != null && g.awayScore != null && g.homeScore === g.awayScore
}

function isStrongSuperiority(g: Game): boolean {
  const conf = g.topSignal?.confidence ?? 0
  const market = g.topSignal?.market
  return conf >= 0.75 && (market === 'backHome' || market === 'backAway')
}

function isStrongPressure(g: Game): boolean {
  return isGameLive(g) && (g.topSignal?.confidence ?? 0) >= 0.80
}

function filterGames(games: Game[], tab: FilterTab, status: StatusFilter, league: string | null): Game[] {
  let f = games

  if (league) f = f.filter(g => g.league === league)
  if (tab !== 'all') f = f.filter(g => g.topSignal?.market === tab)

  if (status !== 'all') {
    f = f.filter(g => {
      if (status === 'live')               return isGameLive(g)
      if (status === 'finished')           return isGameFinished(g)
      if (status === 'scheduled')          return isGameScheduled(g)
      if (status === 'first_half')         return getGameHalf(g) === 1
      if (status === 'second_half')        return getGameHalf(g) === 2
      if (status === 'draw')               return isGameDraw(g)
      if (status === 'strong_superiority') return isStrongSuperiority(g)
      if (status === 'strong_pressure')    return isStrongPressure(g)
      return true
    })
  }

  return f
}

function sortGames(games: Game[], sort: SortKey): Game[] {
  return [...games].sort((a, b) => {
    if (sort === 'time')        return new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()
    if (sort === 'confidence')  return (b.topSignal?.confidence ?? 0) - (a.topSignal?.confidence ?? 0)
    if (sort === 'probability') return (b.topSignal?.probability ?? 0) - (a.topSignal?.probability ?? 0)
    return 0
  })
}

function getStatusCount(games: Game[], status: StatusFilter): number {
  if (status === 'all') return games.length
  return games.filter(g => {
    if (status === 'live')               return isGameLive(g)
    if (status === 'finished')           return isGameFinished(g)
    if (status === 'scheduled')          return isGameScheduled(g)
    if (status === 'first_half')         return getGameHalf(g) === 1
    if (status === 'second_half')        return getGameHalf(g) === 2
    if (status === 'draw')               return isGameDraw(g)
    if (status === 'strong_superiority') return isStrongSuperiority(g)
    if (status === 'strong_pressure')    return isStrongPressure(g)
    return true
  }).length
}

function StatusSection({
  title,
  games,
  isLoading,
  isFavorite,
  onToggleFavorite,
}: {
  title: string
  games: Game[]
  isLoading: boolean
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-[20px]" />
          ))}
        </div>
      </div>
    )
  }

  if (games.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
        {title}
        <span className="font-mono font-normal opacity-60">{games.length}</span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {games.map((game) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <SignalCard
              game={game}
              isFavorite={isFavorite(game.id)}
              onToggleFavorite={onToggleFavorite}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function CoachSuggestionsView({
  suggestions,
  allGames,
  isLoading,
  generatedAt,
  fromCache,
  isFavorite,
  onToggleFavorite,
}: {
  suggestions: { gameId: string; rationale: string }[]
  allGames: Game[]
  isLoading: boolean
  generatedAt: number
  fromCache: boolean
  isFavorite: (id: string) => boolean
  onToggleFavorite: (id: string) => void
}) {
  const gameMap = useMemo(() => new Map(allGames.map((g) => [g.id, g])), [allGames])

  const suggestedGames = useMemo(
    () => suggestions.flatMap((s) => {
      const game = gameMap.get(s.gameId)
      return game ? [{ game, rationale: s.rationale }] : []
    }),
    [suggestions, gameMap],
  )

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[130px] rounded-xl" />
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2">O Coach está analisando os jogos do dia...</p>
      </div>
    )
  }

  if (suggestedGames.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-12 text-center">
        Nenhuma sugestão disponível no momento. Tente novamente mais tarde.
      </p>
    )
  }

  const updatedAt = generatedAt > 0
    ? new Date(generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        {updatedAt ? (
          <p className="text-xs text-muted-foreground font-mono">
            {suggestedGames.length} jogos selecionados pelo Coach
            {' · '}atualizado às {updatedAt}
            {fromCache && ' · cache'}
          </p>
        ) : <span />}

        <Dialog>
          <DialogTrigger
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/[0.05] border border-transparent hover:border-border transition-all"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Histórico
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Histórico de Acerto — Coach</DialogTitle>
            </DialogHeader>
            <CoachCalendar />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {suggestedGames.map(({ game, rationale }) => (
          <motion.div
            key={game.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-1.5"
          >
            <SignalCard
              game={game}
              isFavorite={isFavorite(game.id)}
              onToggleFavorite={onToggleFavorite}
            />
            <p className="text-xs text-muted-foreground px-1 leading-relaxed">{rationale}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: games, isLoading } = useGamesToday()
  const [tab, setTab]               = useState<FilterTab>('all')
  const [status, setStatus]         = useState<StatusFilter>('all')
  const [sort, setSort]             = useState<SortKey>('time')
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null)

  const { favorites, toggle: toggleFavorite, isFavorite } = useFavorites()
  const [showFavOnly, setShowFavOnly] = useState(false)

  const isCoachTab = status === 'coach_suggestions'
  const { data: suggestionsData, isLoading: isSuggestionsLoading } = useCoachSuggestions(isCoachTab)

  const allGames = games ?? []

  // League options derived from all games
  const leagueOptions = useMemo(() => {
    const map = new Map<string, number>()
    allGames.forEach(g => map.set(g.league, (map.get(g.league) ?? 0) + 1))
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [allGames])

  const liveCount = useMemo(() => getStatusCount(allGames, 'live'), [allGames])

  const filtered = useMemo(() => {
    let f = filterGames(allGames, tab, status, selectedLeague)
    if (showFavOnly) f = f.filter(g => favorites.has(g.id))
    return f
  }, [allGames, tab, status, selectedLeague, showFavOnly, favorites])

  const sorted = useMemo(() => sortGames(filtered, sort), [filtered, sort])

  const liveGames      = useMemo(() => sorted.filter(isGameLive),      [sorted])
  const finishedGames  = useMemo(() => sorted.filter(isGameFinished),  [sorted])
  const scheduledGames = useMemo(() => sorted.filter(isGameScheduled), [sorted])

  const withSignals = allGames.filter(g => g.signalCount > 0).length

  const isFiltered = tab !== 'all' || status !== 'all' || selectedLeague !== null || showFavOnly

  // A key that changes with filter state so AnimatePresence can remount
  const gridKey = `${tab}-${status}-${sort}-${selectedLeague ?? 'all'}-${showFavOnly}`

  return (
    <div className="flex">

      {/* League sidebar — desktop only, sticky */}
      <div className="hidden lg:flex flex-col w-52 shrink-0 border-r border-border sticky top-0 h-[calc(100vh-3rem)] overflow-y-auto">
        <div className="p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Campeonatos</p>
          <div className="space-y-0.5">
            <button
              onClick={() => setShowFavOnly(v => !v)}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all mb-1',
                showFavOnly
                  ? 'bg-yellow-400/10 text-yellow-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <span className="flex items-center gap-1.5">
                <svg width="11" height="11" viewBox="0 0 24 24" fill={showFavOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Favoritos
              </span>
              {favorites.size > 0 && <span className="font-mono opacity-60">{favorites.size}</span>}
            </button>
            <button
              onClick={() => setSelectedLeague(null)}
              className={cn(
                'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all',
                selectedLeague === null
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              )}
            >
              <span>Todos os jogos</span>
              <span className="font-mono opacity-60">{allGames.length}</span>
            </button>
            {leagueOptions.map(l => (
              <button
                key={l.name}
                onClick={() => setSelectedLeague(l.name)}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all',
                  selectedLeague === l.name
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                <span className="truncate">{l.name}</span>
                <span className="font-mono opacity-60 shrink-0 ml-1">{l.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-5 min-w-0">
      {/* Summary */}
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{selectedLeague || 'Hoje'}</h1>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">
            {isLoading ? '...' : `${sorted.length} jogos · ${withSignals} sinais`}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-5 -mx-5 px-5">
        {/* Row 1: Status tabs */}
        <div className="flex items-center justify-between gap-3 border-b border-border">
          <div className="flex overflow-x-auto no-scrollbar flex-1">
            {STATUS_TABS.map(s => {
              const count = s.id !== 'all' ? getStatusCount(allGames, s.id) : null
              const isLiveTab = s.id === 'live'
              return (
                <button
                  key={s.id}
                  onClick={() => setStatus(s.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors shrink-0',
                    status === s.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  {isLiveTab && liveCount > 0 && (
                    <span className="relative flex h-1.5 w-1.5 shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                  )}
                  {s.label}
                  {count !== null && count > 0 && (
                    <span className="opacity-50 font-mono text-[10px]">{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="bg-transparent text-muted-foreground text-xs px-1 py-1 outline-none cursor-pointer shrink-0 mb-px"
          >
            <option value="time">Horário</option>
            <option value="confidence">Confiança</option>
            <option value="probability">Probabilidade</option>
          </select>
        </div>

        {/* Row 2: Market pills + controls */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <div className="flex gap-1 flex-1 overflow-x-auto no-scrollbar">
            {MARKET_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0',
                  tab === t.id
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* League dropdown — mobile only (desktop uses sidebar) */}
          <select
            value={selectedLeague ?? ''}
            onChange={e => setSelectedLeague(e.target.value || null)}
            className="lg:hidden bg-secondary text-foreground/70 border border-border rounded-lg text-xs px-2 py-1.5 outline-none cursor-pointer shrink-0"
          >
            <option value="">Todas as ligas</option>
            {leagueOptions.map(l => (
              <option key={l.name} value={l.name}>
                {l.name} ({l.count})
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowFavOnly(v => !v)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all shrink-0',
              showFavOnly
                ? 'bg-yellow-400/15 text-yellow-400'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill={showFavOnly ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Favoritos
            {favorites.size > 0 && (
              <span className="opacity-60 font-mono">{favorites.size}</span>
            )}
          </button>

          {isFiltered && (
            <button
              onClick={() => { setTab('all'); setStatus('all'); setSelectedLeague(null); setShowFavOnly(false) }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors shrink-0"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {isCoachTab ? (
        <CoachSuggestionsView
          suggestions={suggestionsData?.suggestions ?? []}
          allGames={allGames}
          isLoading={isSuggestionsLoading || isLoading}
          generatedAt={suggestionsData?.generatedAt ?? 0}
          fromCache={suggestionsData?.fromCache ?? false}
          isFavorite={isFavorite}
          onToggleFavorite={toggleFavorite}
        />
      ) : sorted.length === 0 && !isLoading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Nenhum jogo encontrado</p>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={gridKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <StatusSection title="Ao Vivo"     games={liveGames}      isLoading={isLoading} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
            <StatusSection title="A Iniciar"   games={scheduledGames} isLoading={isLoading} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
            <StatusSection title="Finalizados" games={finishedGames}  isLoading={isLoading} isFavorite={isFavorite} onToggleFavorite={toggleFavorite} />
          </motion.div>
        </AnimatePresence>
      )}
      </div> {/* end main content */}
    </div>
  )
}

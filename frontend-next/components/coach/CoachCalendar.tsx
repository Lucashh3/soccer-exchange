'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useCoachHistory, useCoachHistoryByDate } from '@/hooks/useCoachHistory'
import type { CoachDaySummary } from '@/lib/api'

const MARKET_LABEL: Record<string, string> = {
  backHome: 'Back Casa',
  backAway: 'Back Visit.',
  layHome: 'Lay Casa',
  layAway: 'Lay Visit.',
  over25: 'Over 2.5',
  under25: 'Under 2.5',
}

function outcomeColor(accuracy: number | null): string {
  if (accuracy === null) return 'bg-muted-foreground/20 border-muted-foreground/20'
  if (accuracy >= 60) return 'bg-emerald-500/20 border-emerald-500/40'
  if (accuracy >= 40) return 'bg-yellow-500/20 border-yellow-500/40'
  return 'bg-red-500/20 border-red-500/40'
}

function outcomeTextColor(accuracy: number | null, _pending?: number): string {
  if (accuracy === null) return 'text-muted-foreground'
  if (accuracy >= 60) return 'text-emerald-400'
  if (accuracy >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

interface DayDetailProps {
  date: string
  onClose: () => void
}

function DayDetail({ date, onClose }: DayDetailProps) {
  const { data, isLoading } = useCoachHistoryByDate(date)

  return (
    <div className="mt-4 rounded-xl border border-border bg-card/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">fechar</button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Carregando...</p>}

      {data && data.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhuma sugestão registrada neste dia.</p>
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((item) => (
            <div key={item.id} className="flex items-start gap-3 text-xs">
              <span className={cn(
                'shrink-0 mt-0.5 w-2 h-2 rounded-full',
                item.outcome === 'won'  ? 'bg-emerald-500' :
                item.outcome === 'lost' ? 'bg-red-500' :
                item.outcome === 'void' ? 'bg-muted-foreground' :
                'bg-yellow-500/60'
              )} />
              <div className="min-w-0">
                <span className="font-medium">{item.homeTeam} x {item.awayTeam}</span>
                <span className="text-muted-foreground"> · {MARKET_LABEL[item.market] ?? item.market}</span>
                <p className="text-muted-foreground mt-0.5 leading-relaxed">{item.rationale}</p>
              </div>
              <span className={cn(
                'shrink-0 text-[10px] font-medium uppercase',
                item.outcome === 'won'  ? 'text-emerald-400' :
                item.outcome === 'lost' ? 'text-red-400' :
                item.outcome === 'void' ? 'text-muted-foreground' :
                'text-yellow-400'
              )}>
                {item.outcome ?? 'pend.'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function CoachCalendar() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const { data: history, isLoading } = useCoachHistory(3)

  const summaryMap = new Map<string, CoachDaySummary>()
  if (history) {
    for (const d of history) summaryMap.set(d.date, d)
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
  const totalSlots = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
    setSelectedDate(null)
  }

  function nextMonth() {
    const nextM = viewMonth === 11 ? 0 : viewMonth + 1
    const nextY = viewMonth === 11 ? viewYear + 1 : viewYear
    if (nextY > today.getFullYear() || (nextY === today.getFullYear() && nextM > today.getMonth())) return
    setViewMonth(nextM)
    setViewYear(nextY)
    setSelectedDate(null)
  }

  const canGoNext = !(viewYear === today.getFullYear() && viewMonth === today.getMonth())

  // Summary stats for current month
  const monthDays = history?.filter(d => d.date.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`)) ?? []
  const totalWon = monthDays.reduce((s, d) => s + d.won, 0)
  const totalLost = monthDays.reduce((s, d) => s + d.lost, 0)
  const monthAccuracy = (totalWon + totalLost) > 0 ? Math.round(totalWon / (totalWon + totalLost) * 100) : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold capitalize">{monthName}</p>
          {monthAccuracy !== null && (
            <p className={cn('text-xs font-mono', outcomeTextColor(monthAccuracy, 0))}>
              {monthAccuracy}% acerto no mês · {totalWon}W {totalLost}L
            </p>
          )}
          {monthAccuracy === null && !isLoading && (
            <p className="text-xs text-muted-foreground">Sem dados avaliados neste mês</p>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={prevMonth} className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">←</button>
          <button onClick={nextMonth} disabled={!canGoNext} className={cn('px-2 py-1 rounded text-xs transition-colors', canGoNext ? 'text-muted-foreground hover:text-foreground hover:bg-white/5' : 'text-muted-foreground/30 cursor-default')}>→</button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
          <div key={d} className="text-center text-[10px] text-muted-foreground font-medium py-1">{d}</div>
        ))}

        {/* Day cells */}
        {Array.from({ length: totalSlots }).map((_, i) => {
          const dayNum = i - firstDay + 1
          const isValid = dayNum >= 1 && dayNum <= daysInMonth
          if (!isValid) return <div key={i} />

          const dateStr = toDateStr(viewYear, viewMonth, dayNum)
          const summary = summaryMap.get(dateStr)
          const isFuture = dateStr > today.toISOString().slice(0, 10)
          const isToday = dateStr === today.toISOString().slice(0, 10)
          const isSelected = selectedDate === dateStr

          return (
            <button
              key={i}
              disabled={isFuture || (!summary && !isLoading)}
              onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              className={cn(
                'aspect-square rounded-lg border text-xs font-mono transition-all flex flex-col items-center justify-center gap-0.5',
                isFuture ? 'opacity-20 cursor-default border-transparent' :
                (!summary && !isLoading) ? 'border-transparent text-muted-foreground/30 cursor-default' :
                isSelected ? 'ring-1 ring-primary ' + outcomeColor(summary?.accuracy ?? null) :
                outcomeColor(summary?.accuracy ?? null) + ' hover:brightness-125 cursor-pointer',
                isToday && 'ring-1 ring-primary/50'
              )}
            >
              <span className={cn(
                isToday ? 'text-primary font-semibold' : 'text-foreground/70'
              )}>{dayNum}</span>
              {summary && (
                <span className={cn('text-[9px]', outcomeTextColor(summary.accuracy, summary.pending))}>
                  {summary.accuracy !== null ? `${summary.accuracy}%` : '·'}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/20 border border-emerald-500/40" /> ≥60%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500/20 border border-yellow-500/40" /> 40–59%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/20 border border-red-500/40" /> &lt;40%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-muted-foreground/20 border border-muted-foreground/20" /> pendente</span>
      </div>

      {/* Day detail */}
      {selectedDate && <DayDetail date={selectedDate} onClose={() => setSelectedDate(null)} />}
    </div>
  )
}

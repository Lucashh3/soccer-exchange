'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useQuery } from '@tanstack/react-query'

interface TeamAttackRates {
  total:       number
  perMin:      number
  last5min:    number
  last5trend:  'up' | 'down' | 'stable'
  last10min:   number
  last10trend: 'up' | 'down' | 'stable'
}

interface AttackStats {
  home: { attacks: TeamAttackRates; dangerous: TeamAttackRates }
  away: { attacks: TeamAttackRates; dangerous: TeamAttackRates }
  updatedAt: number
}

const HOME_COLOR      = '#3b82f6'
const AWAY_COLOR      = '#f97316'
const NEUTRAL_COLOR   = '#374151'

function trendIcon(t: 'up' | 'down' | 'stable') {
  if (t === 'up')   return <span className="text-green-400 font-bold">↑</span>
  if (t === 'down') return <span className="text-red-400 font-bold">↓</span>
  return <span className="text-gray-500">→</span>
}

interface DonutProps {
  homeVal:   number
  awayVal:   number
  homeLabel: string
  awayLabel: string
  homeRates: TeamAttackRates
  awayRates: TeamAttackRates
  title:     string
}

function Donut({ homeVal, awayVal, homeLabel, awayLabel, homeRates, awayRates, title }: DonutProps) {
  const total = homeVal + awayVal || 1
  const data  = [
    { name: homeLabel, value: homeVal },
    { name: awayLabel, value: awayVal },
  ]

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">{title}</span>

      {/* Donut */}
      <div className="relative w-32 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={38}
              outerRadius={56}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              strokeWidth={0}
            >
              <Cell fill={HOME_COLOR} />
              <Cell fill={AWAY_COLOR} />
            </Pie>
            <Tooltip
              formatter={(v: number) => [`${((v / total) * 100).toFixed(0)}%`]}
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6, fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centro: totais */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs font-bold" style={{ color: HOME_COLOR }}>{homeVal}</span>
          <span className="text-gray-500 text-xs leading-none">vs</span>
          <span className="text-xs font-bold" style={{ color: AWAY_COLOR }}>{awayVal}</span>
        </div>
      </div>

      {/* Taxas */}
      <div className="w-full text-xs space-y-1">
        {/* Cabeçalho */}
        <div className="grid grid-cols-3 text-gray-500 text-center">
          <span style={{ color: HOME_COLOR }} className="truncate text-left">{homeLabel}</span>
          <span></span>
          <span style={{ color: AWAY_COLOR }} className="truncate text-right">{awayLabel}</span>
        </div>

        {/* /min */}
        <div className="grid grid-cols-3 items-center text-center">
          <span className="text-gray-200 text-left">{homeRates.perMin}</span>
          <span className="text-gray-500 text-center">/min</span>
          <span className="text-gray-200 text-right">{awayRates.perMin}</span>
        </div>

        {/* 5min */}
        <div className="grid grid-cols-3 items-center text-center">
          <span className="text-gray-200 text-left flex items-center gap-0.5">
            {homeRates.last5min} {trendIcon(homeRates.last5trend)}
          </span>
          <span className="text-gray-500 text-center">5min</span>
          <span className="text-gray-200 text-right flex items-center justify-end gap-0.5">
            {trendIcon(awayRates.last5trend)} {awayRates.last5min}
          </span>
        </div>

        {/* 10min */}
        <div className="grid grid-cols-3 items-center text-center">
          <span className="text-gray-200 text-left flex items-center gap-0.5">
            {homeRates.last10min} {trendIcon(homeRates.last10trend)}
          </span>
          <span className="text-gray-500 text-center">10min</span>
          <span className="text-gray-200 text-right flex items-center justify-end gap-0.5">
            {trendIcon(awayRates.last10trend)} {awayRates.last10min}
          </span>
        </div>
      </div>
    </div>
  )
}

export function AttackDonut({ gameId, homeTeam, awayTeam }: { gameId: string; homeTeam: string; awayTeam: string }) {
  const { data, isLoading } = useQuery<AttackStats | null>({
    queryKey: ['attack-stats', gameId],
    queryFn: async () => {
      const res = await fetch(`/api/game/${gameId}/attack-stats`, { cache: 'no-store' })
      if (!res.ok) return null
      return res.json()
    },
    refetchInterval: 60_000,
    staleTime: 55_000,
  })

  if (isLoading) return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="h-4 w-32 bg-gray-800 rounded animate-pulse mb-3" />
      <div className="flex gap-4">
        <div className="flex-1 h-40 bg-gray-800 rounded animate-pulse" />
        <div className="flex-1 h-40 bg-gray-800 rounded animate-pulse" />
      </div>
    </div>
  )

  if (!data) return null

  const homeShort = homeTeam.split(' ')[0]
  const awayShort = awayTeam.split(' ')[0]

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">⚡ Ataques ao Vivo</h3>
      <div className="flex gap-6 justify-around">
        <Donut
          title="Ataques"
          homeVal={data.home.attacks.total}
          awayVal={data.away.attacks.total}
          homeLabel={homeShort}
          awayLabel={awayShort}
          homeRates={data.home.attacks}
          awayRates={data.away.attacks}
        />
        <div className="w-px bg-gray-800 self-stretch" />
        <Donut
          title="Perigosos"
          homeVal={data.home.dangerous.total}
          awayVal={data.away.dangerous.total}
          homeLabel={homeShort}
          awayLabel={awayShort}
          homeRates={data.home.dangerous}
          awayRates={data.away.dangerous}
        />
      </div>
      <p className="text-right text-xs text-gray-600 mt-3">
        atualizado {new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  )
}

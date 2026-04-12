'use client'

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Legend } from 'recharts'

interface Props {
  homeTeam: string
  awayTeam: string
  homeXg?: number | null
  awayXg?: number | null
  homeGoals?: number | null
  awayGoals?: number | null
  homeXgConceded?: number | null
  awayXgConceded?: number | null
}

export function XGChart({ homeTeam, awayTeam, homeXg, awayXg, homeGoals, awayGoals, homeXgConceded, awayXgConceded }: Props) {
  const data = [
    { metric: 'xG marc.', home: homeXg ?? 0,          away: awayXg ?? 0         },
    { metric: 'xG sofr.', home: homeXgConceded ?? 0,  away: awayXgConceded ?? 0 },
    { metric: 'Gols marc.',home: homeGoals ?? 0,       away: awayGoals ?? 0      },
  ]

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} barCategoryGap="30%">
        <XAxis
          dataKey="metric"
          tick={{ fontSize: 10, fill: 'rgba(232,234,240,0.45)', fontFamily: 'var(--font-jetbrains)' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide />
        <Legend
          formatter={(v) => v === 'home' ? homeTeam : awayTeam}
          wrapperStyle={{ fontSize: 11, color: 'rgba(232,234,240,0.6)' }}
        />
        <Bar dataKey="home" name="home" fill="#38bdf8" radius={[4,4,0,0]} />
        <Bar dataKey="away" name="away" fill="#f97316" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

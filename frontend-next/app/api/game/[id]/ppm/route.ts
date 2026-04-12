import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'
import { calcPpm, calcEntrySignal } from '@/lib/ppm'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const [graphRes, liveRes] = await Promise.all([
      fetch(`${EXPRESS}/games/${id}/graph`, { cache: 'no-store', signal: AbortSignal.timeout(10000), headers: backendHeaders() }),
      fetch(`${EXPRESS}/games/${id}/live`, { cache: 'no-store', signal: AbortSignal.timeout(10000), headers: backendHeaders() }),
    ])
    const graphData = await graphRes.json()
    const liveData = await liveRes.json()

    const points = graphData.points ?? []
    const minute = Number.isFinite(liveData?.clock?.minute)
      ? Math.max(0, Math.floor(Number(liveData.clock.minute)))
      : (parseInt(String(liveData.minute ?? '0'), 10) || 0)
    const homeScore = liveData.homeScore ?? 0
    const awayScore = liveData.awayScore ?? 0

    const blocks = calcPpm(points)
    const signal = calcEntrySignal(blocks, minute, homeScore, awayScore, points)

    return NextResponse.json({ blocks, signal, currentMinute: minute })
  } catch {
    return NextResponse.json({ blocks: [], signal: null, currentMinute: 0 })
  }
}

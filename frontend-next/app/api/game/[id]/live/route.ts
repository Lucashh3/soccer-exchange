import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const res = await fetch(`${EXPRESS}/games/${id}/live`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({
      status: 'unavailable',
      minute: 'LIVE',
      clock: { minute: 0, display: 'LIVE', phase: 'unknown', period: null, source: 'fallback' },
      homeScore: 0,
      awayScore: 0,
      events: [],
    })
  }
}

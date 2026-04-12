import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const [gameRes, analysisRes, newsRes] = await Promise.all([
      fetch(`${EXPRESS}/games/${id}`, { cache: 'no-store', headers: backendHeaders() }),
      fetch(`${EXPRESS}/signals/analysis/${id}`, { cache: 'no-store', headers: backendHeaders() }),
      fetch(`${EXPRESS}/games/${id}/news`, { cache: 'no-store', headers: backendHeaders() }),
    ])

    if (gameRes.status === 404) {
      return NextResponse.json({ error: 'not found' }, { status: 404 })
    }

    const game = await gameRes.json().catch(() => null)
    const analysis = await analysisRes.json().catch(() => null)
    const news = await newsRes.json().catch(() => [])

    return NextResponse.json({ ...analysis, game, news })
  } catch {
    return NextResponse.json({ error: 'upstream unavailable' }, { status: 502 })
  }
}
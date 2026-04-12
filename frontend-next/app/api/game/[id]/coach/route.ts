import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const enabled = req.nextUrl.searchParams.get('enabled') === 'true'

  try {
    const res = await fetch(`${EXPRESS}/games/${id}/coach?enabled=${enabled ? 'true' : 'false'}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({
      status: enabled ? 'inactive' : 'disabled',
      text: '',
      action: 'aguardar',
      market: null,
      side: 'neutral',
      confidence: 0,
      reasonCodes: ['proxy_unavailable'],
      cachedAt: 0,
      fromCache: false,
      contextUsed: { live: false, ppm: false, news: false },
      exposure: null,
    })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  try {
    const res = await fetch(`${EXPRESS}/games/${id}/live-stats`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000)
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ stats: [] })
  }
}
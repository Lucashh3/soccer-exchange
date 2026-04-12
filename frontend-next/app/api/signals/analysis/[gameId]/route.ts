import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(_req: NextRequest, { params }: { params: { gameId: string } }) {
  const { gameId } = params
  try {
    const res = await fetch(`${EXPRESS}/signals/analysis/${gameId}`, { cache: 'no-store', headers: backendHeaders() })
    if (!res.ok) return NextResponse.json({ error: 'not found' }, { status: res.status })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'upstream unavailable' }, { status: 502 })
  }
}

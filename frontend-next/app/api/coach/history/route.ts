import { NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const months = searchParams.get('months') ?? '3'
    const res = await fetch(`${EXPRESS}/games/coach/history?months=${months}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: backendHeaders(),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json([])
  }
}

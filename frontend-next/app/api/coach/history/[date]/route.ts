import { NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(_req: Request, { params }: { params: { date: string } }) {
  try {
    const res = await fetch(`${EXPRESS}/games/coach/history/${params.date}`, {
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

import { NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET() {
  try {
    const res = await fetch(`${EXPRESS}/games/coach/suggestions`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
      headers: backendHeaders(),
    })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ suggestions: [], generatedAt: 0, fromCache: false })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.toString()
  const url = `${EXPRESS}/games/today${search ? `?${search}` : ''}`
  try {
    const res = await fetch(url, { cache: 'no-store', headers: backendHeaders() })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'upstream unavailable' }, { status: 502 })
  }
}

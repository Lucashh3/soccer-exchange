import { NextResponse } from 'next/server'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET() {
  try {
    const res = await fetch(`${EXPRESS}/health`, { cache: 'no-store', headers: backendHeaders() })
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ status: 'offline' }, { status: 502 })
  }
}

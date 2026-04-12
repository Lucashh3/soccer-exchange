import { NextRequest, NextResponse } from 'next/server'
import { backendHeaders } from '@/lib/backend'

const EXPRESS = process.env.API_URL ?? 'http://localhost:3001'

export async function GET(_req: NextRequest, { params }: { params: { teamId: string } }) {
  const { teamId } = params
  try {
    const res = await fetch(`${EXPRESS}/games/team-image/${teamId}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return new NextResponse(null, { status: 404 })
    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/png'
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}

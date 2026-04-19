import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const API_URL = process.env.API_URL ?? 'http://localhost:3001'

export async function GET() {
  const cookieStore = await cookies()
  const token = cookieStore.get('sx_token')?.value

  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const upstream = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  const data = await upstream.json()
  return NextResponse.json(data, { status: upstream.status })
}

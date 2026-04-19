'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from './AppShell'

const AUTH_PATHS = ['/login', '/register']

export function ConditionalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_PATHS.some(p => pathname === p)

  if (isAuth) return <>{children}</>
  return <AppShell>{children}</AppShell>
}

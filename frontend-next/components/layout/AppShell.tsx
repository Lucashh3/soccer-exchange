'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PipelineStatus } from './PipelineStatus'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/',         label: 'Dashboard' },
  { href: '/screener', label: 'Screener'  },
]

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname() ?? ''
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'text-sm font-medium transition-colors px-1 pb-0.5',
        active
          ? 'text-primary border-b-2 border-primary'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {label}
    </Link>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="h-screen flex flex-col">
      {/* Topbar */}
      <header className="h-12 shrink-0 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur-sm">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <span className="text-base">⚽</span>
          <span className="font-semibold text-sm tracking-tight">Soccer Exchange</span>
        </div>

        {/* Center: Nav links — desktop only */}
        <nav className="hidden md:flex items-center gap-6 absolute left-1/2 -translate-x-1/2">
          {NAV.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* Right: Pipeline status + hamburger on mobile */}
        <div className="flex items-center gap-3">
          <PipelineStatus />
          <button
            className="md:hidden text-muted-foreground hover:text-foreground transition-colors text-lg leading-none"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="px-4 py-5 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <span>⚽</span>
              <span>Soccer Exchange</span>
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 p-3">
            {NAV.map(item => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

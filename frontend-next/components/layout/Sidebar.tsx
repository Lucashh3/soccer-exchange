'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/',          label: 'Dashboard', icon: '◈' },
  { href: '/screener',  label: 'Screener',  icon: '⊞' },
]

function NavItem({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname() ?? ''
  const active = pathname === href || (href !== '/' && pathname.startsWith(href))

  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
      )}
    >
      <span className="text-base w-5 text-center">{icon}</span>
      <span>{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
      )}
    </Link>
  )
}

export function Sidebar() {
  return (
    <aside className="w-[220px] shrink-0 border-r border-border flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚽</span>
          <span className="font-semibold text-sm tracking-tight">Exchange</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">
        {NAV.map(item => (
          <NavItem key={item.href} {...item} />
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <p className="text-xs text-muted-foreground font-mono">v1.0 · {new Date().getFullYear()}</p>
      </div>
    </aside>
  )
}

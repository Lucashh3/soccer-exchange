'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { PipelineStatus } from './PipelineStatus'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { getMe, logout, type AuthUser } from '@/lib/auth'

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
        'relative text-sm font-medium transition-colors duration-200 px-1 py-1',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
      )}
    >
      {label}
      {active && (
        <motion.div
          layoutId="nav-underline"
          className="absolute -bottom-[1px] left-0 right-0 h-[2px] rounded-full bg-primary"
          style={{ boxShadow: '0 0 8px rgba(56,189,248,0.6)' }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
    </Link>
  )
}

function UserMenu({ user }: { user: AuthUser }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    await logout()
    router.push('/login')
    router.refresh()
  }

  const initials = user.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors"
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 100%)' }}
        >
          {initials}
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block max-w-[100px] truncate">
          {user.name.split(' ')[0]}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-48 rounded-xl border border-white/[0.08] bg-background/95 backdrop-blur-md shadow-xl py-1">
            <div className="px-3 py-2 border-b border-white/[0.06]">
              <p className="text-xs font-medium truncate">{user.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-white/[0.04] transition-colors"
            >
              Sair
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    getMe().then(setUser)
  }, [])

  return (
    <div className="h-screen flex flex-col">
      {/* Topbar */}
      <header className="h-12 shrink-0 flex items-center justify-between px-5 glass-topbar sticky top-0 z-40">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 100%)', boxShadow: '0 0 12px rgba(56,189,248,0.3)' }}>
            ⚡
          </div>
          <span className="font-semibold text-sm tracking-tight text-foreground/90">Soccer Exchange</span>
        </div>

        {/* Center: Nav links — desktop */}
        <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2 h-full">
          {NAV.map(item => (
            <NavLink key={item.href} href={item.href} label={item.label} />
          ))}
        </nav>

        {/* Right */}
        <div className="flex items-center gap-3">
          <PipelineStatus />
          {user && <UserMenu user={user} />}
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
        <SheetContent side="left" className="w-64 p-0 glass-panel border-r border-white/[0.08]">
          <SheetHeader className="px-4 py-5 border-b border-white/[0.06]">
            <SheetTitle className="flex items-center gap-2.5 text-sm font-semibold">
              <div className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #8b5cf6 100%)' }}>
                ⚡
              </div>
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
          {user && (
            <div className="border-t border-white/[0.06] p-3 mt-auto">
              <p className="text-xs text-muted-foreground px-2 truncate">{user.email}</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}

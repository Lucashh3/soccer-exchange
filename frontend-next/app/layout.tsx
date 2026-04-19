import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { ConditionalShell } from '@/components/layout/ConditionalShell'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
})

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Soccer Exchange',
  description: 'Trading dashboard — sinais de exchange de futebol',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${jetbrainsMono.variable} dark h-full`}>
      <body className="min-h-full bg-background text-foreground antialiased">
        {/* Aurora background — fixed, behind everything */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
          <div className="absolute -top-[25%] -left-[15%] w-[55vw] h-[55vw] rounded-full bg-blue-950/60 blur-[130px]" />
          <div className="absolute top-[35%] -right-[15%] w-[45vw] h-[45vw] rounded-full blur-[130px]" style={{ background: 'rgba(139,92,246,0.07)' }} />
          <div className="absolute bottom-0 left-[30%] w-[30vw] h-[30vw] rounded-full blur-[100px]" style={{ background: 'rgba(56,189,248,0.04)' }} />
        </div>
        <Providers>
          <ConditionalShell>{children}</ConditionalShell>
        </Providers>
      </body>
    </html>
  )
}

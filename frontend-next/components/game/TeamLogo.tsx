'use client'

import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  teamId?: number | null
  teamName: string
  size?: number
  className?: string
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('')
}

export function TeamLogo({ teamId, teamName, size = 24, className }: Props) {
  const [failed, setFailed] = useState(false)

  if (!teamId || failed) {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-full bg-white/8 text-muted-foreground font-bold font-mono shrink-0', className)}
        style={{ width: size, height: size, fontSize: size * 0.38 }}
      >
        {initials(teamName)}
      </span>
    )
  }

  return (
    <Image
      src={`/api/team-image/${teamId}`}
      alt={teamName}
      width={size}
      height={size}
      className={cn('rounded-full object-contain shrink-0', className)}
      onError={() => setFailed(true)}
      unoptimized
    />
  )
}

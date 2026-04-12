'use client'

import Image from 'next/image'
import { useState } from 'react'

interface Props {
  teamId: number | null | undefined
  teamName: string
  size?: number
  className?: string
}

export function TeamLogo({ teamId, teamName, size = 24, className }: Props) {
  const [error, setError] = useState(false)

  if (!teamId || error) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-muted-foreground shrink-0 ${className ?? ''}`}
        style={{ width: size, height: size }}
      >
        {teamName.slice(0, 2).toUpperCase()}
      </span>
    )
  }

  return (
    <Image
      src={`/api/team-image/${teamId}`}
      alt={teamName}
      width={size}
      height={size}
      className={`object-contain shrink-0 ${className ?? ''}`}
      onError={() => setError(true)}
      unoptimized
    />
  )
}

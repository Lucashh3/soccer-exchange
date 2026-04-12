'use client'

import { useCallback, useEffect, useState } from 'react'

function keyFor(gameId: string): string {
  return `coach_enabled_${gameId}`
}

function load(gameId: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(keyFor(gameId)) === '1'
  } catch {
    return false
  }
}

function save(gameId: string, enabled: boolean): void {
  localStorage.setItem(keyFor(gameId), enabled ? '1' : '0')
}

export function useCoachToggle(gameId: string) {
  const [enabled, setEnabled] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setEnabled(load(gameId))
    setReady(true)
  }, [gameId])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      save(gameId, next)
      return next
    })
  }, [gameId])

  return { enabled, toggle, ready }
}

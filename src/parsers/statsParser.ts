export function parseNumber(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) return v
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '')
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) return parsed
  }
  return 0
}

export function parsePct(v: unknown): number {
  if (typeof v === 'number' && !isNaN(v)) {
    // If it's already a decimal (0-1), return as-is; if percentage (0-100), divide
    return v > 1 ? v / 100 : v
  }
  if (typeof v === 'string') {
    const cleaned = v.replace('%', '').trim()
    const parsed = parseFloat(cleaned)
    if (!isNaN(parsed)) {
      return parsed > 1 ? parsed / 100 : parsed
    }
  }
  return 0
}

export function parseForm(v: unknown): string {
  if (typeof v === 'string') {
    return v
      .toUpperCase()
      .split('')
      .filter((c) => ['W', 'D', 'L'].includes(c))
      .join('')
  }
  return ''
}

import type { TeamStats } from '../types/index'
import { parseNumber, parsePct, parseForm } from './statsParser'

function sanitizeStats(stats: TeamStats): TeamStats {
  const cleaned: TeamStats = { ...stats }

  const shots = cleaned.shotsAvg
  const shotsOnTarget = cleaned.shotsOnTargetAvg
  if (
    shots !== undefined &&
    shotsOnTarget !== undefined &&
    (shots < shotsOnTarget || shots <= 0)
  ) {
    cleaned.shotsAvg = undefined
  }

  if (cleaned.possessionAvg !== undefined) {
    if (cleaned.possessionAvg < 0 || cleaned.possessionAvg > 100) {
      cleaned.possessionAvg = undefined
    }
  }

  if (cleaned.xgAvg !== undefined && cleaned.xgAvg < 0) cleaned.xgAvg = undefined
  if (cleaned.xgConcededAvg !== undefined && cleaned.xgConcededAvg < 0) cleaned.xgConcededAvg = undefined
  if (cleaned.goalsScoredAvg !== undefined && cleaned.goalsScoredAvg < 0) cleaned.goalsScoredAvg = undefined
  if (cleaned.goalsConcededAvg !== undefined && cleaned.goalsConcededAvg < 0) cleaned.goalsConcededAvg = undefined

  return cleaned
}

export function buildTeamStatsFromSofascore(raw: Record<string, unknown>): TeamStats {
  return sanitizeStats({
    xgAvg: raw.xgAvg !== undefined ? parseNumber(raw.xgAvg) : undefined,
    xgConcededAvg: raw.xgConcededAvg !== undefined ? parseNumber(raw.xgConcededAvg) : undefined,
    goalsScoredAvg: raw.goalsScoredAvg !== undefined ? parseNumber(raw.goalsScoredAvg) : undefined,
    goalsConcededAvg: raw.goalsConcededAvg !== undefined ? parseNumber(raw.goalsConcededAvg) : undefined,
    over25Pct: raw.over25Pct !== undefined ? parsePct(raw.over25Pct) : undefined,
    under25Pct: raw.under25Pct !== undefined ? parsePct(raw.under25Pct) : undefined,
    formLast5: raw.formLast5 !== undefined ? parseForm(raw.formLast5) : undefined,
    formLast10: raw.formLast10 !== undefined ? parseForm(raw.formLast10) : undefined,
    cornersAvg: raw.cornersAvg !== undefined ? parseNumber(raw.cornersAvg) : undefined,
    cardsAvg: raw.cardsAvg !== undefined ? parseNumber(raw.cardsAvg) : undefined,
    possessionAvg: raw.possessionAvg !== undefined ? parsePct(raw.possessionAvg) : undefined,
    shotsAvg: raw.shotsAvg !== undefined ? parseNumber(raw.shotsAvg) : undefined,
    shotsOnTargetAvg: raw.shotsOnTargetAvg !== undefined ? parseNumber(raw.shotsOnTargetAvg) : undefined,
    goalsScoredStd: raw.goalsScoredStd !== undefined ? parseNumber(raw.goalsScoredStd) : undefined,
    goalsConcededStd: raw.goalsConcededStd !== undefined ? parseNumber(raw.goalsConcededStd) : undefined,
    xgStd: raw.xgStd !== undefined ? parseNumber(raw.xgStd) : undefined,
    bigChancesCreatedAvg: raw.bigChancesCreatedAvg !== undefined ? parseNumber(raw.bigChancesCreatedAvg) : undefined,
    bigChancesConcededAvg: raw.bigChancesConcededAvg !== undefined ? parseNumber(raw.bigChancesConcededAvg) : undefined,
  })
}

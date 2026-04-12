/**
 * Poisson distribution utilities for match probability calculations
 */

/**
 * Compute P(X = k) for a Poisson distribution with parameter lambda
 */
export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0
  // Use log to avoid overflow: P(k) = e^(-lambda) * lambda^k / k!
  let logProb = -lambda + k * Math.log(lambda)
  for (let i = 1; i <= k; i++) {
    logProb -= Math.log(i)
  }
  return Math.exp(logProb)
}

/**
 * Build a score probability matrix of size x size
 * scoreMatrix[i][j] = P(home scores i goals) * P(away scores j goals)
 */
export function buildScoreMatrix(
  homeGoals: number,
  awayGoals: number,
  size: number = 5
): number[][] {
  const matrix: number[][] = []
  for (let i = 0; i < size; i++) {
    matrix[i] = []
    for (let j = 0; j < size; j++) {
      matrix[i][j] = poissonPmf(homeGoals, i) * poissonPmf(awayGoals, j)
    }
  }
  return matrix
}

/**
 * Compute outcome probabilities from a score matrix
 */
export function computeProbabilities(matrix: number[][]): {
  homeWin: number
  draw: number
  awayWin: number
  btts: number
  over25: number
  under25: number
} {
  let homeWin = 0
  let draw = 0
  let awayWin = 0
  let btts = 0
  let over25 = 0
  let under25 = 0

  const size = matrix.length
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const p = matrix[i][j]
      const totalGoals = i + j

      if (i > j) homeWin += p
      else if (i === j) draw += p
      else awayWin += p

      if (i > 0 && j > 0) btts += p
      if (totalGoals > 2.5) over25 += p
      if (totalGoals <= 2.5) under25 += p
    }
  }

  return { homeWin, draw, awayWin, btts, over25, under25 }
}

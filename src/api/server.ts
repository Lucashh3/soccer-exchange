import express, { Request, Response, NextFunction } from 'express'
import { initDb, getDb } from '../db/schema'
import gamesRouter from './routes/games'
import signalsRouter from './routes/signals'
import authRouter from './routes/auth'
import { errorHandler } from './middleware/errorHandler'

export const app = express()

// CORS — restrito ao domínio configurado em ALLOWED_ORIGIN (padrão: Next.js local)
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'http://localhost:3000'

app.use(express.json())
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key')
  if (_req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
})

// Autenticação por API key — ativa somente se API_KEY estiver definida no env
function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY
  if (!apiKey) { next(); return }

  const provided = req.headers['x-api-key'] ?? req.headers['authorization']?.replace('Bearer ', '')
  if (provided !== apiKey) {
    res.status(401).json({ error: 'unauthorized' })
    return
  }
  next()
}

// Health endpoint (público — sem auth)
app.get('/health', (_req, res) => {
  try {
    const db = getDb()

    const gamesCount = (db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number }).count
    const signalsCount = (db.prepare('SELECT COUNT(*) as count FROM signals').get() as { count: number }).count
    const lastScrapeRow = db.prepare(
      'SELECT created_at FROM games ORDER BY created_at DESC LIMIT 1'
    ).get() as { created_at: string } | undefined

    res.json({
      status: 'ok',
      db: 'connected',
      lastScrape: lastScrapeRow?.created_at ?? null,
      gamesLoaded: gamesCount,
      signalsGenerated: signalsCount,
    })
  } catch (_err) {
    res.status(500).json({
      status: 'error',
      db: 'disconnected',
      lastScrape: null,
      gamesLoaded: 0,
      signalsGenerated: 0,
    })
  }
})

// Auth routes — públicas (sem API key)
app.use('/auth', authRouter)

// Routes (protegidas por API key quando API_KEY estiver configurada)
app.use('/games', authMiddleware, gamesRouter)
app.use('/signals', authMiddleware, signalsRouter)

// Error handler (must be last)
app.use(errorHandler)

const PORT = parseInt(process.env.PORT ?? '3001', 10)

export function startServer(): void {
  initDb()
  app.listen(PORT, () => {
    console.log(`[server] Soccer Exchange API running on port ${PORT}`)
  })
}

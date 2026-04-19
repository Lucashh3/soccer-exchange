import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { findUserByEmail, findUserById, createUser, toPublicUser } from '../../db/queries/users'

const router = Router()

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env var not set')
  return secret
}

function signToken(userId: number): string {
  return jwt.sign({ sub: userId }, getSecret(), { expiresIn: '7d' })
}

/* POST /auth/register */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password } = req.body ?? {}

  if (!name || !email || !password) {
    res.status(400).json({ error: 'name, email e password são obrigatórios' })
    return
  }

  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' })
    return
  }

  const existing = findUserByEmail(email)
  if (existing) {
    res.status(409).json({ error: 'Email já cadastrado' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const user = createUser(String(name).trim(), String(email).trim().toLowerCase(), passwordHash)
  const token = signToken(user.id)

  res.status(201).json({ token, user: toPublicUser(user) })
})

/* POST /auth/login */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body ?? {}

  if (!email || !password) {
    res.status(400).json({ error: 'email e password são obrigatórios' })
    return
  }

  const user = findUserByEmail(String(email).trim().toLowerCase())
  if (!user) {
    res.status(401).json({ error: 'Credenciais inválidas' })
    return
  }

  const valid = await bcrypt.compare(String(password), user.password_hash)
  if (!valid) {
    res.status(401).json({ error: 'Credenciais inválidas' })
    return
  }

  const token = signToken(user.id)
  res.json({ token, user: toPublicUser(user) })
})

/* GET /auth/me — requer Authorization: Bearer <token> */
router.get('/me', (req: Request, res: Response): void => {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' })
    return
  }

  try {
    const payload = jwt.verify(token, getSecret()) as unknown as { sub: number }
    const user = findUserById(Number(payload.sub))
    if (!user) {
      res.status(401).json({ error: 'Usuário não encontrado' })
      return
    }
    res.json({ user: toPublicUser(user) })
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' })
  }
})

export default router

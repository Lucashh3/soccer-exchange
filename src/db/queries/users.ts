import { getDb } from '../schema'

export interface DbUser {
  id: number
  name: string
  email: string
  password_hash: string
  role: 'user' | 'admin'
  created_at: string
}

export interface PublicUser {
  id: number
  name: string
  email: string
  role: 'user' | 'admin'
}

export function findUserByEmail(email: string): DbUser | undefined {
  return getDb().prepare('SELECT * FROM users WHERE email = ?').get(email) as DbUser | undefined
}

export function findUserById(id: number): DbUser | undefined {
  return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id) as DbUser | undefined
}

export function createUser(name: string, email: string, passwordHash: string): DbUser {
  const db = getDb()
  const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)').run(name, email, passwordHash)
  return db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid) as DbUser
}

export function toPublicUser(user: DbUser): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role }
}

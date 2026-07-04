import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { db } from '../services/db.service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// Проверка токена
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string }
    
    // Находим пользователя в базе
    const user = await db.employee.findUnique({ where: { id: decoded.userId } })
    if (!user) return res.status(401).json({ error: 'Invalid token' })

    // Добавляем пользователя в запрос
    ;(req as any).user = user
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' })
  }
}
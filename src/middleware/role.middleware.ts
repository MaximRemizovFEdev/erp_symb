import { Request, Response, NextFunction } from 'express'

// RBAC Authentication Middleware
// Проверяет роль пользователя в JWT

export const role = (requiredRoles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  // Проверка существования user в запросе
  if (!req.user) {
    return res.status(403).json({ error: 'Forbidden: No user authenticated' })
  }

  // Проверка роли
  const hasPermission = requiredRoles.some(role => req.user.role === role)
  if (!hasPermission) {
    return res.status(403).json({ error: `Forbidden: Role ${req.user.role} not allowed` })
  }

  next()
}

// Использование в маршрутах
// app.use('/api/orders', role(['manager', 'admin']), OrderRoutes)

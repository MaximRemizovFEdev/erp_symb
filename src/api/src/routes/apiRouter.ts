import { Router, Request, Response } from 'express'
import { jwtMiddleware } from '../middleware/auth.middleware'
import { roleMiddleware } from '../middleware/role.middleware'
import { apiRouter as ordersApi } from './routes/orders'
import { apiRouter as orderItemsApi } from './routes/order_items'
import { apiRouter as customersApi } from './routes/customers'
import { apiRouter as companiesApi } from './routes/companies'
import { apiRouter as employeesApi } from './routes/employees'
import { apiRouter as contractorsApi } from './routes/contractors'
import { apiRouter as paymentsApi } from './routes/payments'

export const apiRouter = Router()

// Применяем аутентификацию к всем API-маршрутам
apiRouter.use(jwtMiddleware)

// Применяем RBAC к API
apiRouter.use('/api', roleMiddleware(['Admin', 'Manager', 'Office', 'Production']))

// Подключаем все роутеры
apiRouter.use('/orders', ordersApi)
apiRouter.use('/order-items', orderItemsApi)
apiRouter.use('/customers', customersApi)
apiRouter.use('/companies', companiesApi)
apiRouter.use('/employees', employeesApi)
apiRouter.use('/contractors', contractorsApi)
apiRouter.use('/payments', paymentsApi)

// Пример специфичных эндпоинтов для Production и Office
apiRouter.get('/production/silkography', (req, res) => {
  res.json({ message: 'Production Silkography View' })
})

apiRouter.patch('/production/items/:id/status', (req, res) => {
  res.json({ message: 'Production Item Status Updated' })
})

apiRouter.get('/office/issues', (req, res) => {
  res.json({ message: 'Office Issues View' })
})

apiRouter.patch('/office/issues/:id/status', (req, res) => {
  res.json({ message: 'Office Issue Status Updated' })
})

export { apiRouter }
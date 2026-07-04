import { Router } from 'express'
import { OrdersController } from '../controllers/orders.controller'

export const ordersRouter = Router()

ordersRouter.get('/orders', OrdersController.getAll)
ordersRouter.get('/orders/:id', OrdersController.getById)
ordersRouter.post('/orders', OrdersController.create)
ordersRouter.put('/orders/:id', OrdersController.update)
ordersRouter.delete('/orders/:id', OrdersController.delete)
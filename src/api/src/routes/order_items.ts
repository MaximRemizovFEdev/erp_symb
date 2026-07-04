import { Router } from 'express'
import { OrderItemsController } from '../controllers/order_items.controller'

export const orderItemsRouter = Router()

orderItemsRouter.get('/order-items/:orderId', OrderItemsController.getByOrder)
orderItemsRouter.post('/order-items', OrderItemsController.create)
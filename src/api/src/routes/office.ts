import { Router } from 'express'
import { OfficeController } from '../controllers/office.controller'

export const officeRouter = Router()

officeRouter.get('/issues', OfficeController.getIssues)
officeRouter.patch('/issues/:id/status', OfficeController.updateOfficeStatus)
officeRouter.post('/issues/:id/payments', OfficeController.addPayment)
officeRouter.put('/issues/:id', OfficeController.updateOrderStatus)
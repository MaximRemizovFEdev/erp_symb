import { Router } from 'express'
import { PaymentsController } from '../controllers/payments.controller'


export const paymentsRouter = Router()

// GET /api/payments
paymentsRouter.get('/payments', PaymentsController.getAll)

// GET /api/payments/:id
paymentsRouter.get('/payments/:id', PaymentsController.getById)

// POST /api/payments
paymentsRouter.post('/payments', PaymentsController.create)

// PUT /api/payments/:id
paymentsRouter.put('/payments/:id', PaymentsController.update)

// DELETE /api/payments/:id
paymentsRouter.delete('/payments/:id', PaymentsController.deleteAllocation)
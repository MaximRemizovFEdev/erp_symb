import { Router } from 'express'
import { CustomersController } from '../controllers/customers.controller'




export const customersRouter = Router()

// GET /api/customers
customersRouter.get('/customers', CustomersController.getAll)

// GET /api/customers/:id
customersRouter.get('/customers/:id', CustomersController.getById)

// POST /api/customers
customersRouter.post('/customers', CustomersController.create)

// PUT /api/customers/:id
customersRouter.put('/customers/:id', CustomersController.update)

// DELETE /api/customers/:id
customersRouter.delete('/customers/:id', CustomersController.delete)
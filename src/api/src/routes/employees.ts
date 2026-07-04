import { Router } from 'express'
import { EmployeesController } from '../controllers/employees.controller'

export const employeesRouter = Router()

employeesRouter.get('/employees', EmployeesController.getAll)
employeesRouter.get('/employees/:id', EmployeesController.getById)
employeesRouter.post('/employees', EmployeesController.create)
employeesRouter.put('/employees/:id', EmployeesController.update)
employeesRouter.delete('/employees/:id', EmployeesController.deleteEmployee)
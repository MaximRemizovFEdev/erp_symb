import { Router } from 'express'
import { ContractorsController } from '../controllers/contractors.controller'

export const contractorsRouter = Router()

contractorsRouter.get('/contractors', ContractorsController.getAll)
contractorsRouter.get('/contractors/:id', ContractorsController.getById)
contractorsRouter.post('/contractors', ContractorsController.create)
contractorsRouter.put('/contractors/:id', ContractorsController.update)
contractorsRouter.delete('/contractors/:id', ContractorsController.deleteContractor)
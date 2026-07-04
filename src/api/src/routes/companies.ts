import { Router } from 'express'
import { CompaniesController } from '../controllers/companies.controller'

export const companiesRouter = Router()

companiesRouter.get('/companies', CompaniesController.getAll)
companiesRouter.get('/companies/:id', CompaniesController.getById)
companiesRouter.post('/companies', CompaniesController.create)
companiesRouter.put('/companies/:id', CompaniesController.update)
companiesRouter.delete('/companies/:id', CompaniesController.deleteCompany)
import { Router } from 'express'
import { ProductionController } from '../controllers/production.controller'

export const productionRouter = Router()

productionRouter.get('/silkography', ProductionController.getSilkography)
productionRouter.get('/own-production', ProductionController.getOwnProductionItems)
productionRouter.patch('/items/:id/status', ProductionController.updateProductionStatus)
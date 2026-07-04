import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get production silkography items
// Shows positions where contractor_1=specific contractor or contractor_2=specific contractor
export const getSilkography = async (req: Request, res: Response) => {
  try {
    // Based on PLAN1.md: contractor_5 corresponds to Silkography
    const items = await db.orderItem.findMany({
      where: {
        OR: [
          { contractor1: 5 },
          { contractor2: 5 }
        ]
      },
      include: {
        order: true,
        contractor1: true,
        contractor2: true,
        productionStatus: true
      }
    })
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Get production own items
// Shows positions where contractor_1=specific contractor or contractor_2=specific contractor
export const getOwnProductionItems = async (req: Request, res: Response) => {
  try {
    // Based on PLAN1.md: contractor_1 corresponds to Собственное производство
    const items = await db.orderItem.findMany({
      where: {
        OR: [
          { contractor1: 1 },
          { contractor2: 1 }
        ]
      },
      include: {
        order: true,
        contractor1: true,
        contractor2: true,
        productionStatus: true
      }
    })
    res.json(items)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update production status
export const updateProductionStatus = async (req: Request, res: Response) => {
  try {
    const { status, comment } = req.body
    const { id } = req.params

    const item = await db.orderItem.update({
      where: { id },
      data: { productionStatus: status, productionComment: comment }
    })
    res.json(item)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
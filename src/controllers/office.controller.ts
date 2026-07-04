import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get office issues
// Orders that are ready for office (office_status = in_office)
export const getIssues = async (req: Request, res: Response) => {
  try {
    const orders = await db.order.findMany({
      where: {
        officeStatus: {
          // Assuming we need to find by name 'In office' or similar
          // For now, we'll use name directly as string, but proper implementation would join
          // We need to get OfficeStatus by name 'in_office'
          name: 'in_office' 
        }
      },
      include: {
        customer: true,
        company: true,
        manager: true,
        items: {
          include: {
            contractor1: true,
            contractor2: true,
            productionStatus: true,
            officeStatus: true
          }
        },
        payments: true
      }
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update office status
export const updateOfficeStatus = async (req: Request, res: Response) => {
  try {
    const { status, comment } = req.body
    const { id } = req.params

    const order = await db.order.update({
      where: { id },
      data: { officeStatus: status }
    })
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Add payment to order (in office)
export const addPayment = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, paymentType, comment } = req.body
    // Implementation details would go here
    res.json({ message: 'Payment added' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Change order status
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body
    const { id } = req.params

    const order = await db.order.update({
      where: { id },
      data: { status }
    })
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
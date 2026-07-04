import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get all orders
export const getAll = async (req: Request, res: Response) => {
  const orders = await db.order.findMany()
  res.json(orders)
}

// Get order by ID
export const getById = async (req: Request, res: Response) => {
  const order = await db.order.findUnique({ where: { id: req.params.id }})
  if (!order) return res.status(404).json({ error: 'Order not found' })
  res.json(order)
}

// Generate order number SO-XXXX
const generateOrderNumber = async (): Promise<string> => {
  try {
    const lastOrder = await db.order.orderBy({ orderNumber: 'desc' }).first()
    let num = 1

    if (lastOrder?.orderNumber) {
      const match = lastOrder.orderNumber.match(/SO-(\d+)/)
      if (match) {
        num = parseInt(match[1]) + 1
      }
    }

    return `SO-${String(num).padStart(4, '0')}`
  } catch (error) {
    return `SO-0001`
  }
}

// Create new order with automatic number and manager assignment
export const create = async (req: Request, res: Response) => {
  try {
    // Generate order number if not provided
    if (!req.body.orderNumber) {
      req.body.orderNumber = await generateOrderNumber()
    }

    // Set manager from request user if not provided
    if (req.body.managerId && !req.body.managerId) {
      // Extract managerId from authenticated user
      req.body.managerId = (req as any).user?.id
    }

    const newOrder = await db.order.create({
      data: req.body,
      include: { orderItems: true }
    })

    // Recalculate financial data
    await recalculateOrderFinancials(newOrder.id)

    res.status(201).json(newOrder)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

async function recalculateOrderFinancials(orderId: string): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { items: true, manager: true, payments: true }
  })

  if (!order) return

  const items = order.items
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)
  const totalOrderSum = items.reduce((sum, item) => sum + item.orderSum, 0)
  const totalCost = items.reduce((sum, item) => sum + item.totalCost, 0)

  // Calculate metrics based on PLAN2 formulas
  const commissionPercent = order.manager ? order.manager.commissionPercent : 0
  const managerCommissionSum = totalOrderSum * commissionPercent / 100
  const taxPercent = 0.2 // Example tax rate
  const taxSum = totalOrderSum * taxPercent
  const profitSum = totalOrderSum - totalCost - managerCommissionSum - taxSum
  const marginPercent = profitSum / totalOrderSum * 100 || 0

  // Update order record
  await db.order.update({
    where: { id: orderId },
    data: {
      orderSum: totalOrderSum,
      itemsTotalCost: totalCost,
      itemsManagerCommissionSum: managerCommissionSum,
      itemsTaxSum: taxSum,
      profitSum: profitSum,
      marginPercent: marginPercent,
    }
  })
}

// Update order with financial recalculation
export const update = async (req: Request, res: Response) => {
  try {
    const updatedOrder = await db.order.update({
      where: { id: req.params.id },
      data: req.body
    })

    // Recalculate financial data on any update
    await recalculateOrderFinancials(updatedOrder.id)

    res.json(updatedOrder)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Delete order
export const deleteOrder = async (req: Request, res: Response) => {
  try {
    await db.order.delete({ where: { id: req.params.id }})
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
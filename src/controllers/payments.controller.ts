import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get all orders with their payments (joined)

export const getAll = async (req: Request, res: Response) => {
  try {
    const orders = await db.order.findMany({
      include: {
        payments: {
          include: {
            payment: true,
            allocations: true
          }
        },
        items: {
          include: {
            contractor1: true,
            contractor2: true,
            orderItemAllocs: {
              include: { allocation: true }
            }
          }
        }
      }
    })
    res.json(orders)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Get order by ID with payments and allocations

export const getById = async (req: Request, res: Response) => {
  try {
    const order = await db.order.findUnique({
      where: { id: req.params.id },
      include: {
        payments: {
          include: {
            payment: true,
            allocations: true
          }
        },
        items: {
          include: {
            contractor1: true,
            contractor2: true,
            orderItemAllocs: {
              include: { allocation: true }
            }
          }
        }
      }
    })
    if (!order) return res.status(404).json({ error: 'Order not found' })
    res.json(order)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Create new payment
export const create = async (req: Request, res: Response) => {
  try {
    const payment = await db.paymentAllocation.create({
      data: req.body
    })
    res.status(201).json(payment)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update payment

export const update = async (req: Request, res: Response) => {
  try {
    const payment = await db.paymentAllocation.update({
      where: { id: req.params.id },
      data: req.body
    })
    res.json(payment)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Delete payment

export const deleteAllocation = async (req: Request, res: Response) => {
  try {
    await db.paymentAllocation.delete({ where: { id: req.params.id }})
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
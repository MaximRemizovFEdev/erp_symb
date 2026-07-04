import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get all payment allocations

export const getAll = async (req: Request, res: Response) => {
  try {
    const allocations = await db.paymentAllocation.findMany()
    res.json(allocations)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Get allocation by ID

export const getById = async (req: Request, res: Response) => {
  try {
    const allocation = await db.paymentAllocation.findUnique({
      where: { id: req.params.id }
    })
    if (!allocation) return res.status(404).json({ error: 'Allocation not found' })
    res.json(allocation)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Create new allocation

export const create = async (req: Request, res: Response) => {
  try {
    const allocation = await db.paymentAllocation.create({
      data: req.body
    })
    res.status(201).json(allocation)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update allocation

export const update = async (req: Request, res: Response) => {
  try {
    const allocation = await db.paymentAllocation.update({
      where: { id: req.params.id },
      data: req.body
    })
    res.json(allocation)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Delete allocation

export const deleteAllocation = async (req: Request, res: Response) => {
  try {
    await db.paymentAllocation.delete({ where: { id: req.params.id }})
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
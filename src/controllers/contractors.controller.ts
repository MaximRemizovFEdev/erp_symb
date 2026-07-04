import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get all contractors
export const getAll = async (req: Request, res: Response) => {
  try {
    const contractors = await db.contractor.findMany()
    res.json(contractors)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Get contractor by ID
export const getById = async (req: Request, res: Response) => {
  try {
    const contractor = await db.contractor.findUnique({
      where: { id: req.params.id }
    })
    if (!contractor) return res.status(404).json({ error: 'Contractor not found' })
    res.json(contractor)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Create new contractor
export const create = async (req: Request, res: Response) => {
  try {
    const contractor = await db.contractor.create({
      data: req.body
    })
    res.status(201).json(contractor)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update contractor
export const update = async (req: Request, res: Response) => {
  try {
    const contractor = await db.contractor.update({
      where: { id: req.params.id },
      data: req.body
    })
    res.json(contractor)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Delete contractor
export const deleteContractor = async (req: Request, res: Response) => {
  try {
    await db.contractor.delete({ where: { id: req.params.id }})
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
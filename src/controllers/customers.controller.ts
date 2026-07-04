import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get all customers
export const getAll = async (req: Request, res: Response) => {
  try {
    const customers = await db.customer.findMany({
      include: { manager: true, companies: { include: { company: true } } }
    })
    res.json(customers)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Get customer by ID
export const getById = async (req: Request, res: Response) => {
  try {
    const customer = await db.customer.findUnique({
      where: { id: req.params.id },
      include: { manager: true, companies: { include: { company: true } } }
    })
    if (!customer) return res.status(404).json({ error: 'Customer not found' })
    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Create new customer
export const create = async (req: Request, res: Response) => {
  try {
    const { companies: _companies, ...customerData } = req.body
    const customer = await db.customer.create({
      data: customerData,
      include: { manager: true }
    })
    res.status(201).json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update customer
export const update = async (req: Request, res: Response) => {
  try {
    const { companies: _companies, ...customerData } = req.body
    const customer = await db.customer.update({
      where: { id: req.params.id },
      data: customerData,
      include: { manager: true }
    })
    res.json(customer)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Delete customer
export const deleteCustomer = async (req: Request, res: Response) => {
  try {
    await db.customer.delete({ where: { id: req.params.id }})
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
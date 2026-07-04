import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get all employees
export const getAll = async (req: Request, res: Response) => {
  try {
    const employees = await db.employee.findMany()
    res.json(employees)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Get employee by ID
export const getById = async (req: Request, res: Response) => {
  try {
    const employee = await db.employee.findUnique({
      where: { id: req.params.id }
    })
    if (!employee) return res.status(404).json({ error: 'Employee not found' })
    res.json(employee)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Create new employee
export const create = async (req: Request, res: Response) => {
  try {
    const employee = await db.employee.create({
      data: req.body
    })
    res.status(201).json(employee)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update employee
export const update = async (req: Request, res: Response) => {
  try {
    const employee = await db.employee.update({
      where: { id: req.params.id },
      data: req.body
    })
    res.json(employee)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Delete employee
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    await db.employee.delete({ where: { id: req.params.id }})
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
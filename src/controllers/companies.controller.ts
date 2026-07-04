import { Request, Response } from 'express'
import { db } from '../services/db.service'

// Get all companies
export const getAll = async (req: Request, res: Response) => {
  try {
    const companies = await db.customer_company.findMany()
    res.json(companies)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Get company by ID
export const getById = async (req: Request, res: Response) => {
  try {
    const company = await db.customer_company.findUnique({
      where: { id: req.params.id }
    })
    if (!company) return res.status(404).json({ error: 'Company not found' })
    res.json(company)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Create new company
export const create = async (req: Request, res: Response) => {
  try {
    const company = await db.customer_company.create({
      data: req.body
    })
    res.status(201).json(company)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Update company

// Assuming we need to handle updates to company data
// This would depend on business rules - for now, simple update
export const update = async (req: Request, res: Response) => {
  try {
    const company = await db.customer_company.update({
      where: { id: req.params.id },
      data: req.body
    })
    res.json(company)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

// Delete company

// Need to handle constraints - can't delete if associated with customers
// For now, basic delete
export const deleteCompany = async (req: Request, res: Response) => {
  try {
    await db.customer_company.delete({ where: { id: req.params.id }})
    res.status(204).send()
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
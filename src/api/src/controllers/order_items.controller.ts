### OrderItems Controller

```typescript
import { Request, Response } from 'express'
import { db } from '../../services/db.service'

// Get all order items by order ID
export const getByOrder = async (req: Request, res: Response) => {
  const { orderId } = req.params
  const items = await db.orderItem.findMany({ where: { orderId } })
  res.json(items)
}

// Create new order item
export const create = async (req: Request, res: Response) => {
  try {
    const item = await db.orderItem.create({
      data: {
        orderId: req.body.orderId,
        productName: req.body.productName,
        quantity: req.body.quantity,
        pricePerUnit: req.body.pricePerUnit
      }
    })
    res.status(201).json(item)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```
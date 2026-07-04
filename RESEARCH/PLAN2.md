### Order Number Generation Logic

We need to implement automatic generation of order numbers in format `SO-XXXX` where X is incrementing number. Let's add this in `orders.controller.ts`:

```typescript
// Add to orders.controller.ts
import { db } from '../services/db.service'

export const create = async (req: Request, res: Response) => {
  try {
    // Check if orderNumber is provided, else generate automatically
    if (!req.body.orderNumber) {
      const lastOrder = await db.order
        .orderBy({ orderNumber: 'desc' })
        .first()

      let newNumber = 'SO-0001'
      if (lastOrder) {
        const currentNumber = parseInt(lastOrder.orderNumber.replace('SO-', ''))
        newNumber = `SO-${String(currentNumber + 1).padStart(4, '0')}'
      }

      req.body.orderNumber = newNumber
    }

    const newOrder = await db.order.create({
      data: req.body,
      include: { orderItems: true }
    })

    res.status(201).json(newOrder)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
```

This implementation:
1. Checks if orderNumber is provided
2. If not, finds last order number
3. Increments the number and formats it as SO-XXXX
4. Assigns it to the new order

Should we modify Prisma schema to use sequence instead? The current approach works but may have race conditions in concurrent scenarios.
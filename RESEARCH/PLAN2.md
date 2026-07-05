## Swagger Documentation

```yaml
swagger: '2.0'
info:
  title: ERP System API
  version: 1.0.0
  description: 'Full API specification for ERP-System with CRUD operations for orders, customers, payments, and specialized production/office views'
servers:
  - url: 'http://localhost:3000'

paths:
  '/api/orders':
    get:
      summary: 'List all orders'
      produces: ['application/json']
      responses:
        '200':
          description: 'List of orders'
          schema:
            type: array
            items:
              $ref: '#/definitions/Order'
    post:
      summary: 'Create new order'
      consumes: ['application/json']
      parameters:
        - in: body
          name: order
          required: true
          schema:
            type: object
            properties:
              orderNumber: { type: string }
              customerId: { type: string }
              items: { type: array, items: { $ref: '#/definitions/OrderItem' } }
      responses:
        '201':
          description: 'Created order'
          schema:
            $ref: '#/definitions/Order'

definitions:
  Order:
    type: object
    properties:
      id: { type: string }
      orderNumber: { type: string }
      customerId: { type: string }
      items: { type: array, items: { $ref: '#/definitions/OrderItem' } }
      status: { type: string }
      orderSum: { type: number }
      profit: { type: number }
    required: ['id', 'orderNumber']
  OrderItem:
    type: object
    properties:
      id: { type: string }
      productName: { type: string }
      quantity: { type: integer }
      pricePerUnit: { type: number }
      contractorId: { type: string }
      productionStatus: { type: string }
    required: ['id', 'productName']
```
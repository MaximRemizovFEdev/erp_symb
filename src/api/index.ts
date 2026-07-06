import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Routes
const ordersRouter = require('./routes/orders').router;
const orderItemsRouter = require('./routes/order_items').router;
const customersRouter = require('./routes/customers').router;
const companiesRouter = require('./routes/companies').router;
const employeesRouter = require('./routes/employees').router;
const contractorsRouter = require('./routes/contractors').router;
const paymentsRouter = require('./routes/payments').router;

app.use('/api/orders', ordersRouter);
app.use('/api/order-items', orderItemsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/contractors', contractorsRouter);
app.use('/api/payments', paymentsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { app, prisma };
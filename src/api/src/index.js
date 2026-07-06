const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Simple test route
app.get('/api', (req, res) => {
  res.json({ message: "ERP API is running" });
});

// Orders routes
app.get('/api/orders', async (req, res) => {
  const orders = await prisma.order.findMany();
  res.json(orders);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
}).on('error', (err) => {
  console.error('Server error:', err);
});

app.get('/api/customers', async (req, res) => {
  const customers = await prisma.customer.findMany();
  res.json(customers);
});
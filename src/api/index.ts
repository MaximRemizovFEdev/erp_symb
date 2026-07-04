import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import { ordersRouter } from './routes/orders'

dotenv.config()

const app = express()
app.use(cors())
app.use(morgan('dev'))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = process.env.PORT || 3000

app.get('/', (req, res) => {
  res.json({ message: 'ERP Symbolica API' })
})

app.use('/api', ordersRouter)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
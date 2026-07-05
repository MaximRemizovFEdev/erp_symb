import { useState, useEffect } from 'react'
import OrdersList from './components/OrdersList'
import OrderForm from './components/OrderForm'
import './App.css'
import api from './services/api'

function App() {
  const [orders, setOrders] = useState([])
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [customers, setCustomers] = useState([])
  const [employees, setEmployees] = useState([])
  const [contractors, setContractors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInitialData()
  }, [])

  const loadInitialData = async () => {
    try {
      const [ordersData, customersData, employeesData, contractorsData] = await Promise.all([
        api.getOrders(),
        api.getCustomers(),
        api.getEmployees(),
        api.getContractors()
      ])
      setOrders(ordersData)
      setCustomers(customersData)
      setEmployees(employeesData)
      setContractors(contractorsData)
    } catch (error) {
      console.error('Failed to load initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadOrders = async () => {
    try {
      const data = await api.getOrders()
      setOrders(data)
    } catch (error) {
      console.error('Failed to load orders:', error)
    }
  }

  const handleCreateOrder = async (orderData) => {
    try {
      await api.createOrder(orderData)
      setShowForm(false)
      loadOrders()
    } catch (error) {
      console.error('Failed to create order:', error)
    }
  }

  const handleUpdateOrder = async (orderData) => {
    try {
      await api.updateOrder(selectedOrder.id, orderData)
      setShowForm(false)
      setIsEditing(false)
      setSelectedOrder(null)
      loadOrders()
    } catch (error) {
      console.error('Failed to update order:', error)
    }
  }

  const handleNewOrder = () => {
    setSelectedOrder(null)
    setIsEditing(false)
    setShowForm(true)
  }

  const handleEditOrder = (order) => {
    setSelectedOrder(order)
    setIsEditing(true)
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setIsEditing(false)
    setSelectedOrder(null)
  }

  if (loading) {
    return <div className="loading">Загрузка...</div>
  }

  return (
    <div className="app">
      <header>
        <h1>ERP Символика</h1>
        <button className="btn-primary" onClick={handleNewOrder}>Создать заказ</button>
      </header>

      {showForm && (
        <div className="modal-overlay" onClick={handleCancel}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <OrderForm 
              onSubmit={isEditing ? handleUpdateOrder : handleCreateOrder} 
              onCancel={handleCancel}
              initialData={isEditing ? selectedOrder : null}
              customers={customers}
              employees={employees}
              contractors={contractors}
            />
          </div>
        </div>
      )}

      <main>
        <OrdersList 
          orders={orders} 
          onSelect={handleEditOrder}
        />
      </main>
    </div>
  )
}

export default App
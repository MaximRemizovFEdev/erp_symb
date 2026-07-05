const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

class ApiService {
  async request(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }

    return response.json()
  }

  // Orders
  getOrders() {
    return this.request('/orders')
  }

  getOrder(id) {
    return this.request(`/orders/${id}`)
  }

  createOrder(data) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Order Items
  getOrderItems(orderId) {
    return this.request(`/order-items/${orderId}`)
  }

  createOrderItem(data) {
    return this.request('/order-items', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Customers
  getCustomers() {
    return this.request('/customers')
  }

  createCustomer(data) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Companies
  getCompanies() {
    return this.request('/companies')
  }

  createCompany(data) {
    return this.request('/companies', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // Employees
  getEmployees() {
    return this.request('/employees')
  }

  // Contractors
  getContractors() {
    return this.request('/contractors')
  }

  // Payments
  getPayments(orderId) {
    return this.request(`/payments/${orderId}`)
  }

  createPayment(data) {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export default new ApiService()
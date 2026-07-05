import { useState, useMemo } from 'react'
import OrderCard from './OrderCard'

function OrdersList({ orders, onSelect, searchQuery = '', filters = {} }) {
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Фильтрация и поиск
  const filteredOrders = useMemo(() => {
    let result = [...orders]
    
    // Поиск по номеру заказа
    if (searchQuery) {
      result = result.filter(order => 
        order.orderNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Фильтрация по статусу
    if (filters.status) {
      result = result.filter(order => 
        order.status?.name === filters.status
      )
    }
    
    // Фильтрация по дате
    if (filters.dateFrom) {
      result = result.filter(order => 
        new Date(order.date) >= new Date(filters.dateFrom)
      )
    }
    
    if (filters.dateTo) {
      result = result.filter(order => 
        new Date(order.date) <= new Date(filters.dateTo)
      )
    }
    
    return result
  }, [orders, searchQuery, filters])

  // Пагинация
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage)

  const handlePageChange = (page) => {
    setCurrentPage(page)
  }

  return (
    <div className="orders-list">
      {filteredOrders.length === 0 ? (
        <div className="empty-state">
          <p>Заказы не найдены</p>
        </div>
      ) : (
        <>
          <ul className="orders-grid">
            {paginatedOrders.map(order => (
              <li key={order.id} className="order-item">
                <OrderCard 
                  order={order} 
                  onSelect={() => onSelect(order)}
                />
              </li>
            ))}
          </ul>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="pagination-btn"
              >
                ← Назад
              </button>
              
              <span className="page-info">
                Страница {currentPage} из {totalPages}
              </span>
              
              <button 
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="pagination-btn"
              >
                Вперед →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default OrdersList
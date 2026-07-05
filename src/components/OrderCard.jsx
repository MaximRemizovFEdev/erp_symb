function OrderCard({ order, isSelected, onSelect }) {
  return (
    <div 
      className={`order-card ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <div className="order-header">
        <h3>{`Заказ #${order.orderNumber}`}</h3>
        <span className={`status ${order.status?.name || 'Новый'}`}>
          {order.status?.name || 'Новый'}
        </span>
      </div>
      
      <div className="order-details">
        <p><strong>Клиент:</strong> {order.customer?.name || 'N/A'}</p>
        <p><strong>Компания:</strong> {order.company?.name || 'N/A'}</p>
        <p><strong>Менеджер:</strong> {order.manager?.fullName || 'N/A'}</p>
        <p><strong>Сумма:</strong> {order.orderSum?.toLocaleString()} ₽</p>
        <p><strong>Прибыль:</strong> {order.profitSum?.toLocaleString()} ₽</p>
      </div>

      <div className="order-items">
        <h4>Позиции:</h4>
        {order.items?.map(item => (
          <div key={item.id} className="order-item">
            <span>{item.productName}</span>
            <span>{item.quantity} × {item.pricePerUnit} ₽</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default OrderCard
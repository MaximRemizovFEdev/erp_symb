import { useState, useEffect } from 'react'
import api from '../services/api'

function OrderForm({ onSubmit, onCancel, initialData = null, customers = [], employees = [], contractors = [] }) {
  const [formData, setFormData] = useState({
    customerId: '',
    companyId: '',
    managerId: '',
    deadline: '',
    shippingMethod: 'office_pickup',
    shippingComment: '',
    comment: '',
    items: [{
      productName: '',
      quantity: 1,
      pricePerUnit: 0,
      contractor1Id: '',
      contractor2Id: '',
      contractor1Cost: 0,
      contractor2Cost: 0,
      technicalTaskText: '',
      url: '',
      deadline: '',
    }]
  })
  
  const [errors, setErrors] = useState({})

  useEffect(() => {
    if (initialData) {
      setFormData({
        customerId: initialData.customerId || '',
        companyId: initialData.companyId || '',
        managerId: initialData.managerId || '',
        deadline: initialData.deadline ? initialData.deadline.split('T')[0] : '',
        shippingMethod: initialData.shippingMethod || 'office_pickup',
        shippingComment: initialData.shippingComment || '',
        comment: initialData.comment || '',
        items: initialData.items?.length ? initialData.items.map(item => ({
          productName: item.productName || '',
          quantity: item.quantity || 1,
          pricePerUnit: item.pricePerUnit || 0,
          contractor1Id: item.contractor1Id || '',
          contractor2Id: item.contractor2Id || '',
          contractor1Cost: item.contractor1Cost || 0,
          contractor2Cost: item.contractor2Cost || 0,
          technicalTaskText: item.technicalTaskText || '',
          url: item.url || '',
          deadline: item.deadline ? item.deadline.split('T')[0] : '',
        })) : [{
          productName: '',
          quantity: 1,
          pricePerUnit: 0,
          contractor1Id: '',
          contractor2Id: '',
          contractor1Cost: 0,
          contractor2Cost: 0,
          technicalTaskText: '',
          url: '',
          deadline: '',
        }]
      })
    }
  }, [initialData])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }))
  }

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        productName: '',
        quantity: 1,
        pricePerUnit: 0,
        contractor1Id: '',
        contractor2Id: '',
        contractor1Cost: 0,
        contractor2Cost: 0,
        technicalTaskText: '',
        url: '',
        deadline: '',
      }]
    }))
  }

  const removeItem = (index) => {
    if (formData.items.length <= 1) return
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.customerId) newErrors.customerId = 'Выберите клиента'
    if (!formData.companyId) newErrors.companyId = 'Выберите компанию'
    if (!formData.managerId) newErrors.managerId = 'Выберите менеджера'
    if (!formData.deadline) newErrors.deadline = 'Укажите срок'
    
    formData.items.forEach((item, index) => {
      if (!item.productName) {
        newErrors[`items[${index}].productName`] = 'Введите наименование'
      }
      if (!item.quantity || item.quantity < 1) {
        newErrors[`items[${index}].quantity`] = 'Количество должно быть >= 1'
      }
      if (!item.pricePerUnit || item.pricePerUnit < 0) {
        newErrors[`items[${index}].pricePerUnit`] = 'Введите цену'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    
    const orderData = {
      ...formData,
      items: formData.items.map(item => ({
        ...item,
        orderSum: item.quantity * item.pricePerUnit,
        unitCost: item.contractor1Cost + item.contractor2Cost,
        totalCost: (item.contractor1Cost + item.contractor2Cost) * item.quantity,
      }))
    }
    
    onSubmit(orderData)
  }

  const calculateItemSum = (item) => {
    return (item.quantity * item.pricePerUnit).toLocaleString()
  }

  const calculateTotalSum = () => {
    return formData.items.reduce((sum, item) => sum + item.quantity * item.pricePerUnit, 0).toLocaleString()
  }

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <h2>{initialData ? 'Редактирование заказа' : 'Создание заказа'}</h2>
      
      <div className="form-section">
        <h3>Основная информация</h3>
        <div className="form-row">
          <div className="form-group">
            <label>Клиент *</label>
            <select 
              value={formData.customerId} 
              onChange={(e) => handleChange('customerId', e.target.value)}
            >
              <option value="">Выберите клиента</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {errors.customerId && <span className="error">{errors.customerId}</span>}
          </div>
          
          <div className="form-group">
            <label>Компания *</label>
            <select 
              value={formData.companyId} 
              onChange={(e) => handleChange('companyId', e.target.value)}
            >
              <option value="">Выберите компанию</option>
            </select>
            {errors.companyId && <span className="error">{errors.companyId}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Менеджер *</label>
            <select 
              value={formData.managerId} 
              onChange={(e) => handleChange('managerId', e.target.value)}
            >
              <option value="">Выберите менеджера</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.fullName}</option>)}
            </select>
            {errors.managerId && <span className="error">{errors.managerId}</span>}
          </div>

          <div className="form-group">
            <label>Срок выполнения *</label>
            <input 
              type="date" 
              value={formData.deadline} 
              onChange={(e) => handleChange('deadline', e.target.value)}
            />
            {errors.deadline && <span className="error">{errors.deadline}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Способ получения</label>
            <select 
              value={formData.shippingMethod} 
              onChange={(e) => handleChange('shippingMethod', e.target.value)}
            >
              <option value="office_pickup">Самовывоз из офиса</option>
              <option value="courier">Курьер</option>
              <option value="delivery">Доставка</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>Комментарий к доставке</label>
          <textarea 
            value={formData.shippingComment} 
            onChange={(e) => handleChange('shippingComment', e.target.value)}
            rows={2}
          />
        </div>

        <div className="form-group">
          <label>Комментарий</label>
          <textarea 
            value={formData.comment} 
            onChange={(e) => handleChange('comment', e.target.value)}
            rows={3}
          />
        </div>
      </div>

      <div className="form-section">
        <div className="section-header">
          <h3>Позиции заказа</h3>
          <button type="button" className="btn-secondary" onClick={addItem}>+ Добавить позицию</button>
        </div>

        {formData.items.map((item, index) => (
          <div key={index} className="item-card">
            <div className="item-header">
              <h4>Позиция #{index + 1}</h4>
              {formData.items.length > 1 && (
                <button type="button" className="btn-danger" onClick={() => removeItem(index)}>Удалить</button>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Наименование *</label>
                <input 
                  value={item.productName} 
                  onChange={(e) => handleItemChange(index, 'productName', e.target.value)}
                  placeholder="Например: Футболка с логотипом"
                />
                {errors[`items[${index}].productName`] && <span className="error">{errors[`items[${index}].productName`]}</span>}
              </div>

              <div className="form-group">
                <label>Количество *</label>
                <input 
                  type="number" 
                  min="1"
                  value={item.quantity} 
                  onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                />
                {errors[`items[${index}].quantity`] && <span className="error">{errors[`items[${index}].quantity`]}</span>}
              </div>

              <div className="form-group">
                <label>Цена за ед. *</label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01"
                  value={item.pricePerUnit} 
                  onChange={(e) => handleItemChange(index, 'pricePerUnit', parseFloat(e.target.value) || 0)}
                />
                {errors[`items[${index}].pricePerUnit`] && <span className="error">{errors[`items[${index}].pricePerUnit`]}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Сумма позиции</label>
                <div className="calculated-field">{calculateItemSum(item)} ₽</div>
              </div>

              <div className="form-group">
                <label>Подрядчик 1</label>
                <select 
                  value={item.contractor1Id} 
                  onChange={(e) => handleItemChange(index, 'contractor1Id', e.target.value)}
                >
                  <option value="">Не выбран</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Себестоимость подрядчика 1</label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01"
                  value={item.contractor1Cost} 
                  onChange={(e) => handleItemChange(index, 'contractor1Cost', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Подрядчик 2</label>
                <select 
                  value={item.contractor2Id} 
                  onChange={(e) => handleItemChange(index, 'contractor2Id', e.target.value)}
                >
                  <option value="">Не выбран</option>
                  {contractors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Себестоимость подрядчика 2</label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01"
                  value={item.contractor2Cost} 
                  onChange={(e) => handleItemChange(index, 'contractor2Cost', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Техническое задание</label>
              <textarea 
                value={item.technicalTaskText} 
                onChange={(e) => handleItemChange(index, 'technicalTaskText', e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Ссылка на макет</label>
                <input 
                  value={item.url} 
                  onChange={(e) => handleItemChange(index, 'url', e.target.value)}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label>Срок позиции</label>
                <input 
                  type="date" 
                  value={item.deadline} 
                  onChange={(e) => handleItemChange(index, 'deadline', e.target.value)}
                />
              </div>
            </div>
          </div>
        ))}

        <div className="total-section">
          <h3>Итого: {calculateTotalSum()} ₽</h3>
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}>Отмена</button>
        <button type="submit" className="btn-primary">
          {initialData ? 'Сохранить' : 'Создать заказ'}
        </button>
      </div>
    </form>
  )
}

export default OrderForm
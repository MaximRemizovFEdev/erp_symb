const app = document.querySelector("#app");
const storageKey = "erp_symb_token";
const state = {
  token: localStorage.getItem(storageKey),
  user: null,
  view: "orders",
  data: {},
  error: ""
};

const roleViews = {
  admin: ["orders", "crm", "payments", "office"],
  owner: ["orders", "crm", "payments", "office"],
  manager: ["orders", "crm", "payments"],
  office: ["payments", "office"],
  production: ["production"]
};

const viewLabels = {
  orders: "Заказы",
  crm: "Клиенты",
  payments: "Оплаты",
  production: "Производство",
  office: "Офис"
};

function money(value) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function allowedViews() {
  return roleViews[state.user?.role] || [];
}

async function api(path, options = {}) {
  const headers = { "content-type": "application/json", ...(options.headers || {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(body?.error?.message || `HTTP ${response.status}`);
  return body;
}

async function loadMe() {
  if (!state.token) return false;
  try {
    state.user = await api("/auth/me");
    if (!allowedViews().includes(state.view)) state.view = allowedViews()[0] || "orders";
    return true;
  } catch (_error) {
    localStorage.removeItem(storageKey);
    state.token = null;
    state.user = null;
    return false;
  }
}

async function bootstrap() {
  await loadMe();
  await render();
}

async function render() {
  if (!state.user) {
    renderLogin();
    return;
  }
  await loadViewData();
  app.innerHTML = shell(viewHtml());
  bindCommon();
  bindView();
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-screen">
      <form class="login-panel" id="login-form">
        <h1>ERP Symb</h1>
        <p>Вход в рабочее приложение</p>
        <div class="form-grid">
          <div class="form-row"><label>Логин</label><input name="username" value="admin" autocomplete="username" required /></div>
          <div class="form-row"><label>Пароль</label><input name="password" type="password" value="admin123" autocomplete="current-password" required /></div>
          ${state.error ? `<div class="error">${escapeHtml(state.error)}</div>` : ""}
          <button class="primary" type="submit">Войти</button>
        </div>
      </form>
    </main>`;
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    state.error = "";
    const form = new FormData(event.currentTarget);
    try {
      const result = await api("/auth/login", { method: "POST", body: JSON.stringify(Object.fromEntries(form)) });
      state.token = result.token;
      state.user = result.user;
      localStorage.setItem(storageKey, state.token);
      state.view = allowedViews()[0] || "orders";
      await render();
    } catch (error) {
      state.error = error.message;
      renderLogin();
    }
  });
}

function shell(content) {
  const nav = allowedViews().map((view) => `<button data-view="${view}" class="${state.view === view ? "active" : ""}"><span>${viewLabels[view]}</span><span>›</span></button>`).join("");
  return `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand"><strong>ERP Symb</strong><span>Native MVP</span></div>
        <nav class="nav">${nav}</nav>
        <div class="user-box"><div><strong>${escapeHtml(state.user.username || state.user.id)}</strong><br><small>${escapeHtml(state.user.role)}</small></div><button class="secondary" id="logout">Выйти</button></div>
      </aside>
      <main class="main">${state.error ? `<div class="panel error">${escapeHtml(state.error)}</div>` : ""}${content}</main>
    </div>`;
}

function bindCommon() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", async () => {
    state.view = button.dataset.view;
    state.error = "";
    await render();
  }));
  document.querySelector("#logout")?.addEventListener("click", async () => {
    try { await api("/auth/logout", { method: "POST" }); } catch (_error) {}
    localStorage.removeItem(storageKey);
    state.token = null;
    state.user = null;
    await render();
  });
}

async function loadViewData() {
  state.error = "";
  try {
    const refs = ["customers", "customer-companies", "contractors", "order-statuses", "production-statuses", "office-statuses"].map((name) => api(`/${name}`).catch(() => []));
    const [customers, companies, contractors, orderStatuses, productionStatuses, officeStatuses] = await Promise.all(refs);
    Object.assign(state.data, { customers, companies, contractors, orderStatuses, productionStatuses, officeStatuses });
    if (state.view === "orders") {
      [state.data.orders, state.data.links] = await Promise.all([api("/orders"), api("/customer-company-links")]);
    }
    if (state.view === "crm") state.data.links = await api("/customer-company-links");
    if (state.view === "payments") {
      state.data.orders = await api("/orders").catch(() => []);
      state.data.payments = await api("/payments");
      state.data.allocations = await api("/payment-allocations");
    }
    if (state.view === "production") {
      const contractorId = state.data.contractors[0]?.id;
      state.data.productionContractorId = contractorId;
      state.data.productionItems = contractorId ? await api(`/production/${contractorId}/items`) : [];
    }
    if (state.view === "office") state.data.officeOrders = await api("/office/orders");
  } catch (error) {
    state.error = error.message;
  }
}

function viewHtml() {
  if (state.view === "orders") return ordersView();
  if (state.view === "crm") return crmView();
  if (state.view === "payments") return paymentsView();
  if (state.view === "production") return productionView();
  if (state.view === "office") return officeView();
  return `<section class="panel">Нет доступного раздела</section>`;
}

function options(items, selected = "") {
  return `<option value="">—</option>${(items || []).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selected ? "selected" : ""}>${escapeHtml(item.fullName || item.name || item.title || item.username || item.id)}</option>`).join("")}`;
}

function ordersView() {
  const orders = state.data.orders || [];
  const firstCustomerId = state.data.customers?.[0]?.id || "";
  return `
    <div class="topbar"><div><h2>Заказы</h2><div class="subtle">Создание заказов, позиции и базовые статусы</div></div></div>
    <section class="kpis"><div class="kpi"><span>Заказов</span><strong>${orders.length}</strong></div><div class="kpi"><span>Сумма</span><strong>${money(orders.reduce((sum, order) => sum + Number(order.orderSum || 0), 0))}</strong></div><div class="kpi"><span>Оплачено</span><strong>${money(orders.reduce((sum, order) => sum + Number(order.paidAmount || 0), 0))}</strong></div><div class="kpi"><span>Долг</span><strong>${money(orders.reduce((sum, order) => sum + Number(order.paymentDue || 0), 0))}</strong></div></section>
    <section class="grid">
      <form class="panel span-4 form-grid" id="order-form"><h3>Новый заказ</h3><div class="form-row"><label>Клиент</label><select id="order-customer-select" name="customerId" required>${options(state.data.customers)}</select></div><div class="form-row"><label>Компания</label><select id="order-company-select" name="companyId">${options(companiesForCustomer(firstCustomerId))}</select></div><div class="form-row"><label>Комментарий</label><textarea name="comment"></textarea></div><button class="primary">Создать</button></form>
      <div class="panel span-8"><h3>Список</h3><div class="list">${orders.length ? orders.map(orderCard).join("") : `<div class="empty">Заказов пока нет</div>`}</div></div>
    </section>`;
}

function orderCard(order) {
  return `<article class="item"><div class="item-head"><div><div class="item-title">${escapeHtml(order.orderNumber || order.id)}</div><div class="meta"><span>Клиент: ${escapeHtml(order.customerId)}</span><span>Статус: ${escapeHtml(order.orderStatusId)}</span><span>Офис: ${escapeHtml(order.officeStatusId)}</span></div></div><strong>${money(order.orderSum)}</strong></div><div class="meta"><span class="badge">Оплачено ${money(order.paidAmount)}</span><span class="badge">К доплате ${money(order.paymentDue)}</span></div>${(order.items || []).map((item) => `<div class="meta"><span>${escapeHtml(item.name)}</span><span>${item.quantity} шт.</span><span>${money(item.pricePerUnit)}</span><span>${escapeHtml(item.productionStatusId || "")}</span></div>`).join("")}<form class="actions add-item" data-order-id="${escapeHtml(order.id)}"><input name="name" placeholder="Позиция" required /><input name="quantity" type="number" min="1" step="1" value="1" required /><input name="pricePerUnit" type="number" min="0" step="1" placeholder="Цена" required /><select name="contractorId">${options(state.data.contractors)}</select><button class="secondary">Добавить позицию</button></form></article>`;
}

function companiesForCustomer(customerId) {
  if (!customerId) return [];
  const links = state.data.links || [];
  const companyIds = new Set(links.filter((link) => link.customerId === customerId && link.active !== false).map((link) => link.companyId));
  return (state.data.companies || []).filter((company) => companyIds.has(company.id));
}

function crmView() {
  return `<div class="topbar"><div><h2>Клиенты и компании</h2><div class="subtle">Справочник CRM и связи клиент-компания</div></div></div><section class="grid"><form class="panel span-4 form-grid" id="customer-form"><h3>Клиент</h3><div class="form-row"><label>Имя</label><input name="fullName" required /></div><div class="form-row"><label>Телефон</label><input name="phone" /></div><button class="primary">Добавить</button></form><form class="panel span-4 form-grid" id="company-form"><h3>Компания</h3><div class="form-row"><label>Название</label><input name="name" required /></div><div class="form-row"><label>ИНН</label><input name="inn" /></div><button class="primary">Добавить</button></form><form class="panel span-4 form-grid" id="link-form"><h3>Связь</h3><div class="form-row"><label>Клиент</label><select name="customerId" required>${options(state.data.customers)}</select></div><div class="form-row"><label>Компания</label><select name="companyId" required>${options(state.data.companies)}</select></div><button class="primary">Связать</button></form><div class="panel span-6"><h3>Клиенты</h3>${simpleTable(state.data.customers || [], ["id", "fullName", "phone", "balance"])}</div><div class="panel span-6"><h3>Компании</h3>${simpleTable(state.data.companies || [], ["id", "name", "inn", "balance"])}</div></section>`;
}

function paymentsView() {
  const payments = state.data.payments || [];
  return `<div class="topbar"><div><h2>Оплаты</h2><div class="subtle">Создание платежей и распределение по заказам</div></div></div><section class="grid"><form class="panel span-4 form-grid" id="payment-form"><h3>Новый платеж</h3><div class="form-row"><label>Клиент</label><select name="customerId">${options(state.data.customers)}</select></div><div class="form-row"><label>Компания</label><select name="companyId">${options(state.data.companies)}</select></div><div class="form-row"><label>Сумма</label><input name="amount" type="number" min="1" step="1" required /></div><div class="form-row"><label>Метод</label><input name="method" /></div><button class="primary">Добавить</button></form><form class="panel span-4 form-grid" id="allocation-form"><h3>Распределить</h3><div class="form-row"><label>Платеж</label><select name="paymentId" required>${options(payments.map((payment) => ({ id: payment.id, name: `${payment.id} · ${money(payment.unallocatedAmount)}` })))}</select></div><div class="form-row"><label>Заказ</label><select name="orderId" required>${options((state.data.orders || []).map((order) => ({ id: order.id, name: order.orderNumber || order.id })))}</select></div><div class="form-row"><label>Сумма</label><input name="amount" type="number" min="1" step="1" required /></div><button class="primary">Распределить</button></form><div class="panel span-4"><h3>Итого</h3><div class="kpi"><span>Нераспределено</span><strong>${money(payments.reduce((sum, item) => sum + Number(item.unallocatedAmount || 0), 0))}</strong></div></div><div class="panel span-12"><h3>Платежи</h3>${simpleTable(payments, ["id", "customerId", "companyId", "amount", "allocatedAmount", "unallocatedAmount", "paidAt"])}</div></section>`;
}

function productionView() {
  const contractors = state.data.contractors || [];
  const items = state.data.productionItems || [];
  return `<div class="topbar"><div><h2>Производство</h2><div class="subtle">Задачи подрядчика без финансовых полей</div></div><select id="production-contractor">${contractors.map((contractor) => `<option value="${escapeHtml(contractor.id)}" ${contractor.id === state.data.productionContractorId ? "selected" : ""}>${escapeHtml(contractor.name || contractor.id)}</option>`).join("")}</select></div><section class="panel"><h3>Позиции</h3><div class="list">${items.length ? items.map((item) => `<article class="item"><div class="item-head"><div><div class="item-title">${escapeHtml(item.name)}</div><div class="meta"><span>${escapeHtml(item.orderNumber || item.orderId)}</span><span>${item.quantity} шт.</span><span>${escapeHtml(item.productionStatusId || "")}</span></div></div></div><form class="actions production-status" data-id="${escapeHtml(item.id)}"><select name="productionStatusId">${options(state.data.productionStatuses, item.productionStatusId)}</select><button class="secondary">Статус</button></form><form class="actions production-comment" data-id="${escapeHtml(item.id)}"><input name="comment" value="${escapeHtml(item.comment || "")}" /><button class="secondary">Комментарий</button></form></article>`).join("") : `<div class="empty">Нет задач для подрядчика</div>`}</div></section>`;
}

function officeView() {
  const orders = state.data.officeOrders || [];
  return `<div class="topbar"><div><h2>Офис</h2><div class="subtle">Статусы готовности и прием платежей</div></div></div><section class="panel"><h3>Заказы</h3><div class="list">${orders.length ? orders.map((order) => `<article class="item"><div class="item-head"><div><div class="item-title">${escapeHtml(order.orderNumber || order.id)}</div><div class="meta"><span>Клиент: ${escapeHtml(order.customerId)}</span><span>Офис: ${escapeHtml(order.officeStatusId)}</span></div></div></div><form class="actions office-status" data-id="${escapeHtml(order.id)}"><select name="officeStatusId">${options(state.data.officeStatuses, order.officeStatusId)}</select><button class="secondary">Обновить статус</button></form><form class="actions office-payment" data-id="${escapeHtml(order.id)}"><input name="amount" type="number" min="1" step="1" placeholder="Сумма" required /><input name="method" placeholder="Метод" /><button class="primary">Принять оплату</button></form>${(order.items || []).map((item) => `<div class="meta"><span>${escapeHtml(item.name)}</span><span>${item.quantity} шт.</span><span>${escapeHtml(item.officeStatusId || "")}</span></div>`).join("")}</article>`).join("") : `<div class="empty">Нет заказов для офиса</div>`}</div></section>`;
}

function simpleTable(items, keys) {
  if (!items.length) return `<div class="empty">Нет записей</div>`;
  return `<table class="table"><thead><tr>${keys.map((key) => `<th>${escapeHtml(key)}</th>`).join("")}</tr></thead><tbody>${items.map((item) => `<tr>${keys.map((key) => `<td>${key.toLowerCase().includes("amount") || key === "balance" ? money(item[key]) : escapeHtml(item[key] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function bindView() {
  document.querySelector("#order-customer-select")?.addEventListener("change", (event) => {
    const companySelect = document.querySelector("#order-company-select");
    if (companySelect) companySelect.innerHTML = options(companiesForCustomer(event.currentTarget.value));
  });
  bindForm("#order-form", async (data) => api("/orders", { method: "POST", body: JSON.stringify(clean(data)) }));
  document.querySelectorAll(".add-item").forEach((form) => form.addEventListener("submit", async (event) => submit(event, async (data) => api(`/orders/${form.dataset.orderId}/items`, { method: "POST", body: JSON.stringify(toNumbers(clean(data), ["quantity", "pricePerUnit"])) }))));
  bindForm("#customer-form", async (data) => api("/customers", { method: "POST", body: JSON.stringify({ id: id("customer"), ...clean(data) }) }));
  bindForm("#company-form", async (data) => api("/customer-companies", { method: "POST", body: JSON.stringify({ id: id("company"), ...clean(data) }) }));
  bindForm("#link-form", async (data) => api("/customer-company-links", { method: "POST", body: JSON.stringify({ id: id("customer_company_link"), active: true, ...clean(data) }) }));
  bindForm("#payment-form", async (data) => api("/payments", { method: "POST", body: JSON.stringify(toNumbers(clean(data), ["amount"])) }));
  bindForm("#allocation-form", async (data) => api("/payment-allocations", { method: "POST", body: JSON.stringify(toNumbers(clean(data), ["amount"])) }));
  document.querySelector("#production-contractor")?.addEventListener("change", async (event) => {
    state.data.productionContractorId = event.currentTarget.value;
    state.data.productionItems = await api(`/production/${event.currentTarget.value}/items`);
    await render();
  });
  document.querySelectorAll(".production-status").forEach((form) => form.addEventListener("submit", async (event) => submit(event, async (data) => api(`/production/items/${form.dataset.id}/status`, { method: "PATCH", body: JSON.stringify(clean(data)) }))));
  document.querySelectorAll(".production-comment").forEach((form) => form.addEventListener("submit", async (event) => submit(event, async (data) => api(`/production/items/${form.dataset.id}/comment`, { method: "PATCH", body: JSON.stringify(clean(data)) }))));
  document.querySelectorAll(".office-status").forEach((form) => form.addEventListener("submit", async (event) => submit(event, async (data) => api(`/office/orders/${form.dataset.id}/status`, { method: "PATCH", body: JSON.stringify(clean(data)) }))));
  document.querySelectorAll(".office-payment").forEach((form) => form.addEventListener("submit", async (event) => submit(event, async (data) => api(`/office/orders/${form.dataset.id}/payments`, { method: "POST", body: JSON.stringify(toNumbers(clean(data), ["amount"])) }))));
}

function bindForm(selector, handler) {
  const form = document.querySelector(selector);
  if (form) form.addEventListener("submit", (event) => submit(event, handler));
}

async function submit(event, handler) {
  event.preventDefault();
  state.error = "";
  try {
    await handler(Object.fromEntries(new FormData(event.currentTarget)));
    event.currentTarget.reset();
    await render();
  } catch (error) {
    state.error = error.message;
    await render();
  }
}

function clean(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== ""));
}

function toNumbers(input, keys) {
  for (const key of keys) if (input[key] !== undefined) input[key] = Number(input[key]);
  return input;
}

bootstrap();

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('ms-MY', { style: 'currency', currency: 'MYR' }).format(Number(value || 0));

function loadOrders() {
  try { return JSON.parse(localStorage.getItem('tempeten_orders') || '[]'); }
  catch { return []; }
}

function saveOrders(orders) {
  localStorage.setItem('tempeten_orders', JSON.stringify(orders));
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function seedOrders() {
  const existing = loadOrders();
  if (existing.length && !confirm('Tambah lagi data demo?')) return;
  const demo = [
    {
      id: 'TMP-DEMO-A12F', createdAt: new Date().toISOString(),
      customer: { name: 'Aina Rahman', phone: '0123456789' }, batchDate: addDays(5),
      fulfilment: 'seri-kembangan', items: [{ name: 'Bundle Best Seller A', qty: 1, total: 20 }],
      subtotal: 20, deliveryFee: 0, total: 20, paymentStatus: 'paid', orderStatus: 'preparing'
    },
    {
      id: 'TMP-DEMO-B84K', createdAt: new Date(Date.now() - 3600000).toISOString(),
      customer: { name: 'Farid Hakim', phone: '0134567890' }, batchDate: addDays(8),
      fulfilment: 'lalamove', address: 'Cyberjaya, Selangor',
      items: [{ name: 'Classic Tempe Daun', qty: 4, total: 12 }, { name: 'Fusion Tempe Daun', qty: 1, total: 6 }],
      subtotal: 18, deliveryFee: 12, total: 30, paymentStatus: 'pending', orderStatus: 'new'
    },
    {
      id: 'TMP-DEMO-C31P', createdAt: new Date(Date.now() - 7200000).toISOString(),
      customer: { name: 'Nadia Zulkifli', phone: '0145678901' }, batchDate: addDays(4),
      fulfilment: 'banting', items: [{ name: 'Bundle Best Seller B', qty: 2, total: 40 }],
      subtotal: 40, deliveryFee: 0, total: 40, paymentStatus: 'paid', orderStatus: 'ready'
    }
  ];
  saveOrders([...demo, ...existing]);
  render();
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[character]);
}

function units(order) {
  return (order.items || []).reduce((total, item) => total + Number(item.qty || 0), 0);
}

function statusLabel(order) {
  if (order.orderStatus === 'completed') return 'Selesai';
  if (order.orderStatus === 'ready') return 'Sedia';
  if (order.orderStatus === 'preparing') return 'Produksi';
  return order.paymentStatus === 'paid' ? 'Dibayar' : 'Pending';
}

function nextAction(order) {
  if (order.paymentStatus !== 'paid') return ['Tanda paid', 'paid'];
  if (order.orderStatus === 'new') return ['Mulakan', 'preparing'];
  if (order.orderStatus === 'preparing') return ['Tanda sedia', 'ready'];
  if (order.orderStatus === 'ready') return ['Selesaikan', 'completed'];
  return ['Selesai', 'none'];
}

function changeStatus(id, action) {
  const orders = loadOrders();
  const order = orders.find((item) => item.id === id);
  if (!order) return;
  if (action === 'paid') order.paymentStatus = 'paid';
  else if (action !== 'none') order.orderStatus = action;
  saveOrders(orders);
  render();
}

function renderOrders(orders) {
  const filter = $('#statusFilter').value;
  const visible = orders.filter((order) => {
    if (filter === 'all') return true;
    return filter === 'paid' ? order.paymentStatus === 'paid' : order.paymentStatus !== 'paid';
  });

  $('#ordersBody').innerHTML = visible.length ? visible.map((order) => {
    const [label, action] = nextAction(order);
    return `<tr>
      <td><strong>${escapeHtml(order.id)}</strong><br><small>${new Date(order.createdAt).toLocaleString('ms-MY')}</small></td>
      <td>${escapeHtml(order.customer?.name || '-')}<br><small>${escapeHtml(order.customer?.phone || '')}</small></td>
      <td>${escapeHtml(order.batchDate || '-')}<br><small>${escapeHtml(order.fulfilment || '-')}</small></td>
      <td>${money(order.total)}</td>
      <td><span class="status">${escapeHtml(statusLabel(order))}</span></td>
      <td><button class="small-button" data-id="${escapeHtml(order.id)}" data-action="${action}" ${action === 'none' ? 'disabled' : ''}>${label}</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="6">Belum ada order untuk paparan ini.</td></tr>';

  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', () => changeStatus(button.dataset.id, button.dataset.action));
  });
}

function renderBatches(orders) {
  const grouped = new Map();
  orders.forEach((order) => {
    const date = order.batchDate || 'Belum ditetapkan';
    if (!grouped.has(date)) grouped.set(date, { orders: 0, units: 0, value: 0 });
    const batch = grouped.get(date);
    batch.orders += 1;
    batch.units += units(order);
    batch.value += Number(order.total || 0);
  });

  $('#batchList').innerHTML = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, batch]) => `
    <article style="padding:14px 0;border-bottom:1px solid #dfe5dc">
      <strong>${escapeHtml(date)}</strong>
      <p style="margin:5px 0;color:#657169">${batch.orders} order · ${batch.units} unit</p>
      <small>${money(batch.value)}</small>
    </article>
  `).join('') || '<p>Batch akan muncul apabila order dibuat.</p>';
}

function render() {
  const orders = loadOrders().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  $('#mOrders').textContent = orders.filter((order) => order.orderStatus !== 'completed').length;
  $('#mRevenue').textContent = money(orders.filter((order) => order.paymentStatus === 'paid').reduce((sum, order) => sum + Number(order.total || 0), 0));
  $('#mUnits').textContent = orders.reduce((sum, order) => sum + units(order), 0);
  $('#mPending').textContent = orders.filter((order) => order.paymentStatus !== 'paid').length;
  renderOrders(orders);
  renderBatches(orders);
}

function exportCsv() {
  const rows = loadOrders();
  if (!rows.length) return alert('Belum ada order untuk dieksport.');
  const header = ['order_id', 'created_at', 'customer', 'phone', 'batch_date', 'fulfilment', 'subtotal', 'delivery_fee', 'total', 'payment_status', 'order_status'];
  const csv = [header, ...rows.map((order) => [
    order.id, order.createdAt, order.customer?.name || '', order.customer?.phone || '', order.batchDate || '',
    order.fulfilment || '', order.subtotal || 0, order.deliveryFee || 0, order.total || 0,
    order.paymentStatus || '', order.orderStatus || ''
  ])].map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `tempeten-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

$('#seedBtn').addEventListener('click', seedOrders);
$('#exportBtn').addEventListener('click', exportCsv);
$('#statusFilter').addEventListener('change', render);
render();

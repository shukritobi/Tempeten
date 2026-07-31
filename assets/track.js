const BUSINESS_PHONE = '601132099478';
const API_URL = window.TEMPETEN_API_URL || '';
const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat('ms-MY', {
  style: 'currency',
  currency: 'MYR'
}).format(Number(value || 0));

const STATUS_STEPS = [
  ['new', 'Pesanan diterima'],
  ['paid', 'Bayaran disahkan'],
  ['preparing', 'Sedang disediakan'],
  ['ready', 'Sedia untuk pickup / rider'],
  ['completed', 'Selesai']
];

function localOrders() {
  try {
    return JSON.parse(localStorage.getItem('tempeten_orders') || '[]');
  } catch {
    return [];
  }
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
  })[character]);
}

function currentStep(order) {
  if (order.orderStatus === 'completed') return 4;
  if (order.orderStatus === 'ready' || order.deliveryStatus === 'assigned') return 3;
  if (order.orderStatus === 'preparing') return 2;
  if (order.paymentStatus === 'paid') return 1;
  return 0;
}

function renderOrder(order) {
  const step = currentStep(order);
  const items = (order.items || []).map((item) => `
    <div class="summary-item">
      <span>${escapeHtml(item.name)} × ${Number(item.qty || 0)}</span>
      <strong>${money(item.total)}</strong>
    </div>
  `).join('');

  const timeline = STATUS_STEPS.map(([key, label], index) => `
    <div style="display:grid;grid-template-columns:22px 1fr;gap:12px;padding:10px 0;opacity:${index <= step ? 1 : .42}">
      <span style="display:grid;place-items:center;width:22px;height:22px;border-radius:50%;background:${index <= step ? '#173b2d' : '#dfe5dc'};color:white;font-size:.72rem">${index < step ? '✓' : index + 1}</span>
      <div><strong>${label}</strong>${index === step ? '<br><small style="color:#657169">Status semasa</small>' : ''}</div>
    </div>
  `).join('');

  const fulfilment = order.fulfilment === 'lalamove'
    ? `Lalamove${order.delivery?.shareLink ? `, <a class="text-link" href="${escapeHtml(order.delivery.shareLink)}" target="_blank" rel="noopener">jejak rider</a>` : ''}`
    : order.fulfilment === 'banting' ? 'Pickup Taman Sri Putera, Banting' : 'Pickup Pasar Borong Seri Kembangan';

  $('#trackResult').hidden = false;
  $('#trackResult').innerHTML = `
    <div style="margin-top:28px;padding-top:24px;border-top:1px solid #dfe5dc">
      <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap">
        <div><small style="color:#657169">Nombor order</small><h2 style="margin:4px 0">${escapeHtml(order.id)}</h2></div>
        <span class="status">${escapeHtml(order.paymentStatus || 'pending')}</span>
      </div>
      <p><strong>Batch:</strong> ${escapeHtml(order.batchDate || '-')}<br><strong>Cara terima:</strong> ${fulfilment}</p>
      <div style="margin:24px 0">${timeline}</div>
      <div style="padding:18px;border-radius:16px;background:#eef2e9">${items}
        <div class="summary-row grand"><span>Jumlah</span><strong>${money(order.total)}</strong></div>
      </div>
      <a class="button primary full" style="margin-top:18px" target="_blank" rel="noopener" href="https://wa.me/${BUSINESS_PHONE}?text=${encodeURIComponent(`Salam Tempeten. Saya nak semak order ${order.id}.`)}">Tanya melalui WhatsApp</a>
    </div>`;
}

function renderMissing(id) {
  $('#trackResult').hidden = false;
  $('#trackResult').innerHTML = `
    <div style="margin-top:28px;padding:22px;border-radius:16px;background:#fff3e8;border:1px solid #f0d7bd">
      <strong>Order ${escapeHtml(id)} tidak ditemui</strong>
      <p>Pastikan nombor order betul. Order preview hanya tersimpan pada browser yang digunakan semasa checkout.</p>
      <a class="text-link" target="_blank" rel="noopener" href="https://wa.me/${BUSINESS_PHONE}?text=${encodeURIComponent(`Salam Tempeten. Saya perlukan bantuan semak order ${id}.`)}">Hubungi Tempeten →</a>
    </div>`;
}

async function findOrder(id) {
  const normalized = id.trim().toUpperCase();
  if (!normalized) return;
  $('#trackResult').hidden = false;
  $('#trackResult').innerHTML = '<p>Sedang menyemak order...</p>';

  if (API_URL) {
    try {
      const response = await fetch(`${API_URL}/api/orders/${encodeURIComponent(normalized)}`);
      if (response.ok) {
        renderOrder(await response.json());
        return;
      }
    } catch {
      // Fall back to the local preview order store.
    }
  }

  const order = localOrders().find((item) => String(item.id).toUpperCase() === normalized);
  order ? renderOrder(order) : renderMissing(normalized);
}

$('#trackForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const id = $('#orderId').value;
  history.replaceState(null, '', `?id=${encodeURIComponent(id)}`);
  findOrder(id);
});

const params = new URLSearchParams(location.search);
const initialId = params.get('id') || localStorage.getItem('tempeten_last_order');
if (initialId) {
  $('#orderId').value = initialId;
  findOrder(initialId);
}

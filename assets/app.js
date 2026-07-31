const PRODUCTS = {
  classic: { name: 'Classic Tempe Daun', price: 3 },
  fusion: { name: 'Fusion Tempe Daun', price: 6 },
  'bundle-a': { name: 'Bundle Best Seller A', price: 20 },
  'bundle-b': { name: 'Bundle Best Seller B', price: 20 }
};

const BUSINESS_PHONE = '601132099478';
const API_URL = window.TEMPETEN_API_URL || '';
let cart = JSON.parse(localStorage.getItem('tempeten_cart') || '{}');
let deliveryFee = 0;
let deliveryQuoteToken = '';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const money = (value) => new Intl.NumberFormat('ms-MY', {
  style: 'currency',
  currency: 'MYR'
}).format(value);
const persist = () => localStorage.setItem('tempeten_cart', JSON.stringify(cart));

function allowedBatches(count = 8) {
  const result = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let daysAhead = 4; result.length < count && daysAhead < 70; daysAhead += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + daysAhead);
    if ([1, 5, 6].includes(date.getDay())) result.push(date);
  }
  return result;
}

function dateLabel(date) {
  return new Intl.DateTimeFormat('ms-MY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function updateNextBatch() {
  $('#nextBatch').textContent = dateLabel(allowedBatches(1)[0]);
}

function qty(id) {
  return cart[id] || 0;
}

function subtotal() {
  return Object.entries(cart).reduce(
    (sum, [id, quantity]) => sum + (PRODUCTS[id]?.price || 0) * quantity,
    0
  );
}

function totalQty() {
  return Object.values(cart).reduce((sum, quantity) => sum + quantity, 0);
}

function setQty(id, value) {
  cart[id] = Math.max(0, value);
  if (!cart[id]) delete cart[id];
  persist();
  renderCart();
  renderProductQty();
}

function renderProductQty() {
  $$('.product-card[data-product]').forEach((card) => {
    const id = card.dataset.product;
    if (PRODUCTS[id]) card.querySelector('.qty').textContent = qty(id);
  });
}

function renderCart() {
  $('#cartCount').textContent = totalQty();
  $('#cartTotal').textContent = money(subtotal());
  const lines = Object.entries(cart).filter(([, quantity]) => quantity > 0);

  $('#cartEmpty').hidden = lines.length > 0;
  $('#cartItems').hidden = !lines.length;
  $('#checkoutBtn').disabled = !lines.length;
  $('#cartItems').innerHTML = lines.map(([id, quantity]) => `
    <div class="cart-line">
      <div>
        <strong>${PRODUCTS[id].name}</strong><br>
        <small>${money(PRODUCTS[id].price)} × ${quantity}</small>
      </div>
      <div>
        <strong>${money(PRODUCTS[id].price * quantity)}</strong>
        <div class="line-actions">
          <button data-cart-minus="${id}" aria-label="Kurangkan ${PRODUCTS[id].name}">−</button>
          <span>${quantity}</span>
          <button data-cart-plus="${id}" aria-label="Tambah ${PRODUCTS[id].name}">+</button>
        </div>
      </div>
    </div>
  `).join('');

  $$('[data-cart-minus]').forEach((button) => {
    button.onclick = () => setQty(button.dataset.cartMinus, qty(button.dataset.cartMinus) - 1);
  });
  $$('[data-cart-plus]').forEach((button) => {
    button.onclick = () => setQty(button.dataset.cartPlus, qty(button.dataset.cartPlus) + 1);
  });
}

function openCart() {
  $('#cartDrawer').classList.add('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'false');
  $('#overlay').hidden = false;
  document.body.classList.add('no-scroll');
}

function closeCart() {
  $('#cartDrawer').classList.remove('open');
  $('#cartDrawer').setAttribute('aria-hidden', 'true');
  $('#overlay').hidden = true;
  document.body.classList.remove('no-scroll');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function fillBatchOptions() {
  $('#batchSelect').innerHTML = allowedBatches().map((date) => (
    `<option value="${date.toISOString().slice(0, 10)}">${dateLabel(date)}</option>`
  )).join('');
}

function renderCheckout() {
  $('#checkoutSummary').innerHTML = Object.entries(cart).map(([id, quantity]) => `
    <div class="summary-item">
      <span>${PRODUCTS[id].name} × ${quantity}</span>
      <strong>${money(PRODUCTS[id].price * quantity)}</strong>
    </div>
  `).join('');
  $('#checkoutSubtotal').textContent = money(subtotal());
  $('#checkoutDelivery').textContent = money(deliveryFee);
  $('#checkoutGrand').textContent = money(subtotal() + deliveryFee);
}

function resetDeliveryQuote() {
  deliveryFee = 0;
  deliveryQuoteToken = '';
  if ($('#quoteResult')) $('#quoteResult').textContent = '';
}

function openCheckout() {
  closeCart();
  fillBatchOptions();
  resetDeliveryQuote();
  renderCheckout();
  $('#checkoutDialog').showModal();
}

function estimatedDelivery(address) {
  const normalized = address.toLowerCase();
  if (/putrajaya|cyberjaya/.test(normalized)) return 12;
  if (/bangi|kajang/.test(normalized)) return 24;
  if (/kuala lumpur|\bkl\b/.test(normalized)) return 24;
  return 18;
}

async function quoteDelivery() {
  const address = $('[name="address"]').value.trim();
  if (!address) {
    showToast('Masukkan alamat penghantaran dahulu');
    return;
  }

  $('#quoteResult').textContent = 'Sedang semak kadar...';
  deliveryQuoteToken = '';

  try {
    if (API_URL) {
      const response = await fetch(`${API_URL}/api/delivery/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address,
          batchDate: $('#batchSelect').value,
          pickupCode: 'seri-kembangan'
        })
      });
      if (!response.ok) throw new Error('Quote gagal');

      const data = await response.json();
      deliveryFee = Number(data.amount || 0);
      deliveryQuoteToken = data.quoteToken || '';
      $('#quoteResult').textContent = `Kadar Lalamove: ${money(deliveryFee)}. Quotation sah sehingga ${data.expiresAt || 'beberapa minit'}.`;
    } else {
      deliveryFee = estimatedDelivery(address);
      $('#quoteResult').textContent = `Anggaran preview: ${money(deliveryFee)}. Kadar live akan disahkan melalui Lalamove API.`;
    }
    renderCheckout();
  } catch (error) {
    resetDeliveryQuote();
    renderCheckout();
    $('#quoteResult').textContent = 'Kadar live belum tersedia. Tempeten akan sahkan kadar melalui WhatsApp.';
  }
}

function makeOrderId() {
  return `TMP-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function whatsappMessage(order) {
  const products = order.items.map((item) => (
    `• ${item.name} x${item.qty} = ${money(item.total)}`
  )).join('\n');

  return `Salam Tempeten. Saya baru buat pesanan melalui preview website.\n\nOrder: ${order.id}\nNama: ${order.customer.name}\nTelefon: ${order.customer.phone}\nBatch: ${order.batchDate}\nCara terima: ${order.fulfilment}\n${order.address ? `Alamat: ${order.address}\n` : ''}${products}\nDelivery: ${money(order.deliveryFee)}\nJumlah: ${money(order.total)}\n\nMohon semak dan sahkan pesanan ini. Terima kasih.`;
}

async function submitOrder(event) {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const fulfilment = formData.get('fulfilment');

  if (fulfilment === 'lalamove' && !formData.get('address')?.trim()) {
    showToast('Alamat diperlukan untuk Lalamove');
    return;
  }
  if (API_URL && fulfilment === 'lalamove' && !deliveryQuoteToken) {
    showToast('Semak kadar Lalamove dahulu');
    return;
  }

  const order = {
    id: makeOrderId(),
    createdAt: new Date().toISOString(),
    customer: {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email')
    },
    batchDate: formData.get('batchDate'),
    fulfilment,
    address: formData.get('address') || '',
    notes: formData.get('notes') || '',
    deliveryQuoteToken,
    items: Object.entries(cart).map(([id, quantity]) => ({
      id,
      name: PRODUCTS[id].name,
      qty: quantity,
      unitPrice: PRODUCTS[id].price,
      total: PRODUCTS[id].price * quantity
    })),
    subtotal: subtotal(),
    deliveryFee,
    total: subtotal() + deliveryFee,
    paymentStatus: 'pending',
    orderStatus: 'new'
  };

  $('#payBtn').disabled = true;
  $('#payBtn').textContent = 'Menyediakan pembayaran...';

  try {
    if (API_URL) {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(order)
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => ({}));
        throw new Error(problem.error || 'Order gagal');
      }
      const data = await response.json();
      localStorage.setItem('tempeten_last_order', data.orderId);
      location.href = data.paymentUrl;
      return;
    }

    const orders = JSON.parse(localStorage.getItem('tempeten_orders') || '[]');
    orders.unshift(order);
    localStorage.setItem('tempeten_orders', JSON.stringify(orders));
    localStorage.setItem('tempeten_last_order', order.id);
    cart = {};
    persist();
    renderCart();
    $('#checkoutDialog').close();
    window.open(`https://wa.me/${BUSINESS_PHONE}?text=${encodeURIComponent(whatsappMessage(order))}`, '_blank', 'noopener');
    location.href = `track.html?id=${encodeURIComponent(order.id)}`;
  } catch (error) {
    showToast(error.message || 'Checkout belum dapat disambungkan. Cuba WhatsApp Tempeten.');
    window.open(`https://wa.me/${BUSINESS_PHONE}?text=${encodeURIComponent(whatsappMessage(order))}`, '_blank', 'noopener');
  } finally {
    $('#payBtn').disabled = false;
    $('#payBtn').textContent = 'Bayar dengan Billplz';
  }
}

$$('.qty-plus').forEach((button) => {
  button.onclick = () => {
    const id = button.closest('[data-product]').dataset.product;
    setQty(id, qty(id) + 1);
    showToast(`${PRODUCTS[id].name} ditambah`);
  };
});

$$('.qty-minus').forEach((button) => {
  button.onclick = () => {
    const id = button.closest('[data-product]').dataset.product;
    setQty(id, qty(id) - 1);
  };
});

$('#openCart').onclick = openCart;
$('#ctaCart').onclick = openCart;
$('#closeCart').onclick = closeCart;
$('#overlay').onclick = closeCart;
$('#checkoutBtn').onclick = openCheckout;
$('#quoteDelivery').onclick = quoteDelivery;
$('#checkoutForm').addEventListener('submit', submitOrder);

$$('[name="fulfilment"]').forEach((radio) => {
  radio.onchange = () => {
    const delivery = radio.value === 'lalamove' && radio.checked;
    $('#addressFields').hidden = !delivery;
    if (!delivery) resetDeliveryQuote();
    renderCheckout();
  };
});

$('[name="address"]')?.addEventListener('input', () => {
  if (deliveryQuoteToken) {
    resetDeliveryQuote();
    renderCheckout();
    $('#quoteResult').textContent = 'Alamat berubah. Semak kadar Lalamove sekali lagi.';
  }
});

$('#batchSelect')?.addEventListener('change', () => {
  if (deliveryQuoteToken) {
    resetDeliveryQuote();
    renderCheckout();
    $('#quoteResult').textContent = 'Tarikh batch berubah. Semak kadar Lalamove sekali lagi.';
  }
});

updateNextBatch();
renderProductQty();
renderCart();

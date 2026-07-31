const PRODUCTS = {
  classic: { name: 'Classic Tempe Daun', priceSen: 300 },
  fusion: { name: 'Fusion Tempe Daun', priceSen: 600 },
  'bundle-a': { name: 'Bundle Best Seller A', priceSen: 2000 },
  'bundle-b': { name: 'Bundle Best Seller B', priceSen: 2000 }
};

const encoder = new TextEncoder();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    try {
      if (request.method === 'GET' && url.pathname === '/health') {
        return json({ ok: true, service: 'tempeten-api' }, 200, cors);
      }

      if (request.method === 'POST' && url.pathname === '/api/delivery/quote') {
        return await quoteDelivery(request, env, cors);
      }

      if (request.method === 'POST' && url.pathname === '/api/orders') {
        return await createOrder(request, env, cors);
      }

      if (request.method === 'POST' && url.pathname === '/api/webhooks/billplz') {
        return await billplzWebhook(request, env);
      }

      if (request.method === 'POST' && url.pathname === '/api/webhooks/lalamove') {
        return await lalamoveWebhook(request, env);
      }

      const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
      if (request.method === 'GET' && orderMatch) {
        return await getOrder(decodeURIComponent(orderMatch[1]), env, cors);
      }

      const bookingMatch = url.pathname.match(/^\/api\/admin\/orders\/([^/]+)\/book-delivery$/);
      if (request.method === 'POST' && bookingMatch) {
        requireAdmin(request, env);
        return await bookDelivery(decodeURIComponent(bookingMatch[1]), request, env, cors);
      }

      return json({ error: 'Not found' }, 404, cors);
    } catch (error) {
      console.error(error);
      const status = Number(error.status || 500);
      return json({ error: status === 500 ? 'Unexpected server error' : error.message }, status, cors);
    }
  }
};

async function quoteDelivery(request, env, cors) {
  const input = await request.json();
  if (!input.address || String(input.address).trim().length < 8) throw httpError(400, 'A complete delivery address is required');

  const pickupCode = input.pickupCode || 'seri-kembangan';
  const pickup = pickupFromEnv(pickupCode, env);
  const dropoff = input.coordinates?.lat && input.coordinates?.lng
    ? { address: String(input.address), lat: String(input.coordinates.lat), lng: String(input.coordinates.lng) }
    : await geocodeAddress(String(input.address), env);

  const quotation = await createLalamoveQuotation({
    pickup,
    dropoff,
    scheduleAt: input.scheduleAt || null
  }, env);

  const amountSen = Math.round(Number(quotation.priceBreakdown.total) * 100);
  const token = crypto.randomUUID();
  await env.DB.prepare(`
    INSERT INTO delivery_quotes
      (token, quotation_id, pickup_code, pickup_address, pickup_lat, pickup_lng,
       dropoff_address, dropoff_lat, dropoff_lng, amount_sen, currency, expires_at, raw_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).bind(
    token,
    quotation.quotationId,
    pickupCode,
    pickup.address,
    pickup.lat,
    pickup.lng,
    dropoff.address,
    dropoff.lat,
    dropoff.lng,
    amountSen,
    quotation.priceBreakdown.currency || 'MYR',
    quotation.expiresAt,
    JSON.stringify(quotation)
  ).run();

  return json({
    quoteToken: token,
    quotationId: quotation.quotationId,
    amount: amountSen / 100,
    currency: quotation.priceBreakdown.currency || 'MYR',
    expiresAt: quotation.expiresAt,
    pickupCode
  }, 200, cors);
}

async function createOrder(request, env, cors) {
  const input = await request.json();
  validateCustomer(input.customer);
  validateBatchDate(input.batchDate);

  const priced = priceItems(input.items);
  const fulfilment = String(input.fulfilment || 'seri-kembangan');
  let deliveryFeeSen = 0;
  let quote = null;

  if (fulfilment === 'lalamove') {
    if (!input.deliveryQuoteToken) throw httpError(400, 'A valid delivery quotation is required');
    quote = await env.DB.prepare('SELECT * FROM delivery_quotes WHERE token = ?').bind(input.deliveryQuoteToken).first();
    if (!quote) throw httpError(400, 'Delivery quotation was not found');
    deliveryFeeSen = Number(quote.amount_sen);
  }

  const orderId = makeOrderId();
  const totalSen = priced.subtotalSen + deliveryFeeSen;
  const raw = {
    address: input.address || quote?.dropoff_address || '',
    notes: input.notes || '',
    pickupCode: quote?.pickup_code || fulfilment,
    deliveryQuoteToken: input.deliveryQuoteToken || null
  };

  const statements = [
    env.DB.prepare(`
      INSERT INTO orders
        (id, created_at, customer_name, customer_phone, customer_email, batch_date,
         fulfilment, pickup_code, address, dropoff_lat, dropoff_lng, notes,
         subtotal_sen, delivery_fee_sen, total_sen, payment_status, order_status,
         lalamove_quotation_id, raw_json)
      VALUES (?, datetime('now'), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'new', ?, ?)
    `).bind(
      orderId,
      String(input.customer.name).trim(),
      normalizePhone(input.customer.phone),
      String(input.customer.email || '').trim(),
      input.batchDate,
      fulfilment,
      quote?.pickup_code || fulfilment,
      raw.address,
      quote?.dropoff_lat || null,
      quote?.dropoff_lng || null,
      raw.notes,
      priced.subtotalSen,
      deliveryFeeSen,
      totalSen,
      quote?.quotation_id || null,
      JSON.stringify(raw)
    )
  ];

  priced.items.forEach((item) => {
    statements.push(env.DB.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_sen, line_total_sen)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(orderId, item.id, item.name, item.qty, item.unitPriceSen, item.totalSen));
  });

  await env.DB.batch(statements);

  try {
    const bill = await createBillplzBill({
      orderId,
      amountSen: totalSen,
      customer: input.customer,
      description: `Tempeten ${orderId}`
    }, env);

    await env.DB.prepare(`
      UPDATE orders SET billplz_bill_id = ?, billplz_url = ? WHERE id = ?
    `).bind(bill.id, bill.url, orderId).run();

    return json({ orderId, paymentUrl: bill.url }, 201, cors);
  } catch (error) {
    await env.DB.prepare(`UPDATE orders SET payment_status = 'payment_setup_failed' WHERE id = ?`).bind(orderId).run();
    throw error;
  }
}

async function getOrder(orderId, env, cors) {
  const order = await env.DB.prepare(`
    SELECT id, created_at, customer_name, batch_date, fulfilment, pickup_code, address,
           subtotal_sen, delivery_fee_sen, total_sen, payment_status, order_status,
           lalamove_order_id, lalamove_share_link, delivery_status
    FROM orders WHERE id = ?
  `).bind(orderId).first();
  if (!order) throw httpError(404, 'Order not found');

  const itemsResult = await env.DB.prepare(`
    SELECT product_id AS id, product_name AS name, quantity AS qty,
           unit_price_sen, line_total_sen
    FROM order_items WHERE order_id = ? ORDER BY id
  `).bind(orderId).all();

  return json({
    id: order.id,
    createdAt: order.created_at,
    customer: { name: order.customer_name },
    batchDate: order.batch_date,
    fulfilment: order.fulfilment,
    pickupCode: order.pickup_code,
    address: order.address,
    subtotal: order.subtotal_sen / 100,
    deliveryFee: order.delivery_fee_sen / 100,
    total: order.total_sen / 100,
    paymentStatus: order.payment_status,
    orderStatus: order.order_status,
    deliveryStatus: order.delivery_status,
    delivery: order.lalamove_order_id ? {
      orderId: order.lalamove_order_id,
      shareLink: order.lalamove_share_link
    } : null,
    items: (itemsResult.results || []).map((item) => ({
      id: item.id,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unit_price_sen / 100,
      total: item.line_total_sen / 100
    }))
  }, 200, cors);
}

async function billplzWebhook(request, env) {
  const form = await request.formData();
  const parameters = Object.fromEntries(form.entries());
  const received = String(parameters.x_signature || '');
  delete parameters.x_signature;

  const source = Object.entries(parameters)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([key, value]) => `${key}${value ?? ''}`)
    .join('|');

  const expected = await hmacHex(env.BILLPLZ_X_SIGNATURE, source);
  if (!safeEqual(received, expected)) return new Response('Invalid signature', { status: 401 });

  const paymentStatus = String(parameters.paid) === 'true' && parameters.state === 'paid' ? 'paid' : 'due';
  const order = await env.DB.prepare('SELECT id FROM orders WHERE billplz_bill_id = ?').bind(parameters.id).first();
  if (!order) return new Response('OK', { status: 200 });

  await env.DB.prepare(`
    UPDATE orders
    SET payment_status = ?, paid_at = CASE WHEN ? = 'paid' THEN datetime('now') ELSE paid_at END,
        order_status = CASE WHEN ? = 'paid' AND order_status = 'new' THEN 'paid' ELSE order_status END,
        payment_payload = ?
    WHERE id = ?
  `).bind(paymentStatus, paymentStatus, paymentStatus, JSON.stringify(parameters), order.id).run();

  return new Response('OK', { status: 200 });
}

async function bookDelivery(orderId, request, env, cors) {
  const input = await request.json().catch(() => ({}));
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first();
  if (!order) throw httpError(404, 'Order not found');
  if (order.fulfilment !== 'lalamove') throw httpError(400, 'This order is not a Lalamove delivery');
  if (order.payment_status !== 'paid') throw httpError(409, 'Payment has not been confirmed');
  if (order.lalamove_order_id) throw httpError(409, 'Delivery has already been booked');

  const pickup = pickupFromEnv(order.pickup_code || 'seri-kembangan', env);
  const dropoff = { address: order.address, lat: order.dropoff_lat, lng: order.dropoff_lng };
  if (!dropoff.lat || !dropoff.lng) throw httpError(400, 'Delivery coordinates are missing');

  const quotation = await createLalamoveQuotation({ pickup, dropoff, scheduleAt: input.scheduleAt || null }, env);
  const actualFeeSen = Math.round(Number(quotation.priceBreakdown.total) * 100);
  const variance = actualFeeSen - Number(order.delivery_fee_sen || 0);
  const allowedVariance = Number(env.MAX_DELIVERY_VARIANCE_SEN || 300);

  if (variance > allowedVariance && !input.acceptPriceDifference) {
    return json({
      requiresApproval: true,
      collectedDeliveryFee: Number(order.delivery_fee_sen || 0) / 100,
      currentDeliveryFee: actualFeeSen / 100,
      difference: variance / 100,
      quotationId: quotation.quotationId,
      expiresAt: quotation.expiresAt
    }, 409, cors);
  }

  const lalamoveOrder = await placeLalamoveOrder({
    quotation,
    sender: {
      name: env.SENDER_NAME || 'Tempeten',
      phone: normalizePhone(env.SENDER_PHONE || '')
    },
    recipient: {
      name: order.customer_name,
      phone: normalizePhone(order.customer_phone),
      remarks: order.notes || ''
    },
    metadata: { tempetenOrderId: order.id }
  }, env);

  await env.DB.prepare(`
    UPDATE orders
    SET lalamove_quotation_id = ?, lalamove_order_id = ?, lalamove_share_link = ?,
        delivery_status = ?, order_status = 'ready', delivery_actual_fee_sen = ?
    WHERE id = ?
  `).bind(
    quotation.quotationId,
    lalamoveOrder.orderId,
    lalamoveOrder.shareLink || '',
    lalamoveOrder.status || 'ASSIGNING_DRIVER',
    actualFeeSen,
    order.id
  ).run();

  return json({
    orderId: order.id,
    deliveryOrderId: lalamoveOrder.orderId,
    shareLink: lalamoveOrder.shareLink,
    status: lalamoveOrder.status,
    actualDeliveryFee: actualFeeSen / 100
  }, 201, cors);
}

async function lalamoveWebhook(request, env) {
  const url = new URL(request.url);
  const providedToken = request.headers.get('x-tempeten-webhook-token') || url.searchParams.get('token');
  if (!env.LALAMOVE_WEBHOOK_TOKEN || !safeEqual(providedToken || '', env.LALAMOVE_WEBHOOK_TOKEN)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const payload = await request.json();
  const data = payload.data || payload;
  const lalamoveOrderId = data.orderId || data.order?.orderId;
  if (!lalamoveOrderId) return new Response('OK', { status: 200 });

  const status = data.status || data.order?.status || data.type || 'UPDATED';
  const driverId = data.driverId || data.driver?.driverId || null;
  await env.DB.prepare(`
    UPDATE orders SET delivery_status = ?, lalamove_driver_id = COALESCE(?, lalamove_driver_id),
      delivery_payload = ? WHERE lalamove_order_id = ?
  `).bind(status, driverId, JSON.stringify(payload), lalamoveOrderId).run();

  return new Response('OK', { status: 200 });
}

async function createBillplzBill({ orderId, amountSen, customer, description }, env) {
  requireEnv(env, ['BILLPLZ_SECRET_KEY', 'BILLPLZ_COLLECTION_ID', 'BILLPLZ_X_SIGNATURE', 'PUBLIC_API_URL', 'PUBLIC_SITE_URL']);
  const base = String(env.BILLPLZ_BASE_URL || 'https://www.billplz-sandbox.com').replace(/\/$/, '');
  const body = new URLSearchParams({
    collection_id: env.BILLPLZ_COLLECTION_ID,
    email: String(customer.email || 'orders@tempeten.local'),
    mobile: normalizePhone(customer.phone),
    name: String(customer.name).trim(),
    amount: String(amountSen),
    description,
    callback_url: `${String(env.PUBLIC_API_URL).replace(/\/$/, '')}/api/webhooks/billplz`,
    redirect_url: `${String(env.PUBLIC_SITE_URL).replace(/\/$/, '')}/track.html?id=${encodeURIComponent(orderId)}`,
    reference_1_label: 'Order ID',
    reference_1: orderId
  });

  const response = await fetch(`${base}/api/v3/bills`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.BILLPLZ_SECRET_KEY}:`)}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const result = await response.json();
  if (!response.ok) throw httpError(502, `Billplz error: ${result.error?.message || result.error || response.status}`);
  return result;
}

async function geocodeAddress(address, env) {
  if (!env.GOOGLE_MAPS_API_KEY) throw httpError(503, 'Address geocoding is not configured');
  const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  endpoint.searchParams.set('address', address);
  endpoint.searchParams.set('region', 'my');
  endpoint.searchParams.set('key', env.GOOGLE_MAPS_API_KEY);
  const response = await fetch(endpoint);
  const result = await response.json();
  const match = result.results?.[0];
  if (!response.ok || !match) throw httpError(422, 'The delivery address could not be located');
  return {
    address: match.formatted_address || address,
    lat: String(match.geometry.location.lat),
    lng: String(match.geometry.location.lng)
  };
}

async function createLalamoveQuotation({ pickup, dropoff, scheduleAt }, env) {
  requireEnv(env, ['LALAMOVE_API_KEY', 'LALAMOVE_API_SECRET']);
  const data = {
    serviceType: env.LALAMOVE_SERVICE_TYPE || 'MOTORCYCLE',
    language: env.LALAMOVE_LANGUAGE || 'en_MY',
    stops: [
      { coordinates: { lat: String(pickup.lat), lng: String(pickup.lng) }, address: pickup.address },
      { coordinates: { lat: String(dropoff.lat), lng: String(dropoff.lng) }, address: dropoff.address }
    ]
  };
  if (scheduleAt) data.scheduleAt = scheduleAt;
  return await lalamoveRequest('POST', '/v3/quotations', { data }, env);
}

async function placeLalamoveOrder({ quotation, sender, recipient, metadata }, env) {
  const stops = quotation.stops;
  const payload = {
    data: {
      quotationId: quotation.quotationId,
      sender: { stopId: stops[0].stopId, name: sender.name, phone: sender.phone },
      recipients: [{
        stopId: stops[1].stopId,
        name: recipient.name,
        phone: recipient.phone,
        remarks: recipient.remarks || ''
      }],
      isPODEnabled: true,
      metadata
    }
  };
  return await lalamoveRequest('POST', '/v3/orders', payload, env);
}

async function lalamoveRequest(method, path, payload, env) {
  const timestamp = Date.now().toString();
  const body = payload ? JSON.stringify(payload) : '';
  const signature = await hmacHex(env.LALAMOVE_API_SECRET, `${timestamp}\r\n${method}\r\n${path}\r\n\r\n${body}`);
  const base = String(env.LALAMOVE_BASE_URL || 'https://rest.sandbox.lalamove.com').replace(/\/$/, '');
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `hmac ${env.LALAMOVE_API_KEY}:${timestamp}:${signature}`,
      Market: env.LALAMOVE_MARKET || 'MY',
      'Request-ID': crypto.randomUUID(),
      'content-type': 'application/json'
    },
    body: body || undefined
  });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw httpError(502, `Lalamove error: ${result.message || result.errors?.[0]?.message || response.status}`);
  return result.data || result;
}

function priceItems(items) {
  if (!Array.isArray(items) || !items.length) throw httpError(400, 'At least one product is required');
  const priced = items.map((item) => {
    const product = PRODUCTS[item.id];
    const qty = Number(item.qty);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > 50) throw httpError(400, 'Invalid product or quantity');
    return { id: item.id, name: product.name, qty, unitPriceSen: product.priceSen, totalSen: product.priceSen * qty };
  });
  return { items: priced, subtotalSen: priced.reduce((sum, item) => sum + item.totalSen, 0) };
}

function validateCustomer(customer) {
  if (!customer?.name || String(customer.name).trim().length < 2) throw httpError(400, 'Customer name is required');
  if (!customer?.phone || normalizePhone(customer.phone).length < 10) throw httpError(400, 'A valid phone number is required');
}

function validateBatchDate(value) {
  const date = new Date(`${value}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime())) throw httpError(400, 'A valid batch date is required');
  const minimum = new Date();
  minimum.setHours(0, 0, 0, 0);
  minimum.setDate(minimum.getDate() + 4);
  if (date < minimum) throw httpError(400, 'Orders require at least four days notice');
  if (![1, 5, 6].includes(date.getDay())) throw httpError(400, 'Batch date must be Monday, Friday or Saturday');
}

function pickupFromEnv(code, env) {
  const prefix = code === 'banting' ? 'PICKUP_BANTING' : 'PICKUP_SERI_KEMBANGAN';
  const pickup = {
    address: env[`${prefix}_ADDRESS`],
    lat: env[`${prefix}_LAT`],
    lng: env[`${prefix}_LNG`]
  };
  if (!pickup.address || !pickup.lat || !pickup.lng) throw httpError(503, `Pickup location ${code} is not configured`);
  return pickup;
}

function makeOrderId() {
  const date = new Date().toISOString().slice(2, 10).replaceAll('-', '');
  return `TMP-${date}-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('60')) return `+${digits}`;
  if (digits.startsWith('0')) return `+6${digits}`;
  return digits ? `+${digits}` : '';
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return result === 0;
}

function requireAdmin(request, env) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!env.ADMIN_TOKEN || !safeEqual(token, env.ADMIN_TOKEN)) throw httpError(401, 'Unauthorized');
}

function requireEnv(env, keys) {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) throw httpError(503, `Missing configuration: ${missing.join(', ')}`);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || env.PUBLIC_SITE_URL || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  const selected = allowed.includes(origin) ? origin : allowed[0] || '*';
  return {
    'access-control-allow-origin': selected,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,x-tempeten-webhook-token',
    vary: 'Origin'
  };
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

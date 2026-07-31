import app from './index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method !== 'POST' || url.pathname !== '/api/orders') {
      return app.fetch(request, env, ctx);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400, request, env);
    }

    const originalBatchDate = String(input.batchDate || '');
    const validationError = validateMalaysiaBatchDate(originalBatchDate);
    if (validationError) return jsonError(validationError, 400, request, env);

    // index.js originally interpreted +08 midnight using the runtime's UTC day.
    // Shift only for its internal legacy validator, then restore the real date in D1.
    input.batchDate = addCalendarDays(originalBatchDate, 1);
    const patchedRequest = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: JSON.stringify(input),
      redirect: request.redirect
    });

    const response = await app.fetch(patchedRequest, env, ctx);
    if (!response.ok) return response;

    const body = await response.text();
    let result;
    try {
      result = JSON.parse(body);
    } catch {
      return new Response(body, { status: response.status, headers: response.headers });
    }

    if (result.orderId) {
      await env.DB.prepare('UPDATE orders SET batch_date = ? WHERE id = ?')
        .bind(originalBatchDate, result.orderId)
        .run();
    }

    return new Response(body, { status: response.status, headers: response.headers });
  }
};

function validateMalaysiaBatchDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'A valid batch date is required';

  const selected = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(selected.getTime())) return 'A valid batch date is required';

  const nowMalaysia = new Date(Date.now() + (8 * 60 * 60 * 1000));
  const minimum = new Date(Date.UTC(
    nowMalaysia.getUTCFullYear(),
    nowMalaysia.getUTCMonth(),
    nowMalaysia.getUTCDate() + 4,
    12
  ));

  if (selected < minimum) return 'Orders require at least four days notice';
  if (![1, 5, 6].includes(selected.getUTCDay())) {
    return 'Batch date must be Monday, Friday or Saturday';
  }
  return '';
}

function addCalendarDays(value, days) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function jsonError(message, status, request, env) {
  const origin = request.headers.get('origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || env.PUBLIC_SITE_URL || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const selected = allowed.includes(origin) ? origin : allowed[0] || '*';

  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': selected,
      vary: 'Origin'
    }
  });
}

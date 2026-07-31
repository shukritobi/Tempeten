# Tempeten Business System

## What this solves

The current ordering journey is split between Threads, Linktree, Tally, WhatsApp, manual Lalamove checks and manual payment confirmation. The proposed system turns that into one order flow:

1. Customer sees products, live batch dates and remaining capacity.
2. Customer chooses pickup or enters a delivery address.
3. Backend obtains a Lalamove quotation.
4. Backend creates a Billplz bill and redirects the customer.
5. Billplz callback marks payment as paid.
6. Admin sees the paid order inside the correct production batch.
7. When the batch is ready, the admin books Lalamove or marks the pickup ready.
8. Customer tracks the order using the order number.

## Recommended production architecture

- Storefront: GitHub Pages for the preview, then Cloudflare Pages for production.
- API: Cloudflare Worker.
- Database: Cloudflare D1 for orders, batches and audit events.
- Payment: Billplz V3 Bills with X Signature callback verification.
- Delivery: Lalamove V3 quotations, orders and webhooks.
- Notifications: WhatsApp Cloud API templates for paid, ready and rider-assigned events.
- Files: Cloudflare R2 for receipts, labels or future product photos.
- Analytics: Cloudflare Web Analytics plus server-side conversion events.

## Core tables for phase 2

- products
- product_variants
- batches
- batch_inventory
- orders
- order_items
- payments
- deliveries
- customers
- notification_log
- admin_users

The preview keeps orders in browser localStorage. The Worker sample includes the first production `orders` table and secure integration endpoints.

## Billplz workflow

- Secret key stays in Worker secrets, never in frontend code.
- Create one active collection for normal retail orders.
- Create a separate collection for event goodies or wholesale if reporting needs differ.
- Amount is sent in sen.
- Use both callback and redirect.
- Treat callback as source of truth.
- Verify `x_signature` before updating an order.
- Make callback handling idempotent so retries do not duplicate fulfilment.

## Lalamove workflow

- Obtain a quotation only after the customer supplies a complete address.
- Save `quotationId`, price and expiry.
- Re-quote if the customer waits too long before payment.
- Book the rider after payment and only when the production batch is ready.
- Subscribe to webhooks and map delivery events to the customer tracker.
- Keep manual pickup as a zero-cost fulfilment option.

## Batch and inventory rules

- Allowed production days: Monday, Friday and Saturday.
- Pre-order cutoff: 4 calendar days before the chosen batch.
- Every product consumes capacity units.
- Fusion and goodies can use separate capacity pools.
- Admin can close a batch early if leaf supply or production capacity is limited.
- Unpaid orders expire after a configurable time and release reserved capacity.

## Suggested rollout

### Phase 1, preview

Storefront, cart, batch date logic, order tracker, WhatsApp fallback and admin demo.

### Phase 2, live ordering

Deploy Worker and D1, add Billplz sandbox, then Lalamove sandbox. Test callbacks and duplicate events.

### Phase 3, operations

Live inventory, label printing, batch worksheets, automated WhatsApp updates, CSV accounting export and repeat-customer shortcuts.

### Phase 4, growth

Mini-goodies quotation workflow, wholesale pricing, reseller accounts, referral codes, subscriptions for weekly tempe and location-based landing pages for Banting and Seri Kembangan.

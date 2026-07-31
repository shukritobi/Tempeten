# Tempeten API Worker

This Worker turns the static storefront into a live ordering system with:

- server-side product pricing
- Cloudflare D1 order storage
- Billplz bill creation and signed payment callbacks
- Lalamove quotation, booking and delivery status storage
- public order tracking
- protected admin delivery booking

## 1. Create the D1 database

From the `worker` directory:

```bash
npx wrangler@latest d1 create tempeten-orders --location=apac
```

Copy `wrangler.toml.example` to `wrangler.toml`, then insert the returned database ID.

Apply the schema:

```bash
npx wrangler@latest d1 execute tempeten-orders --remote --file=./schema.sql
```

## 2. Add encrypted secrets

```bash
npx wrangler secret put BILLPLZ_SECRET_KEY
npx wrangler secret put BILLPLZ_COLLECTION_ID
npx wrangler secret put BILLPLZ_X_SIGNATURE
npx wrangler secret put LALAMOVE_API_KEY
npx wrangler secret put LALAMOVE_API_SECRET
npx wrangler secret put LALAMOVE_WEBHOOK_TOKEN
npx wrangler secret put GOOGLE_MAPS_API_KEY
npx wrangler secret put ADMIN_TOKEN
```

Do not put any of these values in frontend JavaScript or GitHub.

## 3. Complete the normal variables

Update `wrangler.toml` with:

- exact public site and Worker URLs
- both pickup addresses and coordinates
- sender phone number
- correct Lalamove service type from the Malaysia city-info endpoint
- sandbox endpoints during testing

## 4. Deploy

```bash
npx wrangler@latest deploy
```

Then add the Worker URL to the storefront before `assets/app.js`:

```html
<script>
  window.TEMPETEN_API_URL = 'https://tempeten-api.YOUR-SUBDOMAIN.workers.dev';
</script>
```

## 5. Configure providers

### Billplz

- Create a sandbox account and a collection.
- Add the deployed callback URL: `/api/webhooks/billplz`.
- Keep X Signature enabled.
- Run successful, failed and repeated-callback tests.
- Move to a separate production Billplz account and endpoint only after sandbox sign-off.

### Lalamove

- Obtain sandbox API credentials in the Partner Portal.
- Configure the webhook URL as `/api/webhooks/lalamove?token=YOUR_SECRET_TOKEN`.
- Test quotations, insufficient wallet balance, expired quotations, driver assignment and completed delivery.
- Top up the production wallet before requesting production credentials.

## Important delivery design

Lalamove quotations are short-lived. Tempeten accepts pre-orders several days ahead, so the system uses two stages:

1. Quote during checkout to show and collect a delivery amount.
2. Re-quote when the tempe batch is ready, immediately before booking the rider.

If the new price is more than the configured variance, the admin endpoint returns `requiresApproval` instead of silently spending more. For more predictable margins, Tempeten can later use fixed delivery zones or batch several nearby customers into a multi-stop route.

## Admin booking request

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"acceptPriceDifference":false}' \
  https://YOUR-WORKER/api/admin/orders/TMP-ORDER-ID/book-delivery
```

## Production checks

- Confirm prices, weights and bundle composition.
- Confirm exact pickup locations and operating hours.
- Confirm privacy notice and refund/cancellation terms.
- Verify callback idempotency using repeated test events.
- Confirm the delivery fee policy when the re-quoted amount changes.
- Keep the WhatsApp fallback active until the first live orders are completed successfully.

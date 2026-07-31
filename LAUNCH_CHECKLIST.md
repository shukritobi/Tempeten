# Tempeten Launch Checklist

## What has been built

### Customer storefront

- mobile-first brand landing page
- Classic, Fusion, two RM20 bundles and Mini Goodies enquiry
- cart with quantity controls
- automatic Monday, Friday and Saturday batch dates
- four-day pre-order cutoff
- pickup at Seri Kembangan or Banting
- Lalamove address and quotation flow
- Billplz checkout hand-off
- WhatsApp fallback when live integrations are not configured
- customer order tracker

### Owner operations

- order dashboard prototype
- paid/pending filters
- production status progression
- batch planner grouped by production date
- CSV export for accounting and production lists
- protected backend endpoint to book Lalamove after payment and production
- delivery status and share-link storage

## Business details to confirm with Tempeten

1. Official brand spelling and social handles.
2. Correct WhatsApp number, currently set as `011-320 99478`.
3. Classic price, currently set as RM3.
4. Fusion price, currently set as RM6.
5. Bundle composition and RM20 selling price.
6. Product weight for Classic and Fusion.
7. Fusion ingredients and whether choices change by batch.
8. Mini Goodies minimum quantity, packaging options and lead time.
9. Exact pickup addresses and map coordinates.
10. Whether delivery orders leave from Seri Kembangan, Banting or the nearest available stock point.
11. Maximum units per batch and separate capacity for Fusion.
12. Cancellation, refund and no-show pickup policy.
13. Whether prices include SST or any other charge.
14. SSM name and bank account holder for Billplz onboarding.

## Recommended owner workflow

### Before opening a batch

- Set available production date.
- Set maximum Classic, Fusion and Goodies quantities.
- Confirm leaf availability.
- Open the batch for orders.

### During ordering

- Customer chooses products and date.
- System reserves capacity.
- Customer selects pickup or delivery.
- Billplz receives payment.
- Signed callback marks the order paid.
- Unpaid reservations expire and capacity is released.

### Production day

- Dashboard groups all paid orders by batch.
- Owner prints or exports production quantities.
- Owner marks orders as preparing, then ready.
- Pickup customers receive a ready message.
- Delivery orders are re-quoted and booked through Lalamove.

### After fulfilment

- Delivery webhook updates rider status.
- Order is marked completed.
- Customer can receive a repeat-order link for the next batch.

## Recommended next features

### Highest priority

- real batch capacity controls
- automatic WhatsApp payment and pickup notifications
- printable packing labels with customer name and order number
- abandoned-payment expiry
- refund/cancellation log

### Growth

- weekly tempe subscription
- reseller/agent pricing
- wholesale order form
- event Goodies quotation workflow
- referral codes
- customer reorder button
- delivery-zone pricing
- multi-stop delivery runs for customers in the same area

## Accounts and credentials required

### Billplz

- verified business account
- collection ID
- API secret key
- X Signature key
- settlement bank account

### Lalamove

- Partner Portal account
- sandbox API key and secret
- production wallet balance
- production API key and secret
- configured webhook URL

### Cloudflare

- Worker deployment
- D1 database
- optional R2 storage for labels and receipts
- custom domain when ready

### Google Maps

- Geocoding API key, restricted to the Worker and required only if customers enter free-text addresses without map coordinates

## Launch sequence

1. Owner confirms all business details and product pricing.
2. Upload final original product photos and replace temporary public image links.
3. Enable GitHub Pages for the preview.
4. Create Billplz sandbox and Lalamove sandbox credentials.
5. Deploy Cloudflare Worker and D1.
6. Test payment success, payment failure and duplicate callbacks.
7. Test Lalamove quotation, expired quote and delivery booking.
8. Run one internal order from phone to completed status.
9. Run five controlled customer orders.
10. Switch provider endpoints and credentials to production.

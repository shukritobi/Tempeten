# Tempeten Storefront and Order System

A mobile-first storefront and business operations prototype for Tempeten, a homemade tempe daun business serving Banting and Seri Kembangan.

## Preview

Expected GitHub Pages URL:

`https://shukritobi.github.io/Tempeten/`

GitHub Pages must use **GitHub Actions** as its publishing source. The deployment workflow is already included in `.github/workflows/pages.yml`.

## Main pages

- `index.html`: storefront, products, cart, batch selection and checkout
- `track.html`: customer order tracker
- `admin.html`: operations dashboard demo
- `SYSTEM.md`: architecture, workflow and rollout plan
- `LAUNCH_CHECKLIST.md`: owner onboarding and production checklist
- `WHATSAPP_MESSAGE.md`: personalised outreach message
- `worker/`: Cloudflare Worker API for Billplz, Lalamove and D1

## What works in preview mode

- product catalogue and RM20 bundles
- automatic Monday, Friday and Saturday production dates
- four-day pre-order cutoff
- pickup and delivery choices
- estimated delivery pricing
- cart and order summary
- WhatsApp order fallback
- local order tracking
- owner dashboard, status changes, batch grouping and CSV export

Preview orders are stored in the browser using `localStorage`. This is intentional so the site can be reviewed before live credentials are available.

## Local preview

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Live integration setup

1. Create a Cloudflare D1 database and run `worker/schema.sql`.
2. Copy `worker/wrangler.toml.example` to `worker/wrangler.toml`.
3. Add all secrets listed in `worker/README.md`.
4. Deploy the Worker.
5. Set `window.TEMPETEN_API_URL` before loading `assets/app.js`.
6. Test Billplz and Lalamove in sandbox.
7. Replace sandbox endpoints and credentials only after full sign-off.

## Security

- Billplz and Lalamove secrets stay in Cloudflare Worker secrets.
- Product totals are recalculated by the server.
- Billplz payment callbacks are verified using X Signature.
- Lalamove calls are signed server-side.
- Delivery booking requires an admin bearer token.
- No provider secret is stored in GitHub Pages.

## Current asset note

The supplied Tempeten logo, Classic tempe photo and Fusion tempe photo are embedded as optimised WebP data assets. The Tally cover remains the fallback for the hero, soybeans and Mini Goodies slots until the remaining final images are embedded or uploaded as normal image files.

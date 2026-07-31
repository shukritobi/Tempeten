# Tempeten Storefront and Order System

A mobile-first website and operational prototype for Tempeten, a homemade tempe daun business serving Banting and Seri Kembangan.

## Preview pages

- `index.html`: storefront, cart and checkout prototype
- `track.html`: customer order tracker
- `admin.html`: operations dashboard demo
- `SYSTEM.md`: production architecture and rollout plan
- `worker/`: Cloudflare Worker starter for Billplz, Lalamove and D1

## Local preview

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Live integration setup

1. Create a Cloudflare D1 database and run `worker/schema.sql`.
2. Copy `worker/wrangler.toml.example` to `worker/wrangler.toml`.
3. Add Worker secrets:
   - `BILLPLZ_SECRET_KEY`
   - `BILLPLZ_COLLECTION_ID`
   - `BILLPLZ_X_SIGNATURE`
   - `LALAMOVE_API_KEY`
   - `LALAMOVE_API_SECRET`
   - `API_PUBLIC_URL`
4. Deploy the Worker.
5. Set `window.TEMPETEN_API_URL` before `assets/app.js`, or add a small `config.js` file.
6. Test Billplz and Lalamove in sandbox before production.

## Important

The GitHub Pages preview intentionally keeps credentials out of the frontend. Without an API URL, checkout saves the order in localStorage and opens a WhatsApp confirmation message.

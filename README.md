# Bajwa Surgical — Full App

Bajwa Surgical store + admin panel + Node server (single repo).

## Run locally

```bash
npm install
npm start
```

- Store: http://127.0.0.1:3000
- Admin: http://127.0.0.1:3000/admin

## Environment variables

Copy `.env.example` to `.env` and fill values.

| Var | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `GEMINI_API_KEY` | Gemini API key (optional) |
| `PORT` | Server port (optional, default 3000) |

## Files

- `admin-server.js` — Node HTTP server (no dependencies)
- `admin/` — admin panel
- `index.html`, `styles.css`, `script.js` — public store
- `products.json` — product catalog (editable from admin)
- `analytics.json` — sales/visits data
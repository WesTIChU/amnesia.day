# Amnesia

Amnesia is a quiet one-year memory archive running on a Raspberry Pi. Memories are encrypted in the browser before they reach the server, then held until their anniversary.

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the required server secrets:
   `KEY_PEPPER=...`
3. Start the development server:
   `npm run dev`

## Production

The production server deliberately binds to `127.0.0.1` on port `3000` and
expects to be fronted by a reverse proxy or Cloudflare Tunnel.

**Deployments using only Cloudflare Tunnel must set:**

`TRUST_CLOUDFLARE_PROXY=true`

With this setting, rate limits are keyed on Cloudflare's validated
`CF-Connecting-IP` header instead of the socket address. Without it, every
visitor arriving through the tunnel is seen as `127.0.0.1` and shares a single
rate-limit identity. The application never trusts arbitrary
`X-Forwarded-For` headers.

Set `NODE_ENV=production` before running `npm run build && npm start`.

### Deployment

The build keeps the two artifacts strictly separate:

- `dist/` - public browser files only (`index.html`, `assets/`).
- `server-dist/` - the private Node server bundle (`server.cjs`), which is
  never served as static content and returns an explicit `404` if requested
  directly.

Example systemd unit:

```
[Service]
WorkingDirectory=/home/polza/amnesia
Environment=NODE_ENV=production
Environment=KEY_PEPPER=...
Environment=TRUST_CLOUDFLARE_PROXY=true
ExecStart=/usr/bin/node /home/polza/amnesia/server-dist/server.cjs
Restart=always
```

## Timekeeper

Run the local Timekeeper process from a systemd timer once per hour or at midnight:

`npm run timekeeper`

## Checks

`npm run lint`

`npm test`

`npm run build`

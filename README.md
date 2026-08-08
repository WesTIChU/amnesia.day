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

## Timekeeper

Run the local Timekeeper process from a systemd timer once per hour or at midnight:

`npm run timekeeper`

## Checks

`npm run lint`

`npm test`

`npm run build`

# QuietHub Server

Express + MongoDB backend for QuietHub room booking, now with full PipraPay payment lifecycle integration.

## Features

- REST endpoints for rooms and bookings
- JWT verification using remote JWKS
- Booking conflict detection (time overlap)
- Normalized date/time input handling
- Room lookup (join booking -> room)
- PipraPay create-charge, verify, callback, and webhook routes
- Payment-to-booking status sync (`pending` -> `confirmed` / `cancelled`)
- Verify fallback on `my-bookings` to auto-fix stale pending records

## Requirements

- Node.js (16+ recommended)
- MongoDB (connection string)

## Environment variables

Create a `.env` file with:

```env
PORT=8000
MONGO_URI=<your-mongo-connection-string>
CLIENT_URL=<auth-provider-base-url> # JWKS available at ${CLIENT_URL}/api/auth/jwks

# PipraPay core
PIPRAPAY_API_KEY=<your-piprapay-api-key>
PIPRAPAY_CHECKOUT_REDIRECT_URL=https://<PipraPay-Installed-domain>/api/checkout/redirect
PIPRAPAY_VERIFY_PAYMENT_URL=https://<PipraPay-Installed-domain>/api/verify-payment
PIPRAPAY_DEFAULT_CURRENCY=USD

# Callback + webhook (must be backend public URLs)
PIPRAPAY_CALLBACK_URL=https://<backend-domain>/payments/piprapay/callback
PIPRAPAY_WEBHOOK_URL=https://<backend-domain>/payments/piprapay/webhook

# Frontend return target
PIPRAPAY_REDIRECT_URL=https://<frontend-domain>/payment/success
PIPRAPAY_CANCEL_URL=https://<frontend-domain>/rooms
```

Important:

- `PIPRAPAY_WEBHOOK_URL` must point to backend, not frontend.
- Whitelist frontend/backend domains in PipraPay dashboard.
- Use HTTPS in production.

## Install

npm install

## Run

node index.js

# or with nodemon:

# npx nodemon index.js

# or

npm run start

## Important files

- index.js — main server, routes and DB logic
- package.json — dependencies
- piprapay.md — provider docs snapshot used during integration
- PIPRAPAY_INTEGRATION.md — project-specific integration guide
- PIPRAPAY_STEP_BY_STEP_IMPLEMENTATION.md — full step-by-step code guide
- UNIVERSAL_PAYMENT_GATEWAY_PLAYBOOK.md — reusable architecture playbook

## Payment Routes

- `POST /payments/piprapay/create-charge`
  - creates provider payment link
  - stores payment as pending
  - creates booking as pending from metadata
- `POST /payments/piprapay/verify`
  - verifies provider payment status
  - syncs payment + booking status
- `GET|POST /payments/piprapay/callback`
  - receives provider return
  - normalizes reference keys (`pp_id`, `invoice_id`, `transaction_ref`, `ppid`)
  - verifies and redirects to frontend success page
- `POST /payments/piprapay/webhook`
  - receives async provider updates
  - verifies auth header and syncs status

## Key functions (brief)

- normalizeDate(date) — extracts YYYY-MM-DD from ISO-like strings.
- normalizeTime(time) — converts H, H:M, HH:MM -> "HH:MM" (zero-padded). Returns null for non-numeric input.
- buildRoomIdFilter(roomId) — matches roomId as ObjectId or string.
- findBookingConflict(...) — finds confirmed bookings that overlap the given time range.

## Notes

- Consider storing times as minutes-since-midnight or full ISO datetimes for timezone-safe comparisons.
- Ensure CLIENT_URL points to the auth provider exposing JWKS.
- Backend is source of truth for payment status; frontend should only display verified status.

# QuietHub Server

Lightweight Express + MongoDB backend for a simple room booking system.

## Features

- REST endpoints for rooms and bookings
- JWT verification using remote JWKS
- Booking conflict detection (time overlap)
- Normalized date/time input handling
- Room lookup (join booking -> room)

## Requirements

- Node.js (16+ recommended)
- MongoDB (connection string)

## Environment variables

Create a `.env` file with:
PORT=5000
MONGO_URI=<your-mongo-connection-string>
CLIENT_URL=<auth-provider-base-url> # JWKS available at ${CLIENT_URL}/api/auth/jwks

## Install

npm install

## Run

node index.js

# or with nodemon:

# npx nodemon index.js

## Important files

- index.js — main server, routes and DB logic
- package.json — dependencies

## Key functions (brief)

- normalizeDate(date) — extracts YYYY-MM-DD from ISO-like strings.
- normalizeTime(time) — converts H, H:M, HH:MM -> "HH:MM" (zero-padded). Returns null for non-numeric input.
- buildRoomIdFilter(roomId) — matches roomId as ObjectId or string.
- findBookingConflict(...) — finds confirmed bookings that overlap the given time range.

## Notes

- Consider storing times as minutes-since-midnight or full ISO datetimes for timezone-safe comparisons.
- Ensure CLIENT_URL points to the auth provider exposing JWKS.

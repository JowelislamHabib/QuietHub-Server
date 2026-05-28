# PipraPay Step-by-Step Implementation

This is a practical, ordered implementation guide.

It has 2 parts:

1. **How we implemented PipraPay in this project**
2. **How to implement same pattern in any project**

---

## Part A: Exact Steps Used In This Project

Backend repo: `silentium-server`  
Frontend repo: `QuietHub--Where-Deep-Focus-Begins`

---

## A1) Backend: Add Config and Helper Functions First

In backend `index.js`, first add provider config and helper functions.

### Step 1: Add env-backed config variables

Add:

- `PIPRAPAY_API_KEY`
- `PIPRAPAY_CHECKOUT_REDIRECT_URL`
- `PIPRAPAY_VERIFY_PAYMENT_URL`
- `PIPRAPAY_WEBHOOK_URL`
- `PIPRAPAY_CALLBACK_URL`
- `PIPRAPAY_REDIRECT_URL`
- `PIPRAPAY_DEFAULT_CURRENCY`

### Step 2: Add utility helpers

Create helpers in this order:

1. `normalizePipraPayId(ppId)`  
   Normalize provider payment id as string.
2. `buildPipraPayIdFilter(ppId)`  
   Match old numeric and string ids in MongoDB.
3. `parseStatusFromPipraPayPayload(payload)`  
   Extract provider status from different fields.
4. `parsePaymentState(payload)`  
   Normalize status (`completed`, `pending`, `cancelled`, `unknown`).
5. `syncBookingStatusFromPayment(bookingsCollection, ppId, paymentPayload)`  
   Map payment state to booking state:
   - completed -> confirmed
   - cancelled/failed/expired -> cancelled
   - pending/unknown -> pending
6. `resolveVerifyUrls()`  
   Return verify URL fallback list.
7. `pipraPayRequest({ path, fullUrl, payload })`  
   Shared provider HTTP caller.
8. `verifyPipraPayPayment(ppId)`  
   Shared verify call with fallback URL sequence.

These helpers make route code short and reusable.

---

## A2) Backend: Add Payment Routes In Order

### Step 3: Create Charge route

Route:

- `POST /payments/piprapay/create-charge`

What to do:

1. Validate required fields (`full_name`, contact, `amount`).
2. Build callback URL:
   - use `PIPRAPAY_CALLBACK_URL`
   - fallback: `${req.protocol}://${req.get("host")}/payments/piprapay/callback`
3. Build payload for PipraPay.
4. Set both `redirect_url` and `return_url` to callback URL (compatibility).
5. Force currency with `PIPRAPAY_DEFAULT_CURRENCY` (USD in this project).
6. Call provider create endpoint.
7. Save payment row as `pending`.
8. Save booking row as `pending` from `metadata.booking`.
9. Return `pp_url` and `pp_id`.

### Step 4: Verify route

Route:

- `POST /payments/piprapay/verify`

What to do:

1. Receive `pp_id`.
2. Call `verifyPipraPayPayment(pp_id)`.
3. Update `payments` row.
4. Call `syncBookingStatusFromPayment(...)`.
5. Return verified payload.

### Step 5: Callback route

Route:

- `GET|POST /payments/piprapay/callback`

What to do:

1. Parse payment reference from multiple keys:
   - `pp_id`, `invoice_id`, `transaction_ref`, `ppid`
2. Parse status fallback:
   - `status`, `pp_status`
3. Verify payment using shared verify helper.
4. Update payment + booking.
5. Redirect to frontend success URL with normalized params:
   - `pp_id`
   - `status`

### Step 6: Webhook route

Route:

- `POST /payments/piprapay/webhook`

What to do:

1. Validate API key header.
2. Save webhook payload to payment row.
3. Sync booking status.
4. If webhook status missing/unknown/pending -> force verify API call.
5. Save verified status and sync again.

### Step 7: My Bookings fallback sync

Route:

- `GET /my-bookings/:userId`

What to do before returning list:

1. Find user bookings with `status: pending` and `paymentPpId`.
2. Verify each pending payment.
3. Sync booking/payment statuses.
4. Return updated bookings list.

This prevents stale pending records when webhook is missed.

---

## A3) Backend: Add Business Rule Guards

### Step 8: Reschedule guard (payment required)

Route:

- `PATCH /bookings/:id`

Rule:

- allow reschedule only if `paymentStatus === "completed"` (when paymentStatus exists)

---

## A4) Frontend: Implement Checkout + Success Flow

### Step 9: Booking button integration

File:

- `src/app/Components/BookingButton.jsx`

What to do:

1. Build reservation payload.
2. Call backend `POST /payments/piprapay/create-charge`.
3. Use provider message for better error toast.
4. Redirect with `window.location.assign(pp_url)`.

### Step 10: Success page verification

File:

- `src/app/payment/success/page.jsx`

What to do:

1. Parse payment reference from:
   - `pp_id`, `invoice_id`, `transaction_ref`, `ppid`
2. Parse status from:
   - `status`, `pp_status`
3. Call backend `POST /payments/piprapay/verify`.
4. Show status message.

### Step 11: Booking UI status rules

File:

- `src/app/my-bookings/page.jsx`

What to do:

1. Support `pending` display status.
2. Show reschedule only when payment is completed.

---

## A5) Environment Setup (This Project)

Backend `.env`:

```env
PIPRAPAY_API_KEY=...
PIPRAPAY_CHECKOUT_REDIRECT_URL=https://pay.believersvision.com/api/checkout/redirect
PIPRAPAY_VERIFY_PAYMENT_URL=https://pay.believersvision.com/api/verify-payment
PIPRAPAY_DEFAULT_CURRENCY=USD

PIPRAPAY_CALLBACK_URL=https://<backend-domain>/payments/piprapay/callback
PIPRAPAY_WEBHOOK_URL=https://<backend-domain>/payments/piprapay/webhook
PIPRAPAY_REDIRECT_URL=https://quiethub.vercel.app/payment/success
```

Frontend `.env`:

```env
NEXT_PUBLIC_SERVER_URL=https://<backend-domain>
NEXT_PUBLIC_CURRENCY=USD
```

Important:

- webhook URL must be backend URL
- callback URL must be backend URL
- whitelist frontend + backend domains in provider dashboard

---

## A6) Testing Sequence (This Project)

1. Create payment from booking button.
2. Confirm payment row inserted with `pending`.
3. Confirm booking row inserted with `pending`.
4. Complete payment at provider.
5. Confirm callback redirect to frontend success page with payment reference.
6. Confirm verify updates payment to `completed`.
7. Confirm booking becomes `confirmed`.
8. Change status from provider dashboard and confirm webhook sync.

---

## Part B: How To Implement In Any Node Project (With Code)

This section is pure Node.js/Express example with MongoDB and `fetch`.

---

## B1) Project Structure

Create this minimum structure:

```txt
project/
  src/
    server.js
    payments/
      piprapay.service.js
      piprapay.helpers.js
      piprapay.routes.js
    bookings/
      bookings.routes.js
  .env
  package.json
```

Install:

```bash
npm i express mongodb dotenv cors
```

---

## B2) Environment Variables

`.env`

```env
PORT=8000
MONGO_URI=mongodb+srv://...

APP_BASE_URL=https://app.example.com
API_BASE_URL=https://api.example.com

PIPRAPAY_API_KEY=your_key
PIPRAPAY_CHECKOUT_URL=https://pay.believersvision.com/api/checkout/redirect
PIPRAPAY_VERIFY_URL=https://pay.believersvision.com/api/verify-payment
PIPRAPAY_DEFAULT_CURRENCY=USD

PIPRAPAY_CALLBACK_URL=https://api.example.com/payments/piprapay/callback
PIPRAPAY_WEBHOOK_URL=https://api.example.com/payments/piprapay/webhook
PIPRAPAY_SUCCESS_REDIRECT_URL=https://app.example.com/payment/success
PIPRAPAY_CANCEL_REDIRECT_URL=https://app.example.com/payment/cancel
```

---

## B3) Helper Functions (Create These First)

Create `src/payments/piprapay.helpers.js`:

```js
const normalizePaymentId = (value) => String(value ?? "").trim();

const buildPaymentIdFilter = (paymentId) => {
  const id = normalizePaymentId(paymentId);
  const num = Number(id);
  if (!id) return { providerPaymentId: null };
  if (!Number.isNaN(num)) {
    return { $or: [{ providerPaymentId: id }, { providerPaymentId: num }] };
  }
  return { providerPaymentId: id };
};

const extractProviderStatus = (payload) => {
  if (!payload || typeof payload !== "object") return "unknown";
  return (
    payload.status ||
    payload.payment_status ||
    payload.transaction_status ||
    payload.pp_status ||
    "unknown"
  );
};

const normalizePaymentState = (payload) => {
  const s = String(extractProviderStatus(payload)).toLowerCase();
  if (["completed", "success", "succeeded", "paid"].includes(s)) return "completed";
  if (["cancelled", "canceled", "failed", "expired", "declined", "rejected"].includes(s)) {
    return "cancelled";
  }
  if (["pending", "processing"].includes(s)) return "pending";
  return "unknown";
};

module.exports = {
  normalizePaymentId,
  buildPaymentIdFilter,
  extractProviderStatus,
  normalizePaymentState,
};
```

---

## B4) Provider Service (HTTP Calls)

Create `src/payments/piprapay.service.js`:

```js
const verifyUrls = () => {
  const list = [];
  if (process.env.PIPRAPAY_VERIFY_URL) list.push(process.env.PIPRAPAY_VERIFY_URL);
  return [...new Set(list)];
};

const pipraPayRequest = async (url, payload) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "mh-piprapay-api-key": process.env.PIPRAPAY_API_KEY,
      "MHS-PIPRAPAY-API-KEY": process.env.PIPRAPAY_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  const raw = await res.text();
  let json = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch (_) {}

  return { ok: res.ok, status: res.status, json, raw };
};

const createCharge = (payload) =>
  pipraPayRequest(process.env.PIPRAPAY_CHECKOUT_URL, payload);

const verifyPayment = async (providerPaymentId) => {
  let last = null;
  for (const url of verifyUrls()) {
    const result = await pipraPayRequest(url, { pp_id: String(providerPaymentId) });
    last = result;
    if (result.ok) return result;
  }
  return last;
};

module.exports = { createCharge, verifyPayment };
```

---

## B5) Sync Function (Payment -> Business Status)

Add this function in your payments routes module:

```js
const { normalizePaymentState, buildPaymentIdFilter } = require("./piprapay.helpers");

async function syncOrderFromPayment(db, providerPaymentId, paymentPayload) {
  const state = normalizePaymentState(paymentPayload);
  let orderStatus = "pending";
  if (state === "completed") orderStatus = "confirmed";
  else if (state === "cancelled") orderStatus = "cancelled";

  await db.collection("orders").updateOne(
    { providerPaymentId: String(providerPaymentId) },
    {
      $set: {
        paymentStatus: state,
        status: orderStatus,
        updatedAt: new Date(),
      },
    },
  );

  await db.collection("payments").updateOne(
    buildPaymentIdFilter(providerPaymentId),
    {
      $set: {
        provider: "piprapay",
        providerPaymentId: String(providerPaymentId),
        status: state,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
}
```

---

## B6) Routes (Copy-Paste Ready)

Create `src/payments/piprapay.routes.js`:

```js
const express = require("express");
const { createCharge, verifyPayment } = require("./piprapay.service");
const {
  normalizePaymentId,
  buildPaymentIdFilter,
  normalizePaymentState,
} = require("./piprapay.helpers");

const router = express.Router();

module.exports = (db) => {
  const payments = db.collection("payments");
  const orders = db.collection("orders");

  async function syncOrder(providerPaymentId, payload) {
    const state = normalizePaymentState(payload);
    const orderStatus = state === "completed" ? "confirmed" : state === "cancelled" ? "cancelled" : "pending";

    await orders.updateOne(
      { providerPaymentId: String(providerPaymentId) },
      { $set: { paymentStatus: state, status: orderStatus, updatedAt: new Date() } },
    );
  }

  router.post("/create-charge", async (req, res) => {
    const {
      full_name,
      email_address,
      email_mobile,
      mobile_number,
      amount,
      metadata = {},
      return_type = "GET",
    } = req.body;

    if (!full_name || !amount || !(email_address || email_mobile || mobile_number)) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const callbackUrl = process.env.PIPRAPAY_CALLBACK_URL;
    const payload = {
      full_name,
      email_address: email_address || email_mobile,
      email_mobile: email_mobile || email_address || mobile_number,
      mobile_number: mobile_number || email_mobile,
      amount: String(amount),
      currency: String(process.env.PIPRAPAY_DEFAULT_CURRENCY || "USD").toUpperCase(),
      metadata,
      redirect_url: callbackUrl,
      return_url: callbackUrl,
      return_type,
      cancel_url: process.env.PIPRAPAY_CANCEL_REDIRECT_URL,
      webhook_url: process.env.PIPRAPAY_WEBHOOK_URL,
    };

    const result = await createCharge(payload);
    if (!result.ok) {
      return res.status(result.status || 400).json({
        success: false,
        message: "Failed to create PipraPay charge",
        piprapay: result.json,
        piprapay_raw: result.raw,
      });
    }

    const providerPaymentId = normalizePaymentId(result.json?.pp_id);

    await payments.updateOne(
      buildPaymentIdFilter(providerPaymentId),
      {
        $set: {
          provider: "piprapay",
          providerPaymentId,
          status: "pending",
          amount: String(amount),
          currency: payload.currency,
          metadata,
          requestPayload: payload,
          responsePayload: result.json,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    await orders.updateOne(
      { providerPaymentId },
      {
        $setOnInsert: {
          status: "pending",
          paymentStatus: "pending",
          providerPaymentId,
          orderData: metadata.order || null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    );

    return res.json({ success: true, data: result.json });
  });

  router.post("/verify", async (req, res) => {
    const providerPaymentId = normalizePaymentId(req.body?.pp_id);
    if (!providerPaymentId) {
      return res.status(400).json({ success: false, message: "pp_id required" });
    }

    const result = await verifyPayment(providerPaymentId);
    if (!result?.ok) {
      return res.status(result?.status || 400).json({
        success: false,
        message: "Failed to verify payment",
        piprapay: result?.json,
      });
    }

    await payments.updateOne(
      buildPaymentIdFilter(providerPaymentId),
      {
        $set: {
          provider: "piprapay",
          providerPaymentId,
          verificationPayload: result.json,
          status: normalizePaymentState(result.json),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    await syncOrder(providerPaymentId, result.json);

    return res.json({ success: true, data: result.json });
  });

  router.all("/callback", async (req, res) => {
    const providerPaymentId = normalizePaymentId(
      req.body?.pp_id ||
        req.query?.pp_id ||
        req.body?.invoice_id ||
        req.query?.invoice_id ||
        req.body?.transaction_ref ||
        req.query?.transaction_ref,
    );

    if (!providerPaymentId) {
      return res.status(400).json({ success: false, message: "Missing payment reference" });
    }

    const verify = await verifyPayment(providerPaymentId);
    const state = verify?.ok
      ? normalizePaymentState(verify.json)
      : String(req.body?.pp_status || req.query?.pp_status || "unknown").toLowerCase();

    await payments.updateOne(
      buildPaymentIdFilter(providerPaymentId),
      {
        $set: {
          provider: "piprapay",
          providerPaymentId,
          callbackPayload: { body: req.body, query: req.query },
          verificationPayload: verify?.json || null,
          status: state,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );
    await syncOrder(providerPaymentId, { status: state });

    const redirect = `${process.env.PIPRAPAY_SUCCESS_REDIRECT_URL}?pp_id=${encodeURIComponent(
      providerPaymentId,
    )}&status=${encodeURIComponent(state)}`;
    return res.redirect(302, redirect);
  });

  router.post("/webhook", async (req, res) => {
    const apiKey = req.headers["mh-piprapay-api-key"] || req.headers["mhs-piprapay-api-key"];
    if (apiKey !== process.env.PIPRAPAY_API_KEY) {
      return res.status(401).json({ success: false, message: "Unauthorized webhook request" });
    }

    const payload = req.body || {};
    const providerPaymentId = normalizePaymentId(payload.pp_id);

    await payments.updateOne(
      buildPaymentIdFilter(providerPaymentId),
      {
        $set: {
          provider: "piprapay",
          providerPaymentId,
          webhookPayload: payload,
          status: normalizePaymentState(payload),
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true },
    );

    await syncOrder(providerPaymentId, payload);

    // Optional fallback verify
    const state = normalizePaymentState(payload);
    if (state === "pending" || state === "unknown") {
      const verify = await verifyPayment(providerPaymentId);
      if (verify?.ok) {
        await syncOrder(providerPaymentId, verify.json);
      }
    }

    return res.json({ success: true, message: "Webhook received" });
  });

  return router;
};
```

---

## B7) Mount Routes In Server

`src/server.js`

```js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const createPipraPayRoutes = require("./payments/piprapay.routes");

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
  const db = client.db("appdb");
  app.use("/payments/piprapay", createPipraPayRoutes(db));
  app.listen(process.env.PORT || 8000, () => console.log("server started"));
}
run().catch(console.error);
```

---

## B8) Frontend Checkout Code (React/Next Example)

Checkout button:

```js
const onPay = async () => {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/payments/piprapay/create-charge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_name: user.name,
      email_address: user.email,
      amount: "10.00",
      currency: "USD",
      metadata: { order: { orderId: "ORD-123" } },
      return_type: "GET",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data?.data?.pp_url) throw new Error("payment init failed");
  window.location.assign(data.data.pp_url);
};
```

Success page:

```js
const ref =
  searchParams.get("pp_id") ||
  searchParams.get("invoice_id") ||
  searchParams.get("transaction_ref");

if (ref) {
  await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/payments/piprapay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pp_id: ref }),
  });
}
```

---

## B9) Final Validation Checklist (Node Projects)

1. Create charge returns `pp_url` and `pp_id`
2. Payment record inserted as `pending`
3. Business record inserted as `pending`
4. Callback resolves and redirects to frontend success page
5. Verify turns paid records into `completed`
6. Business status updates (`confirmed`/`cancelled`)
7. Webhook auth works and replay-safe
8. No duplicate confirmed business records

---

## Final Notes

- Provider integrations differ by endpoint names and return query keys.
- Always support multiple key names for callback parsing.
- Keep backend authoritative; frontend should display state, not decide truth.


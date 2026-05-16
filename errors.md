---
title: "Errors"
description: "How error responses are shaped and what to do about each one."
---

# Errors

Every error response is a JSON envelope:

```json
{
  "error":  "Human-readable message",
  "code":   "OPTIONAL_MACHINE_CODE"
}
```

Sometimes a `details` field is present with structured field-level info from validation:

```json
{
  "error":   "Validation failed",
  "details": {
    "fieldErrors": {
      "email": ["Invalid email"]
    }
  }
}
```

> **Best practice:** match against the HTTP status + the `error` substring you care about, or the optional `code` if present. Never break your retry logic on the human-readable message — it can be reworded.

---

## HTTP status reference

| HTTP | When | Retry? |
|------|------|--------|
| `400` | Validation error — missing / invalid body, bad PIN, missing query param. | ❌ Fix the request. |
| `401` | Missing/invalid bearer token, expired JWT, bad `clientId`/`apiKey`. | ❌ Re-authenticate. |
| `403` | IP not allowlisted, or credentials don't match the white-label hostname you called. | ❌ Use the right credentials/host. |
| `404` | Organization / cardholder / card not found in your program. | ❌ Check the ID. |
| `409` | Conflict — slug collision, hostname already registered to another partner, etc. | ❌ Use a different value. |
| `422` | Upstream KYC / BIN / regulatory rejection. | ⚠️ Sometimes (re-submit corrected data). |
| `429` | Rate-limited. | ✅ With exponential backoff. |
| `500` | Internal server error. | ✅ Retry once after a few seconds. |
| `502` | Upstream issuer error (Visa network, Interlace, etc.). | ✅ Retry with backoff up to 3 attempts. |
| `503` | Issuer not configured for your program. | ❌ Contact support — Seismic-side problem. |

---

## Common errors and how to recover

### Auth

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `401 Invalid client id or key` | Wrong `clientId`, wrong `apiKey`, or apiKey was revoked. | Verify the values; if you've lost the key, ask for a new one. |
| `401 Missing Authorization bearer token` | Forgot to send `Authorization: Bearer …`. | Add the header. |
| `401 Invalid or expired partner session` | JWT older than 1 hour. | Call `POST /api/v1/auth/session` again. |
| `403 IP not in allowlist` | Your program has IP allowlisting on. Source IP doesn't match. | Add the IP via support, or call from an allowlisted host. |
| `403 This credential is not valid for the API hostname you are using` | You called `api.seismic-cards.systems` (white-label) with another program's credentials. | Use the credentials issued for the program that owns this hostname, or call the default Seismic URL. |

### Organizations

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `404 Organization not found` | `orgId` doesn't exist or doesn't belong to your program. | Verify with `GET /api/v1/organizations`. |
| `409` on create org | Slug already in use within your program. | Pass an explicit `slug`, or omit and we'll suffix it. |

### Cardholders

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `400 Cardholder not provisioned` | Tried to issue/PIN/freeze a card before calling `/cardholders/provision`. | Provision first; the call is idempotent so re-running is safe. |
| `400 Validation failed` on provision | A required KYC field is missing or wrong shape. | Inspect `details.fieldErrors`. Common: `country` must be 2 letters, `phoneCountryCode` must include `+`. |
| `422` on provision | KYC rejected the cardholder. | Re-submit with corrected name/address/phone; we resume from the failed step. |

### Cards

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `400 Query externalUserId required` | List/get card endpoints need `?externalUserId=…`. | Add the query param. |
| `400 PIN must be 6 digits` | PIN wrong length. | Use exactly 6 digits. |
| `400 PIN cannot contain three identical digits in a row` | PIN like `111000`. | Pick a non-trivial PIN. |
| `400 PIN cannot contain three sequential digits` | PIN like `123456`, `987654`, `890…`, `098…`. | Pick a non-sequential PIN. |
| `502 No card BIN available for this account` | Issuer didn't return any usable BIN. | Contact support. |
| `503 Interlace is not configured` | Backend missing issuer credentials. | Contact support. |

---

## What to log

When you open a support ticket, include:

- The **HTTP status** and full response body.
- The Railway/Cloudflare/etc. **request ID** from response headers (e.g. `x-request-id`).
- A timestamp (ISO-8601, UTC).
- The exact endpoint and method.
- The shape of your request (no secrets, no PII).

This lets us trace through our logs in seconds.

---

## Reach us

- **Sandbox dashboard:** every API call is logged with status + timing.
- **Status page:** [status.seismic-cards.systems](https://status.seismic-cards.systems) (rolling).
- **Support:** [support@seismic-cards.systems](mailto:support@seismic-cards.systems).

---
title: "API Reference"
description: "Complete endpoint catalog with request/response shapes."
---

# API Reference

Base URLs:

- **Sandbox:** `https://sandbox-api.seismic-cards.systems`
- **Production:** `https://api.seismic-cards.systems`

All paths below are relative to the base URL.

| Auth | Header |
|------|--------|
| `/api/v1/auth/session` | None |
| All other `/api/v1/*` | `Authorization: Bearer <session JWT>` |

---

## Authentication

### `POST /api/v1/auth/session`

Exchange your `clientId` + `apiKey` for a session JWT (1 hour TTL).

**Request:**

```json
{
  "clientId": "cid_…",
  "apiKey":   "cik_sbx_…"
}
```

**Response 200:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiI…",
  "tokenType":   "Bearer",
  "expiresIn":   3600
}
```

**Errors:** `400` invalid body · `401` bad credentials · `403` IP not allowlisted.

---

### `GET /api/v1/me`

Returns information about the authenticated program (handy as a smoke test).

**Response 200:**

```json
{
  "id":             "uuid",
  "publicClientId": "cid_…",
  "name":           "Your Program Name",
  "slug":           "your-program",
  "status":         "ACTIVE",
  "resolvedWhiteLabelHost": null
}
```

`resolvedWhiteLabelHost` is non-null when you call from your own white-label hostname (e.g. `api.yourbrand.com`). Most integrations will see `null`.

---

## Organizations

An **organization** is a tenant under your program. Typical use: one organization per customer (B2B) or one per partner brand (B2B2C).

### `GET /api/v1/organizations`

List all organizations under your program. Returns array (no pagination yet).

**Response 200:**

```json
[
  {
    "id":          "uuid",
    "name":        "Acme Corp",
    "slug":        "acme-corp",
    "programType": "CORPORATE",
    "status":      "ACTIVE",
    "createdAt":   "2026-05-16T05:09:51.379Z"
  }
]
```

### `POST /api/v1/organizations`

Create a new organization.

**Request:**

```json
{
  "name":        "Acme Corp",
  "slug":        "acme-corp",
  "programType": "CORPORATE"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `name` | ✅ | 1–200 chars. |
| `slug` | optional | Auto-derived from `name` if omitted. Unique within your program. |
| `programType` | ✅ | `CORPORATE` or `CONSUMER_BRAND`. |

**Response 200:**

```json
{
  "id":          "uuid",
  "name":        "Acme Corp",
  "slug":        "acme-corp",
  "programType": "CORPORATE",
  "status":      "ACTIVE"
}
```

### `GET /api/v1/organizations/{orgId}`

**Response 200:** same shape as list element.

**Errors:** `404` if `orgId` does not belong to your program.

---

## Cardholders

A **cardholder** is keyed by your stable `externalUserId` (your internal ID). Provisioning is idempotent — calling it twice with the same `externalUserId` is a safe no-op.

### `GET /api/v1/organizations/{orgId}/cardholders`

List all cardholder profiles in an organization.

**Response 200:**

```json
[
  {
    "id":             "uuid",
    "externalUserId": "emp-00481",
    "displayName":    "Priya Sharma",
    "provisioned":    true,
    "createdAt":      "2026-05-16T05:09:51.379Z"
  }
]
```

### `POST /api/v1/organizations/{orgId}/cardholders/provision`

Run KYC and create the issuer-side cardholder + budget.

**Request:**

```json
{
  "externalUserId":   "emp-00481",
  "displayName":      "Priya Sharma",
  "email":            "priya@acme.example",
  "firstName":        "Priya",
  "lastName":         "Sharma",
  "phoneCountryCode": "+91",
  "phoneNumber":      "9876543210",
  "addressLine1":     "12 MG Road",
  "addressLine2":     "Apt 4B",
  "city":             "Bengaluru",
  "state":            "KA",
  "country":          "IN",
  "postalCode":       "560001"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `externalUserId` | ✅ | ≤128 chars. Stable per user. |
| `email`, `firstName`, `lastName` | ✅ | KYC fields. |
| `phoneCountryCode` | ✅ | E.164 prefix incl. `+`, e.g. `+1`. |
| `phoneNumber` | ✅ | ≥3 digits, no country code. |
| `addressLine1`, `city`, `state`, `country`, `postalCode` | ✅ | KYC address. `country` = 2-letter ISO. |
| `addressLine2`, `displayName` | optional | |

**Response 200:**

```json
{
  "alreadyProvisioned": false,
  "profile": {
    "id":             "uuid",
    "externalUserId": "emp-00481",
    "displayName":    "Priya Sharma",
    "provisioned":    true
  }
}
```

**Errors:** `404` org not yours · `503` issuer not configured (Seismic-side problem).

---

## Cards

All card endpoints require the cardholder to be provisioned first. They take `externalUserId` either in the URL path or as a query/body parameter.

### `POST /api/v1/organizations/{orgId}/cardholders/{externalUserId}/cards`

Issue a virtual card to a provisioned cardholder.

**Request:**

```json
{ "label": "Travel" }
```

`label` is optional, ≤80 chars, shown in dashboards.

**Response 200:**

```json
{
  "card": {
    "id":           "card_…",
    "status":       "ACTIVE",
    "cardLastFour": "4242"
  }
}
```

> Full PAN/CVV are never returned. Use the [PCI Widget](/pci-widget) (coming soon) to display them to the cardholder.

### `GET /api/v1/organizations/{orgId}/cards?externalUserId=…`

List cards for a single cardholder.

**Response 200:**

```json
{
  "cards": [
    {
      "id":           "card_…",
      "status":       "ACTIVE",
      "cardLastFour": "4242",
      "label":        "Travel"
    }
  ]
}
```

### `GET /api/v1/organizations/{orgId}/cards/{cardId}?externalUserId=…`

Card detail (scrubbed — no PAN/CVV).

**Response 200:**

```json
{
  "card": {
    "id":           "card_…",
    "status":       "ACTIVE",
    "cardLastFour": "4242",
    "label":        "Travel",
    "createdAt":    "..."
  }
}
```

### `PUT /api/v1/organizations/{orgId}/cards/{cardId}/pin`

Set or rotate the card PIN. Validated server-side.

**Request:**

```json
{
  "pin":            "739241",
  "externalUserId": "emp-00481"
}
```

PIN rules:

- Exactly 6 digits
- No three identical digits in a row (`111`, `222`, …)
- No three sequential digits (`123`, `321`, `890`, `098`)

**Response 200:** `{ "ok": true, "data": ... }`
**Errors:** `400` if PIN violates rules.

### `POST /api/v1/organizations/{orgId}/cards/{cardId}/freeze`

Temporarily block all authorizations.

**Request:**

```json
{ "externalUserId": "emp-00481" }
```

**Response 200:** `{ "ok": true, "data": ... }`

### `POST /api/v1/organizations/{orgId}/cards/{cardId}/unfreeze`

Restore authorizations on a frozen card.

**Request / response:** identical to freeze.

---

## Status & error model

Every error response is JSON of the form:

```json
{
  "error":  "Human-readable message",
  "code":   "OPTIONAL_MACHINE_CODE"
}
```

| HTTP | When |
|------|------|
| `400` | Validation error (missing/invalid body, bad PIN, etc.). |
| `401` | Missing or invalid bearer token, or bad `clientId`/`apiKey` on `/auth/session`. |
| `403` | Source IP not allowlisted; credentials valid but not for this hostname (white-label mismatch). |
| `404` | Organization or cardholder not found in your program. |
| `409` | Conflict (slug collision when creating org). |
| `422` | KYC failure or BIN issue from upstream. |
| `429` | Rate-limited (10 req/sec/JWT default — contact us to lift). |
| `502` | Upstream issuer error. Retry with backoff. |
| `503` | Issuer not configured for your program. |

Full code list → **[Errors](/errors)**.

---

## Things not in this catalog yet

- **Webhooks** — see [/webhooks](/webhooks) for the planned shape.
- **PCI Widget** — see [/pci-widget](/pci-widget) for the planned drop-in iframe.
- **BIN selection** — currently uses program default.
- **Card replace / reissue** — endpoints planned, contact us if you need them now.

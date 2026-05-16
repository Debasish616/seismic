---
title: "Issue your first card"
description: "End-to-end walkthrough — organization, cardholder, card, PIN, freeze."
---

# Issue your first card

Walk through the full happy-path flow in **5 calls**:

```
1. Get session JWT          (POST /auth/session)
2. Create organization      (POST /organizations)
3. Provision cardholder     (POST /organizations/{orgId}/cardholders/provision)
4. Issue virtual card       (POST /organizations/{orgId}/cardholders/{externalUserId}/cards)
5. Set card PIN             (PUT  /organizations/{orgId}/cards/{cardId}/pin)
```

> All examples below use `https://sandbox-api.seismic-cards.systems`. Set `TOKEN` to the JWT you got from `/auth/session` (see [Getting Started](/getting-started)).

---

## 1. Get a session JWT

```bash
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/auth/session" \
  -H "Content-Type: application/json" \
  -d '{"clientId": "cid_…", "apiKey": "cik_sbx_…"}'
```

Copy the `accessToken` into `$TOKEN`. Expires in 1 h.

---

## 2. Create an organization

An **organization** is a logical tenant — typically one of your customers, or one of your internal programs.

```bash
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/organizations" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":        "Acme Corp",
    "programType": "CORPORATE"
  }'
```

**Response (200):**

```json
{
  "id":          "233b832e-c9e8-4bc4-854c-06ed3c54e68f",
  "name":        "Acme Corp",
  "slug":        "acme-corp",
  "programType": "CORPORATE",
  "status":      "ACTIVE"
}
```

Save `id` as `ORG_ID`.

| Field | Required | Notes |
|-------|----------|-------|
| `name` | ✅ | Display name (1–200 chars). |
| `slug` | optional | URL-safe identifier; auto-derived from name if omitted. Unique within your program. |
| `programType` | ✅ | `CORPORATE` (employee/contractor cards) or `CONSUMER_BRAND` (neobank-style end-user cards). |

---

## 3. Provision a cardholder

A **cardholder** is the person who'll hold the card. Provisioning runs identity verification (KYC) under the hood and creates the issuer-side account, budget, and cardholder record.

You provide a stable `externalUserId` — your internal user ID, employee number, anything ≤128 chars. We use it to deduplicate; calling provision twice with the same `externalUserId` is a safe no-op.

```bash
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/organizations/$ORG_ID/cardholders/provision" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
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
  }'
```

**Response (200):**

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

| Field | Required | Notes |
|-------|----------|-------|
| `externalUserId` | ✅ | Stable ID in your system. Used by all card operations afterwards. |
| `email` | ✅ | Cardholder's email. |
| `firstName` / `lastName` | ✅ | Legal name for KYC. |
| `phoneCountryCode` | ✅ | E.164 country code prefix, e.g. `+1`, `+91`. |
| `phoneNumber` | ✅ | Without the country code. |
| `addressLine1` / `city` / `state` / `country` / `postalCode` | ✅ | KYC address. `country` is a 2-letter ISO code (`US`, `IN`, …). |
| `addressLine2` | optional | Apartment/suite. |
| `displayName` | optional | What you want shown in your dashboard; defaults to `${firstName} ${lastName}`. |

> **Sandbox tip:** any well-formed name + address passes synthetic KYC. In production we run real KYC — bad data returns `422` with detail.

If KYC fails, you'll see `4xx` with a human-readable reason. Re-submit with corrected fields and we resume from where we left off.

---

## 4. Issue a virtual card

Once the cardholder is provisioned, issuing a card is a single call. You can call it multiple times to issue more cards to the same cardholder.

```bash
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/organizations/$ORG_ID/cardholders/emp-00481/cards" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "label": "Travel" }'
```

**Response (200):**

```json
{
  "card": {
    "id":           "card_…",
    "status":       "ACTIVE",
    "cardLastFour": "4242"
  }
}
```

The full PAN, CVV, and expiry are **never** returned through the API. To display them to the cardholder, use the **PCI Widget** (coming soon) which renders them inside an iframe scoped to your domain.

For now in sandbox you can fetch full details from your dashboard for testing.

---

## 5. Set a card PIN

```bash
curl -X PUT "https://sandbox-api.seismic-cards.systems/api/v1/organizations/$ORG_ID/cards/$CARD_ID/pin" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pin":            "739241",
    "externalUserId": "emp-00481"
  }'
```

**PIN rules** (enforced server-side):

- Exactly **6 digits**.
- No three identical digits in a row (`111`, `222`, …).
- No three sequential digits (`123`, `321`, `890`, `098`).

Returns `400` with the rule that failed if invalid.

---

## 6. Freeze / unfreeze

Temporarily disable authorizations without revoking the card:

```bash
# Freeze
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/organizations/$ORG_ID/cards/$CARD_ID/freeze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "externalUserId": "emp-00481" }'

# Unfreeze
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/organizations/$ORG_ID/cards/$CARD_ID/unfreeze" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "externalUserId": "emp-00481" }'
```

Both return `{ "ok": true, "data": ... }`.

---

## 7. List cards for a cardholder

```bash
curl "https://sandbox-api.seismic-cards.systems/api/v1/organizations/$ORG_ID/cards?externalUserId=emp-00481" \
  -H "Authorization: Bearer $TOKEN"
```

Returns `{ "cards": [...] }` — paginated under the hood.

---

## What you've built

| Resource | Stored where | Used for |
|----------|--------------|----------|
| Organization | Seismic | Tenanting, reporting, billing isolation. |
| Cardholder | Seismic + your `externalUserId` | KYC anchor, parent of cards. |
| Card | Seismic | The actual virtual card object. |

Now, repeat steps 3–4 for every user you want to issue cards to. Each org can hold any number of cardholders; each cardholder any number of cards.

---

## Common pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| `400 — Cardholder not provisioned` | Tried to issue/PIN/freeze before `/provision`. | Call `/cardholders/provision` first. |
| `404 — Organization not found` | Using an `orgId` that belongs to another program (or doesn't exist). | Verify with `GET /organizations`. |
| `503 — Interlace is not configured` | Backend missing issuer credentials. | Contact support; this is a Seismic config issue, not yours. |
| Provision returns same response twice | `alreadyProvisioned: true` is normal — provision is **idempotent** by `externalUserId`. | None — design intent. |

---

Next: **[API Reference](/api-reference)** for the complete endpoint catalog.

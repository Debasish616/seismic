---
title: "Webhooks"
description: "Real-time card events delivered to your endpoint. Roadmap."
---

# Webhooks

> **Status: roadmap.** Webhooks are not yet live. This page is published so you can plan your integration shape; the API contract below is what we'll ship in **v0.2**.
>
> Need them now? Email [support@seismic-cards.systems](mailto:support@seismic-cards.systems) — we have early-access slots open.

---

## Why

Polling `GET /cards/{id}` to detect status changes doesn't scale. Webhooks let us push card events the moment they happen — typically <500 ms from authorization to your endpoint.

## Planned event shape

Every webhook is a `POST` with `Content-Type: application/json`:

```json
{
  "id":          "evt_01HX…",
  "type":        "card.authorization.approved",
  "createdAt":   "2026-05-16T05:09:51.379Z",
  "data": {
    "cardId":         "card_…",
    "orgId":          "uuid",
    "externalUserId": "emp-00481",
    "amount":         1299,
    "currency":       "USD",
    "merchantName":   "AMAZON.COM",
    "merchantCity":   "Seattle",
    "mcc":            "5942"
  }
}
```

## Planned event types

| Type | When |
|------|------|
| `card.issued` | A card was successfully created. |
| `card.frozen` / `card.unfrozen` | Card status flipped. |
| `card.authorization.approved` | Network approved a transaction. |
| `card.authorization.declined` | Network declined; payload includes reason. |
| `card.authorization.refunded` | Refund cleared. |
| `cardholder.kyc.passed` / `cardholder.kyc.failed` | KYC outcome. |
| `cardholder.kyc.review` | Manual review required. |

## Planned signature verification

We'll sign each event with HMAC-SHA256 over the raw request body, using a secret you configure per endpoint:

```
X-Seismic-Signature: t=1715829011,v1=abcd…
```

You verify by:

1. Splitting on `,` to get `t=…` and `v1=…`.
2. Recomputing `HMAC_SHA256(secret, t + "." + raw_body)` in hex.
3. Comparing the computed value to `v1=` using constant-time comparison.
4. Rejecting if `t` is more than 5 minutes old (prevents replay).

Reference Node.js verifier (will ship in `v0.2`):

```ts
import crypto from "crypto";

export function verify(secret: string, header: string, rawBody: string): boolean {
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const expected = crypto.createHmac("sha256", secret)
    .update(`${parts.t}.${rawBody}`).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(parts.v1, "hex"), Buffer.from(expected, "hex"))) return false;
  if (Date.now() / 1000 - Number(parts.t) > 300) return false;
  return true;
}
```

## Delivery semantics (planned)

- **At-least-once** delivery. Idempotency key = `event.id`. Store seen IDs and skip dupes.
- **Retries** on `>=500` or non-2xx with exponential backoff up to 24 h, then sent to a dead-letter you can replay from the dashboard.
- **Ordering** is best-effort, not guaranteed. Use `createdAt` to sequence on your side.

## Sign up for v0.2 access

Email [support@seismic-cards.systems](mailto:support@seismic-cards.systems) with:

- The endpoint URL (`https://...`)
- The events you care about
- Whether you want sandbox + production, or just one

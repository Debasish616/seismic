# Webhooks

Seismic delivers real‑time events to your server via HTTPS POST. Every webhook is signed with HMAC‑SHA256 so you can trust its origin.

| Event you care about | When it fires | What to do |
|---|---|---|
| `KYC.UPDATED` | KYC decision returned | Mark the user as approved/rejected; if approved, call `POST /v1/accounts/{accountId}/init`. |
| `KYB.UPDATED` | Business KYB decision returned (for B2B programs) | Same as above. |
| `CARDHOLDER.CREATED` | Cardholder created | Optional — record creation in your system of record. |
| `CARDHOLDER.UPDATED` | Cardholder transitions to `APPROVED`, `INACTIVE`, etc. | Sync cardholder state in your DB. |
| `CARD.CREATED` | New card issued | Optional — already returned synchronously by `POST /v1/budget-card`. |
| `CARD.UPDATED` | Card status changes (frozen, deleted, expired) | Sync card state in your DB. |
| `CARD_TRANSACTION.CREATED` | New authorization arrives at the network | Lock funds in your accounting system; show pending charge in your UI. |
| `CARD_TRANSACTION.UPDATED` | Auth becomes settled, refunded, or reversed | Update the transaction's status; release the lock if reversed. |

---

## 1. Configuring your webhook endpoint

1. In your Seismic dashboard, set your webhook URL — e.g. `https://api.your-app.com/webhooks/seismic`.
2. Generate a `webhookSecret` and copy it to your secret manager.
3. Make sure your endpoint:
   - Is reachable from the public internet over HTTPS.
   - Responds within **10 seconds**.
   - Returns `2xx` on success. Anything else triggers a retry.

> Seismic retries failed deliveries with exponential backoff for 24 hours.

---

## 2. Webhook payload shape

Every webhook is a JSON `POST` with the same envelope:

```json
{
  "id":          "evt_5f8b1c2d-3e4a-5678-9012-3456789abcde",
  "eventType":   "CARD_TRANSACTION.CREATED",
  "createTime":  "2026-04-01T12:34:56Z",
  "apiVersion":  "v1",
  "resource":    "{\"cardId\":\"d8eda079-...\",\"transactionId\":\"tx_...\",\"amount\":\"12.50\", ...}"
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique event ID. Use for idempotency in your handler. |
| `eventType` | string | One of the events listed above. |
| `createTime` | string (ISO‑8601) | When Seismic generated the event. |
| `apiVersion` | string | API version that produced the event. |
| `resource` | **string** | A JSON‑encoded **string** containing the event‑specific payload. You must `JSON.parse` it before reading fields. |

> **Important:** `resource` is a string, not a nested object. This is intentional — the HMAC is computed over the *exact bytes* of `resource`, so we deliver it as a string to avoid JSON re‑serialization differences.

---

## 3. Verifying the signature

Every request includes a `Signature` header — Base64‑encoded `HMAC-SHA256(webhookSecret, resource)`.

### Example signed request

```http
POST /webhooks/seismic HTTP/1.1
Host: api.your-app.com
Signature:        QkFTRTY0X0VOQ09ERURfSE1BQ19TSEEyNTY=
Signature-Method: HMAC-SHA256
ApiKey:           <your apiKey>           # optional, legacy
Timestamp:        1714000000
Content-Type:     application/json

{
  "id":         "evt_...",
  "eventType":  "CARD_TRANSACTION.CREATED",
  "createTime": "2026-04-01T12:34:56Z",
  "resource":   "{\"cardId\":\"d8eda079-...\",\"transactionId\":\"tx_...\",\"amount\":\"12.50\",\"status\":\"CLOSED\"}"
}
```

### Node.js (TypeScript) verification

```ts
import crypto from "node:crypto";

function verifySignature(
  resource: string,
  signature: string,
  secret:   string,
): boolean {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(resource, "utf8")
    .digest("base64");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "base64"),
    Buffer.from(expected, "base64"),
  );
}
```

### Python verification

```python
import hmac
import hashlib
import base64

def verify_signature(resource: str, signature: str, secret: str) -> bool:
    expected = base64.b64encode(
        hmac.new(secret.encode(), resource.encode(), hashlib.sha256).digest()
    ).decode()
    return hmac.compare_digest(expected, signature)
```

### Ruby verification

```ruby
require "openssl"
require "base64"

def verify_signature(resource, signature, secret)
  expected = Base64.strict_encode64(
    OpenSSL::HMAC.digest("sha256", secret, resource)
  )
  ActiveSupport::SecurityUtils.secure_compare(expected, signature)
end
```

---

## 4. Reference handler (Node.js / Fastify)

```ts
import Fastify from "fastify";
import crypto from "node:crypto";

const app = Fastify();
const SECRET = process.env.SEISMIC_WEBHOOK_SECRET!;

app.post("/webhooks/seismic", async (req, reply) => {
  const signature = req.headers["signature"] as string | undefined;
  const body      = req.body as { id: string; eventType: string; resource: string };

  if (!signature || !body.resource) {
    return reply.code(401).send({ error: "missing signature" });
  }

  const expected = crypto.createHmac("sha256", SECRET).update(body.resource, "utf8").digest("base64");
  const ok = crypto.timingSafeEqual(
    Buffer.from(signature, "base64"),
    Buffer.from(expected, "base64"),
  );
  if (!ok) return reply.code(401).send({ error: "invalid signature" });

  const data = JSON.parse(body.resource);

  switch (body.eventType) {
    case "CARD_TRANSACTION.CREATED":
    case "CARD_TRANSACTION.UPDATED":
      await handleCardTxn(data);
      break;
    case "KYC.UPDATED":
      await handleKyc(data);
      break;
    case "CARDHOLDER.CREATED":
    case "CARDHOLDER.UPDATED":
      await handleCardholder(data);
      break;
  }

  return reply.send({ received: true });
});

app.listen({ port: 3000 });
```

---

## 5. Event payloads

### `CARD_TRANSACTION.CREATED` & `CARD_TRANSACTION.UPDATED`

Fired on authorization, settlement, reversal, and refund.

```json
{
  "cardId":               "d8eda079-6ba7-409e-99c8-ab5f83566fbd",
  "cardTransactionId":    "tx_abcdef123456",
  "amount":               "12.50",
  "transactionAmount":    "12.50",
  "billingAmount":        "12.50",
  "currency":             "USD",
  "merchantName":         "AMZN Mktp US",
  "merchantCategoryCode": "5942",
  "merchantLogo":         "https://logo.clearbit.com/amazon.com",
  "status":               "PENDING",
  "type":                 "1",
  "createTime":           "1714000000000"
}
```

| `status` | Meaning | Action |
|---|---|---|
| `PENDING` | Auth placed | Lock funds in your ledger. |
| `CLOSED` | Settled | Convert pending lock into a permanent debit. |
| `FAIL` | Declined | Release the lock; surface a notification to the user. |
| `REVERSED` | Auth reversed | Release the lock; mark transaction reversed. |
| `REFUNDED` | Settled charge refunded | Credit the user. |

> **De‑duplication:** the same `cardTransactionId` may arrive multiple times (once on `CREATED`, again on `UPDATED`). Always upsert by `cardTransactionId` rather than insert.

### `KYC.UPDATED`

```json
{
  "accountId": "78ad30f2-5794-47c7-b413-62cc599ab203",
  "status":    "APPROVED",
  "caseId":    "abc-123-def-456"
}
```

| `status` | Action |
|---|---|
| `APPROVED` / `PASS` / `COMPLETED` | Mark user as KYC'd; call `POST /v1/accounts/{accountId}/init` if not already. |
| `REJECTED` | Surface to the user; allow resubmission. |
| `PENDING` | No action — wait. |

### `CARDHOLDER.CREATED` & `CARDHOLDER.UPDATED`

```json
{
  "cardholderId": "1963922322985988097",
  "accountId":    "78ad30f2-5794-47c7-b413-62cc599ab203",
  "status":       "APPROVED"
}
```

### `CARD.CREATED` & `CARD.UPDATED`

```json
{
  "cardId":     "d8eda079-6ba7-409e-99c8-ab5f83566fbd",
  "accountId":  "78ad30f2-5794-47c7-b413-62cc599ab203",
  "status":     "FROZEN",
  "reasonCode": "3001",
  "operationTime": "1714000000000"
}
```

`reasonCode` reference:

| Code | Meaning |
|---|---|
| `7001` | Created via merchant portal |
| `7002` | Created via API |
| `1001` | Closed via API |
| `1002` | Closed via merchant portal |
| `1003` | Closed due to risk policy violation |
| `2001` | Activated via API |
| `3001` | Suspended via API |
| `3002` | Suspended via merchant portal |
| `5001` | Restricted by administrator |
| `6001` | Unrestricted by administrator |

---

## 6. Best practices

1. **Verify the signature first.** Reject anything that fails before doing any work.
2. **Be idempotent.** Look up the event `id` (or `cardTransactionId`) in your DB; if you've already processed it, return `200` and skip.
3. **Respond fast.** Acknowledge with `2xx` immediately, then process asynchronously (push to a queue / job).
4. **Log everything.** Keep at least 30 days of webhook logs for reconciliation.
5. **Never block on slow downstream calls.** Webhooks must complete in 10 seconds.
6. **Allowlist Seismic's IPs.** Production webhooks originate from `47.88.0.0/16` and `47.89.0.0/16`. Optional defence‑in‑depth alongside HMAC verification.

# Error Codes

All Seismic Cards API errors follow the same envelope:

```json
{ "code": "40001", "message": "Invalid parameter" }
```

The HTTP status is `4xx` for client errors and `5xx` for server errors. The `code` field is a stable string — match against it in your code rather than the human‑readable `message`.

---

## How to read the code

Codes are 5‑digit strings:

| Range | Class |
|---|---|
| `00000` – `00099` | Success / informational |
| `01xxxx` – `09xxxx` | Field‑level validation |
| `40xxx` | Authentication / authorization |
| `100xxx` – `199xxx` | Resource lifecycle (cardholder, card, KYC) |
| `9xxxx` | Internal server / dependency errors |

The first two digits typically match the HTTP status (e.g. `40001` → `400`, `40399` → `403`).

---

## Common errors

| Code | HTTP | Meaning | Likely cause |
|---|---|---|---|
| `000000` | 200 | Success | — |
| `40001` | 400 | Invalid parameter | A required field is missing or malformed. The `message` will name the field. |
| `40002` | 400 | Validation failed | A field passed type checks but failed semantic validation (e.g. invalid country code). |
| `40003` | 400 | Idempotency key reuse | Same `Idempotency-Key` used with a different request body. Use a fresh UUID. |
| `40004` | 400 | Reference ID already used | Your `referenceId` for a cardholder/card already exists. Generate a fresh one. |
| `40101` | 401 | Unauthorized | Missing or expired `x-access-token`. Re‑run the OAuth flow. |
| `40399` | 403 | Permission denied | Token is for a different program / environment. |
| `40404` | 404 | Resource not found | The `accountId`, `cardholderId`, `budgetId`, or `cardId` you referenced doesn't exist or doesn't belong to your program. |
| `40499` | 404 | Endpoint not found | Path typo or wrong API version. |
| `40901` | 409 | Conflict / duplicate | Email already exists for `parentAccountId`, etc. |
| `40903` | 409 | Cardholder email mismatch | The cardholder you're trying to attach belongs to a different sub‑account or has a different email. |
| `42901` | 429 | Rate limit exceeded | Back off and retry with exponential delay. |
| `50000` | 500 | Internal server error | Retry with the same `Idempotency-Key`; if it persists, contact support. |
| `50301` | 503 | Service temporarily unavailable | Upstream issuer / network outage. Retry. |

---

## KYC / cardholder errors

| Code | Meaning | Action |
|---|---|---|
| `010001` | Email already in use | The cardholder profile already exists with a different referenceId. Look it up via `GET /v1/cardholders` and reuse its `id`. |
| `010002` | Email is null | Cardholder PATCH must include `email` for BB / BZ BINs. |
| `010003` | Phone validation failed | Phone format failed `libphonenumber` rules. Check `phoneCountryCode` (no `+`) and the number itself. |
| `010004` | Combined name too long | `firstName + " " + lastName` must be ≤ 23 characters. Abbreviate. |
| `010005` | Invalid characters in name | A–Z / a–z only — strip diacritics and punctuation. |
| `010101` | KYC source not supported | `sourceType` is unknown. Use `"sumsub"` (or another source enabled for your program). |
| `010102` | KYC token invalid | The `sumsubShareToken` is expired or for a different applicant. |
| `010103` | KYC already approved | The user is already KYC'd. No action needed. |

---

## Card lifecycle errors

| Code | Meaning | Action |
|---|---|---|
| `020001` | BIN not available for account | Pass the right `binId` from `GET /v1/card/bins`. |
| `020002` | Cardholder not approved | Wait for `CARDHOLDER.UPDATED` → `APPROVED`. |
| `020003` | Account not initialized | Call `POST /v1/accounts/{accountId}/init` after KYC approval. |
| `020004` | Budget balance insufficient for issuance | Some BINs require a minimum opening balance. Fund the budget first. |
| `020005` | Card limit reached | Your program's per‑user maximum has been hit. |
| `020010` | Card already deleted | Operation skipped. |
| `020011` | Card already frozen / unfrozen | Operation skipped (idempotent). |

---

## Funding errors

| Code | Meaning | Action |
|---|---|---|
| `030001` | Insufficient balance | The source wallet (USD Wallet or budget) doesn't have enough for the transfer. Top up. |
| `030002` | Currency mismatch | Source and destination must be the same currency. |
| `030003` | Locked funds | The amount you want to withdraw is locked by pending card authorizations. Wait for them to clear. |

---

## Webhook errors (your endpoint → us)

If your endpoint returns non‑`2xx`, Seismic logs the failure and retries:

| Attempt | Delay |
|---|---|
| 1 | immediate |
| 2 | +30 s |
| 3 | +1 min |
| 4 | +5 min |
| 5 | +15 min |
| 6 | +1 h |
| 7 | +4 h |
| 8 | +24 h (final) |

After the final retry the event is moved to a dead‑letter queue. Failed deliveries are replayable from the dashboard for up to 30 days.

---

## Best practices

1. **Pattern‑match on `code`, not `message`.** Messages may be reworded; codes are stable.
2. **Retry on `5xx` and `429` only.** Other errors (`4xx`) won't succeed on retry without changing the request.
3. **Always send a fresh `Idempotency-Key` when the request body changes.** Re‑use only when retrying the *same* request.
4. **Log the full error envelope** (`code`, `message`, response headers, request ID) for support tickets.
5. **Don't leak internal codes to end users.** Map error codes to human‑friendly messages in your UI.

---

## Need help?

- **Sandbox dashboard logs:** every API call is logged with the request ID, response, and timing.
- **Status page:** `https://status.seismic-cards.systems`
- **Support:** `support@seismic-cards.systems` — include the `request-id` header from any failing response.

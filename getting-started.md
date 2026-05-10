# Getting Started

This page walks you through everything you need before issuing your first card: environments, credentials, the OAuth 2.0 authentication flow, request headers, and a smoke‑test call.

---

## 1. Environments

Seismic provides two fully isolated environments. Test cards in sandbox never move real money; production cards do.

| Environment | Base URL | Purpose |
|---|---|---|
| **Sandbox** | `https://sandbox-api.seismic.systems` | Build and test against synthetic data. Test BIN, simulated KYC results, simulated authorizations. |
| **Production** | `https://api.seismic.systems` | Real cards, real authorizations, real money. Requires a production credential set issued after sandbox sign‑off. |

> Throughout the docs, examples use sandbox URLs. Swap `sandbox-api` for `api` for production.

---

## 2. Credentials

During onboarding Seismic provisions a credential bundle for each program:

| Field | Where it goes | Description |
|---|---|---|
| `clientId` | Public | Identifies your program. Sent as a query parameter to `/oauth/authorize`. |
| `clientSecret` | **Server‑side only.** | Signs OAuth token requests. Treat like a password. Never embed in mobile apps or websites. |
| `parentAccountId` | Server‑side | UUID of your top‑level partner account. Required when creating user sub‑accounts. |
| `merchantId` | Server‑side | UUID of your master merchant account. Used to fund user budgets via inter‑account transfers. |
| `defaultBinId` | Server‑side | UUID of the BIN your program issues from. (You may have more than one — see `GET /v1/card/bins`.) |
| `webhookSecret` | Server‑side | Used to verify HMAC‑SHA256 signatures on incoming webhooks. |

**Storage best practices:**

- Store secrets in a dedicated secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, Doppler, etc.).
- Rotate `clientSecret` and `webhookSecret` on a schedule (90 days recommended).
- Never log secrets. Never commit them. Never send them to a client SDK.

---

## 3. Authentication — OAuth 2.0

Seismic uses an OAuth 2.0 **two‑step authorization code grant**. The flow takes ~50 ms and produces an access token valid for **24 hours**, plus a refresh token valid for **30 days**.

> **You'll typically run this flow once and cache the access token in memory or Redis. Re‑authenticate when the token is within 60 seconds of expiry.**

### Step A — Get an authorization code

```http
GET /v1/oauth/authorize?clientId=YOUR_CLIENT_ID
Host: sandbox-api.seismic.systems
```

```bash
curl "https://sandbox-api.seismic.systems/v1/oauth/authorize?clientId=YOUR_CLIENT_ID"
```

**Response (200):**

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "code": "8655cf76c744615b57e631216ee006df",
    "timestamp": 1758169263
  }
}
```

The `data.code` field is a single‑use authorization ticket. It expires in 10 minutes if not exchanged. The outer `code` field is the response status code (`"000000"` = success).

### Step B — Exchange the code for an access token

```http
POST /v1/oauth/access-token
Host: sandbox-api.seismic.systems
Content-Type: application/json

{
  "clientId":     "YOUR_CLIENT_ID",
  "clientSecret": "YOUR_CLIENT_SECRET",
  "code":         "8655cf76c744615b57e631216ee006df"
}
```

```bash
curl -X POST https://sandbox-api.seismic.systems/v1/oauth/access-token \
  -H "Content-Type: application/json" \
  -d '{
    "clientId":     "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "code":         "8655cf76c744615b57e631216ee006df"
  }'
```

**Response (200):**

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "accessToken":  "6da5bf8a64b34ea30cfb75a6a5e8a9a28a59b8a3",
    "refreshToken": "560d8accee67fb932688e568feca86c6b3866c4a858dce01b4cd66a73d7cc35a",
    "expiresIn":    86400,
    "timestamp":    1758169264
  }
}
```

| Field | Type | Description |
|---|---|---|
| `accessToken` | string | Pass on every subsequent request as `x-access-token: <accessToken>`. |
| `refreshToken` | string | Long‑lived (30 days). Reserved for future refresh endpoint; today, simply re‑run Step A + Step B. |
| `expiresIn` | int | Seconds until the access token expires. Default: `86400` (24 hours). |
| `timestamp` | int | Server timestamp in seconds. |

### Reference implementation (Node / TypeScript)

```ts
import axios from "axios";

class SeismicAuth {
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor(
    private base: string,
    private clientId: string,
    private clientSecret: string,
  ) {}

  async getValidToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt - 60_000) {
      return this.accessToken;
    }

    // Step A — authorization code
    const { data: codeResp } = await axios.get(
      `${this.base}/v1/oauth/authorize`,
      { params: { clientId: this.clientId } },
    );

    // Step B — access token
    const { data: tokenResp } = await axios.post(
      `${this.base}/v1/oauth/access-token`,
      {
        clientId:     this.clientId,
        clientSecret: this.clientSecret,
        code:         codeResp.data.code,
      },
    );

    this.accessToken = tokenResp.data.accessToken;
    this.expiresAt   = Date.now() + tokenResp.data.expiresIn * 1000;
    return this.accessToken!;
  }
}
```

---

## 4. Required headers

| Header | When | Value |
|---|---|---|
| `x-access-token` | All authenticated calls | Token from Step B above. |
| `Content-Type` | All requests with a body | `application/json` |
| `Idempotency-Key` | Mutating endpoints (`POST /v1/cardholders`, `POST /v1/budget-card`, `POST /v1/budgets`, `POST /v1/budgets/{id}/transfer-in`, `POST /v1/budgets/{id}/transfer-out`, `POST /v1/business/transfer/external`) | A UUID v4 you generate per logical operation. Re‑using the same key with the same body returns the same response — safe to retry on network errors. |

---

## 5. Your first authenticated call

Once you have an `accessToken`, list the BINs your program is allowed to issue from. Every program has at least one. The BIN's `id` is what you'll pass as `binId` in cardholder and card creation requests.

```bash
curl "https://sandbox-api.seismic.systems/v1/card/bins?accountId=YOUR_PARENT_ACCOUNT_ID" \
  -H "x-access-token: 6da5bf8a64b34ea30cfb75a6a5e8a9a28a59b8a3"
```

**Response (200):**

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "list": [
      {
        "id":                   "1997881966041939972",
        "bin":                  "411111",
        "type":                 0,
        "currencies":           ["USD"],
        "network":              "VISA",
        "supportPhysicalCard":  false
      }
    ]
  }
}
```

| Field | Type | Description |
|---|---|---|
| `id` | string | The BIN UUID — pass as `binId` in card/cardholder creation. |
| `bin` | string | First 6 digits of the card number. |
| `type` | int | `0` = Budget BIN (use these for the issuance flow in this guide). `1` = Prepaid BIN. |
| `currencies` | string[] | Supported currencies. Currently `["USD"]`. |
| `network` | string | `VISA` or `MASTERCARD`. |
| `supportPhysicalCard` | bool | Whether physical cards are supported on this BIN. |

If you got a `200` with `code: "000000"`, you're authenticated and ready to issue cards. Continue to **[Issuing a Card →](/issuing-a-card)**.

---

## 6. Common issues

| Symptom | Cause | Fix |
|---|---|---|
| `40001 Invalid parameter` on `/oauth/authorize` | Missing or malformed `clientId` query param | Confirm the credential string and that you're hitting the right environment. |
| `40399 permission denied` on any endpoint | Access token expired, revoked, or for a different environment | Re‑run the OAuth flow against the correct base URL. |
| `code` field is `"000000"` but `accessToken` is empty | Authorization code already used or expired (>10 min) | Step A returns a single‑use, 10‑minute code. Run it again. |
| All calls return `40399` after a long idle period | Token aged out (>24 h) | Token caches must check `expiresIn`. The reference snippet above handles this correctly. |

For the full error code list, see **[Error Codes](/errors)**.

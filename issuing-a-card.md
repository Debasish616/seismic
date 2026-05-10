# Issuing a Card — End‑to‑End

This is the canonical guide for going from *zero* to *a usable virtual Visa card* for one of your end users. Once you've completed it once, every subsequent card for the same user is just **Step 6** (one API call).

The flow takes 6 steps, organized in 3 phases:

| Phase | Steps | Frequency |
|---|---|---|
| **A. User onboarding** | 1. Create sub‑account → 2. KYC → 3. Initialize | **Once per user**, before their first card |
| **B. Resource provisioning** | 4. Create cardholder → 5. Create + fund budget | **Once per user**, before their first card |
| **C. Card issuance** | 6. Create the card | **Every time** you issue a card (up to N per user) |

---

## Pre‑requisites

Before starting:

- You have a valid `accessToken` (see [Getting Started → Authentication](/getting-started)).
- You know your `parentAccountId` and `defaultBinId`.
- You have collected the user's: legal name, email, phone (with country code), date of birth, full address.
- Your webhook endpoint is registered in the Seismic dashboard and reachable from the public internet.

---

# Phase A — User onboarding

## Step 1. Create a sub‑account for the user

Every end user gets their own Seismic sub‑account. The sub‑account is the legal envelope that owns the user's cardholder, budget, and cards.

```http
POST /v1/accounts/register
Host: sandbox-api.seismic.systems
x-access-token: <your access token>
Content-Type: application/json

{
  "name":             "John Doe",
  "email":            "john.doe@example.com",
  "phone":            "+15551234567",
  "parentAccountId":  "<your partner accountId>"
}
```

```bash
curl -X POST https://sandbox-api.seismic.systems/v1/accounts/register \
  -H "x-access-token: $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":            "John Doe",
    "email":            "john.doe@example.com",
    "phone":            "+15551234567",
    "parentAccountId":  "5b8e2e93-0c4a-43b3-8e73-2f1ef0a3a9f1"
  }'
```

**Response (200):**

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "accountId":  "78ad30f2-5794-47c7-b413-62cc599ab203",
    "userId":     "1963922322985988097"
  }
}
```

**Save `accountId`** — you'll attach it to every subsequent call for this user, in your own database.

> **Idempotency:** if you call `register` with an email that already exists for the same `parentAccountId`, you'll get `40001 email already exists`. Look up the existing account first via `GET /v1/accounts?email=...`.

---

## Step 2. Submit KYC

Cards cannot be issued until the user has passed KYC. Seismic supports two flows:

1. **Bring your own KYC** — submit a verified Sumsub share token (recommended for partners with existing KYC pipelines).
2. **Hosted KYC** — request a hosted Seismic KYC link via the dashboard (consult your account manager).

This guide shows option 1.

```http
POST /v1/accounts/{accountId}/kyc
Host: sandbox-api.seismic.systems
x-access-token: <your access token>
Content-Type: application/json

{
  "sourceType":              "sumsub",
  "sumsubShareToken":        "_act-sbx-jwt-XXXXX...",
  "ipAddress":               "203.0.113.42",
  "occupation":              "11-1011",
  "annualSalary":            "75000 USD",
  "accountPurpose":          "Living Expense",
  "expectedMonthlyVolume":   "1000 USD"
}
```

The KYC submission is **asynchronous**. You'll receive a `KYC.UPDATED` webhook when the result is in (typically <2 minutes). You can also poll:

```bash
curl "https://sandbox-api.seismic.systems/v1/accounts/cdd/detail/$ACCOUNT_ID" \
  -H "x-access-token: $ACCESS_TOKEN"
```

**Response while in review:**

```json
{
  "code": "000000",
  "message": "success",
  "data": { "kyc": { "status": "PENDING", "caseId": "abc-123" } }
}
```

**Response when approved:**

```json
{
  "code": "000000",
  "message": "success",
  "data": { "kyc": { "status": "APPROVED" } }
}
```

| `status` | What it means |
|---|---|
| `PENDING` | Under review. Wait. |
| `APPROVED` | KYC passed. Continue to Step 3. |
| `REJECTED` | KYC failed. Inspect `caseId` in your KYC dashboard, ask the user for new documents, and resubmit. |
| `NONE` | No KYC submitted yet. |

---

## Step 3. Initialize the account

Once KYC is `APPROVED`, perform a one‑time initialization to provision the account's wallet (the USD Wallet that backs budgets) and unlock card issuance.

```http
POST /v1/accounts/{accountId}/init
Host: sandbox-api.seismic.systems
x-access-token: <your access token>
Content-Type: application/json

{}
```

**Response (200):**

```json
{ "code": "000000", "message": "success", "data": true }
```

> **Tip:** if you receive the `KYC.UPDATED` webhook with `status=APPROVED`, you can call this endpoint immediately from your webhook handler to remove a manual step.

The user is now onboarded. The next two sections (Phase B + Phase C) describe what happens **every time** that user requests a card. Phase B steps run once per user; Phase C runs per card.

---

# Phase B — Resource provisioning (once per user)

## Step 4. Create the cardholder

A cardholder is the persistent identity behind every card a user owns. **Create exactly one cardholder per user.** Re‑use the same `cardholderId` for all subsequent cards.

> Pick a stable `referenceId` (e.g. `your-app-ch-{userId}`) so you can detect duplicates if the request is retried.

```http
POST /v1/cardholders
Host: sandbox-api.seismic.systems
x-access-token: <your access token>
Idempotency-Key: 4b3f9e2c-0c4a-43b3-8e73-2f1ef0a3a9f1
Content-Type: application/json

{
  "accountId":         "78ad30f2-5794-47c7-b413-62cc599ab203",
  "binId":             "1997881966041939972",
  "businessModel":     "B2C_GATEWAY",
  "referenceId":       "yourapp-ch-user-12345",
  "firstName":         "John",
  "lastName":          "Doe",
  "email":             "john.doe@example.com",
  "phoneCountryCode":  "1",
  "phoneNumber":       "5551234567",
  "address": {
    "addressLine1":  "123 Main Street",
    "addressLine2":  "Apt 4B",
    "city":          "New York",
    "state":         "NY",
    "country":       "US",
    "postalCode":    "10001"
  }
}
```

**Response (200):**

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "id":               "1963922322985988097",
    "status":           "PENDING",
    "accountId":        "78ad30f2-5794-47c7-b413-62cc599ab203",
    "firstName":        "John",
    "lastName":         "Doe",
    "userName":         "John Doe",
    "email":            "john.doe@example.com",
    "phoneCountryCode": "1",
    "phoneNumber":      "5551234567",
    "referenceId":      "yourapp-ch-user-12345",
    "cardBinList":      ["1997881966041939972"]
  }
}
```

**Save `id`** as the user's `cardholderId`. You'll need it for every card issuance.

> **Cardholder rules**
>
> - **First + last name combined ≤ 23 characters** (including the space). This is a hard card‑network limit.
> - Letters only in names (A–Z, a–z). No accents, hyphens, or punctuation. Strip them client‑side before submitting.
> - `phoneCountryCode` is digits only — no `+`. Use `1`, not `+1`.
> - Phone numbers are validated against Google's `libphonenumber`. Use a working real number — `555` test numbers fail validation.
> - `country` must be the ISO 3166‑1 alpha‑2 code (`US`, `GB`, `DE`).
> - `state` for US/Canada must be the two‑letter subdivision (`NY`, `ON`).

The cardholder will move from `PENDING` → `APPROVED` typically within seconds. Subscribe to the `CARDHOLDER.UPDATED` webhook to be notified.

---

## Step 5. Create + fund a budget

A budget is the USD pool that backs your user's cards. Cards spend from the budget; if the budget is empty, authorizations decline.

### 5a. Create the budget

```http
POST /v1/budgets
Host: sandbox-api.seismic.systems
x-access-token: <your access token>
Idempotency-Key: 8a7c6e2d-1f4a-43b3-8e73-2f1ef0a3a9f1
Content-Type: application/json

{
  "accountId":  "78ad30f2-5794-47c7-b413-62cc599ab203",
  "name":       "John's main wallet",
  "currency":   "USD"
}
```

**Response (200):**

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "id":      "c0598084-16d9-4426-b98e-382166afb0eb",
    "balance": { "id": "0d13f168-339b-4b74-a412-07a6ababcd9c", "available": "0.00", "currency": "USD" },
    "status":  "ACTIVE"
  }
}
```

**Save `id`** as the user's `budgetId`.

### 5b. Fund the budget

A budget starts at $0. Move USD into it from your master merchant account before the user can spend.

```http
POST /v1/budgets/{budgetId}/transfer-in
Host: sandbox-api.seismic.systems
x-access-token: <your access token>
Idempotency-Key: f4e6c2a1-1f4a-43b3-8e73-2f1ef0a3a9f1
Content-Type: application/json

{
  "clientTransactionId":  "yourapp-fund-{uuid}",
  "amount":               "100.00",
  "accountId":            "78ad30f2-5794-47c7-b413-62cc599ab203"
}
```

> **Where does the money come from?**
> The funds are pulled from the user's *USD Wallet* — Seismic's per‑sub‑account USD wallet. To top up the USD Wallet from your master merchant pool, use `POST /v1/business/transfer/external` (see [API Reference → Inter‑account transfers](/api-reference#inter-account-transfers)). Most partners run both transfers in sequence whenever a user deposits funds.

**Response (200):**

```json
{ "code": "000000", "message": "success", "data": { "transactionId": "..." } }
```

To verify, fetch the budget back:

```bash
curl "https://sandbox-api.seismic.systems/v1/budgets/$BUDGET_ID?accountId=$ACCOUNT_ID" \
  -H "x-access-token: $ACCESS_TOKEN"
```

```json
{
  "code": "000000",
  "data": { "id": "...", "balance": { "available": "100.00", "currency": "USD" }, "status": "ACTIVE" }
}
```

---

# Phase C — Card issuance

## Step 6. Issue the virtual card

This is the only call you repeat per card. Pass the `accountId`, `binId`, `cardholderId`, and `budgetId` from the previous steps. The card is created instantly in `ACTIVE` status, ready for online purchases.

```http
POST /v1/budget-card
Host: sandbox-api.seismic.systems
x-access-token: <your access token>
Idempotency-Key: 9c8b7a6e-1f4a-43b3-8e73-2f1ef0a3a9f1
Content-Type: application/json

{
  "accountId":     "78ad30f2-5794-47c7-b413-62cc599ab203",
  "binId":         "1997881966041939972",
  "cardMode":      "VIRTUAL_CARD",
  "cardholderId":  "1963922322985988097",
  "budgetId":      "c0598084-16d9-4426-b98e-382166afb0eb",
  "referenceId":   "yourapp-card-12345-1714000000",
  "label":         "Primary card"
}
```

**Response (200):**

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "id":              "d8eda079-6ba7-409e-99c8-ab5f83566fbd",
    "accountId":       "78ad30f2-5794-47c7-b413-62cc599ab203",
    "userName":        "John Doe",
    "currency":        "USD",
    "bin":             "411111",
    "status":          "ACTIVE",
    "cardLastFour":    "4567",
    "label":           "Primary card",
    "balanceId":       "0d13f168-339b-4b74-a412-07a6ababcd9c",
    "budgetId":        "c0598084-16d9-4426-b98e-382166afb0eb",
    "cardholderId":    "1963922322985988097",
    "referenceId":     "yourapp-card-12345-1714000000",
    "cardMode":        "VIRTUAL_CARD",
    "createTime":      "1710813276127",
    "billingAddress": {
      "addressLine1": "123 Main Street",
      "addressLine2": "Apt 4B",
      "city":         "New York",
      "state":        "NY",
      "country":      "US",
      "postalCode":   "10001"
    },
    "transactionLimits": []
  }
}
```

**Save `id`** as the user's `cardId`. This is what you'll reference for freeze/unfreeze, sensitive data, transactions, and lifecycle.

| Request field | Required | Description |
|---|---|---|
| `accountId` | Yes | UUID of the user's sub‑account. |
| `binId` | Yes | UUID of the BIN to issue from. Must be a `type: 0` (Budget) BIN. |
| `cardMode` | Yes | `VIRTUAL_CARD` (digital‑only) or `PHYSICAL_CARD` (mailed plastic — requires additional onboarding). |
| `cardholderId` | Yes | UUID from Step 4. |
| `budgetId` | Yes | UUID from Step 5. |
| `referenceId` | Yes | **Your** unique identifier. Must be globally unique — re‑using one fails with `40001`. We recommend `your-prefix-{userId}-{timestamp}`. |
| `label` | No | Human‑readable card name shown in the merchant portal. Up to 50 chars. |
| `useType` | No | Free‑form tag, e.g. `"Online advertising"`, `"Travel"`. Useful for reporting. |

| Response field | Description |
|---|---|
| `id` | The Seismic card UUID. Persist this. |
| `cardLastFour` | Last 4 digits of the PAN. Safe to display. |
| `bin` | First 6 digits. Safe to display. |
| `status` | `ACTIVE`, `INACTIVE`, `CONTROL`, `PENDING`, or `FROZEN`. |
| `transactionLimits` | Array of velocity limits. Empty by default — call [`PUT /v1/cards/{cardId}/velocity-control`](/api-reference#set-velocity-control) to add one. |

---

# Post‑issuance: making the card useful

The card is now `ACTIVE` and chargeable. To complete the user experience:

| Goal | How |
|---|---|
| Show full PAN, CVV, expiry on your app | [PCI Widget](/pci-widget) — load `Seismic Widget.js` in an iframe with a 5‑minute access token. |
| Receive real‑time spend events | [Webhooks](/webhooks) — subscribe to `CARD_TRANSACTION.CREATED` and `CARD_TRANSACTION.UPDATED`. |
| Set per‑card spending limits | `PUT /v1/cards/{cardId}/velocity-control` with `limitType` (`DAY`, `MONTH`, `LIFETIME`, …) and `amount`. See [API Reference](/api-reference#set-velocity-control). |
| Let the user freeze the card | `POST /v1/cards/{cardId}/freeze` and `POST /v1/cards/{cardId}/unfreeze`. |
| Pull a transaction history | `GET /v1/cards/transaction-list?cardId={cardId}&accountId={accountId}`. |
| Top up before a big purchase | `POST /v1/budgets/{budgetId}/transfer-in` (Step 5b). |
| Cancel the card permanently | `DELETE /v1/cards/{cardId}?accountId={accountId}`. |

---

# Putting it all together — a one‑file Node.js script

```ts
import axios from "axios";
import { v4 as uuid } from "uuid";

const BASE = "https://sandbox-api.seismic.systems";
const CLIENT_ID     = process.env.SEISMIC_CLIENT_ID!;
const CLIENT_SECRET = process.env.SEISMIC_CLIENT_SECRET!;
const PARENT_ACCT   = process.env.SEISMIC_PARENT_ACCOUNT_ID!;
const BIN_ID        = process.env.SEISMIC_BIN_ID!;

async function token() {
  const code = (await axios.get(`${BASE}/v1/oauth/authorize`, { params: { clientId: CLIENT_ID } })).data.data.code;
  const tok  = (await axios.post(`${BASE}/v1/oauth/access-token`, {
    clientId: CLIENT_ID, clientSecret: CLIENT_SECRET, code,
  })).data.data.accessToken;
  return tok;
}

async function issueCard(user: {
  firstName: string; lastName: string; email: string; phoneCountryCode: string; phoneNumber: string;
  address: { addressLine1: string; city: string; state: string; country: string; postalCode: string };
}) {
  const access = await token();
  const H = { "x-access-token": access, "Content-Type": "application/json" };

  // 1. sub-account
  const acct = (await axios.post(`${BASE}/v1/accounts/register`, {
    name: `${user.firstName} ${user.lastName}`, email: user.email, parentAccountId: PARENT_ACCT,
  }, { headers: H })).data.data;

  // 2 + 3. submit KYC + wait for approval (omitted — see Step 2/3 above).

  // 4. cardholder
  const ch = (await axios.post(`${BASE}/v1/cardholders`, {
    accountId: acct.accountId, binId: BIN_ID, businessModel: "B2C_GATEWAY",
    referenceId: `yourapp-ch-${acct.accountId}`, ...user,
  }, { headers: { ...H, "Idempotency-Key": uuid() } })).data.data;

  // 5a. budget
  const budget = (await axios.post(`${BASE}/v1/budgets`, {
    accountId: acct.accountId, name: `${user.firstName}'s wallet`, currency: "USD",
  }, { headers: { ...H, "Idempotency-Key": uuid() } })).data.data;

  // 5b. fund budget
  await axios.post(`${BASE}/v1/budgets/${budget.id}/transfer-in`, {
    clientTransactionId: uuid(), amount: "100.00", accountId: acct.accountId,
  }, { headers: H });

  // 6. card
  const card = (await axios.post(`${BASE}/v1/budget-card`, {
    accountId: acct.accountId, binId: BIN_ID, cardMode: "VIRTUAL_CARD",
    cardholderId: ch.id, budgetId: budget.id,
    referenceId: `yourapp-card-${acct.accountId}-${Date.now()}`, label: "Primary card",
  }, { headers: { ...H, "Idempotency-Key": uuid() } })).data.data;

  return { accountId: acct.accountId, cardId: card.id, last4: card.cardLastFour, bin: card.bin };
}
```

---

# Common pitfalls

| Pitfall | Avoid by |
|---|---|
| Issuing a card before KYC is `APPROVED` | Subscribe to `KYC.UPDATED` webhook, gate `POST /v1/budget-card` on the cached status. |
| Using non‑US/CA two‑letter state codes | Pass the country name itself (or a recognized region) for non‑US/CA addresses. |
| Re‑using a `referenceId` | Always generate a fresh UUID; we recommend `{prefix}-{userId}-{timestamp}`. |
| Forgetting `Idempotency-Key` on retries | Always include one on `POST` to mutating endpoints; re‑use the same key on retry. |
| Card declines despite a positive budget | Check (a) card is not `FROZEN`; (b) velocity limits aren't exhausted; (c) merchant network supports the BIN; (d) cardholder is not `INACTIVE`. |
| Accent‑letter names being rejected | Strip diacritics before sending: `José` → `Jose`. |

Continue to **[API Reference →](/api-reference)** for every endpoint.

# API Reference

Complete reference for every endpoint in the Seismic Cards API v1.

**Base URL (Sandbox):** `https://sandbox-api.seismic-cards.systems`  
**Base URL (Production):** `https://api.seismic-cards.systems`  
**Auth:** `x-access-token: <token>` on every authenticated request  
**Content type:** `application/json`

---

## Table of Contents

- [Authentication](#authentication)
  - [Get an authorization code](#get-an-authorization-code)
  - [Generate an access token](#generate-an-access-token)
- [Accounts](#accounts)
  - [Create a sub‑account](#create-a-sub-account)
  - [Find an account by email](#find-an-account-by-email)
  - [Submit KYC](#submit-kyc)
  - [Get KYC / CDD status](#get-kyc--cdd-status)
  - [Initialize the account](#initialize-the-account)
- [Cardholders](#cardholders)
  - [Create a cardholder](#create-a-cardholder)
  - [List cardholders](#list-cardholders)
  - [Get a cardholder](#get-a-cardholder)
  - [Update a cardholder](#update-a-cardholder)
- [BINs](#bins)
  - [List available BINs](#list-available-bins)
- [Budgets](#budgets)
  - [Create a budget](#create-a-budget)
  - [Get a budget](#get-a-budget)
  - [Fund a budget (transfer‑in)](#fund-a-budget-transfer-in)
  - [Withdraw from a budget (transfer‑out)](#withdraw-from-a-budget-transfer-out)
- [Inter‑account transfers](#inter-account-transfers)
  - [Transfer between accounts](#transfer-between-accounts)
  - [List wallets / USD Wallet balance](#list-wallets--usd-wallet-balance)
- [Cards](#cards)
  - [Create a budget card](#create-a-budget-card)
  - [Get card details](#get-card-details)
  - [Get card sensitive data (server‑side)](#get-card-sensitive-data-server-side)
  - [Get card access token (for the PCI widget)](#get-card-access-token-for-the-pci-widget)
  - [Update card label](#update-card-label)
  - [Set velocity control](#set-velocity-control)
  - [Freeze a card](#freeze-a-card)
  - [Unfreeze a card](#unfreeze-a-card)
  - [Delete a card](#delete-a-card)
- [Card transactions](#card-transactions)
  - [List card transactions](#list-card-transactions)

---

# Authentication

## Get an authorization code

```http
GET /v1/oauth/authorize?clientId={clientId}
```

**Query parameters**

| Name | Required | Type | Description |
|---|---|---|---|
| `clientId` | Yes | string | Your Seismic program's client ID. |

**Response 200**

```json
{
  "code": "000000",
  "message": "success",
  "data": { "code": "8655cf76c744615b57e631216ee006df", "timestamp": 1758169263 }
}
```

The returned `data.code` is a single‑use ticket. Exchange it within **10 minutes** at the next endpoint.

---

## Generate an access token

```http
POST /v1/oauth/access-token
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `clientId` | Yes | string | Your Seismic program's client ID. |
| `clientSecret` | Yes | string | Your Seismic program's secret. **Server‑side only.** |
| `code` | Yes | string | The authorization code from the previous endpoint. |

**Response 200**

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

The `accessToken` is valid for `expiresIn` seconds (default `86400` / 24 h). Cache it server‑side.

---

# Accounts

## Create a sub‑account

```http
POST /v1/accounts/register
x-access-token: <token>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `name` | Yes | string | Display name for the sub‑account (typically the user's full name). |
| `email` | Yes | string | User's email. Must be unique within your `parentAccountId`. |
| `phone` | No | string | E.164 format with `+` (e.g. `+15551234567`). |
| `parentAccountId` | Yes | string (UUID) | Your top‑level partner account UUID. |

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "accountId":  "78ad30f2-5794-47c7-b413-62cc599ab203",
    "userId":     "1963922322985988097"
  }
}
```

---

## Find an account by email

```http
GET /v1/accounts?email={email}
x-access-token: <token>
```

Returns up to one row per email per `parentAccountId`. Useful for de‑duplicating retries.

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "list": [
      {
        "id":              "78ad30f2-5794-47c7-b413-62cc599ab203",
        "status":          "ACTIVE",
        "parentAccountId": "5b8e2e93-0c4a-43b3-8e73-2f1ef0a3a9f1"
      }
    ]
  }
}
```

---

## Submit KYC

```http
POST /v1/accounts/{accountId}/kyc
x-access-token: <token>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `sourceType` | Yes | string | `"sumsub"` for Sumsub‑sourced KYC. |
| `sumsubShareToken` | Yes | string | Verified Sumsub share token (`_act-sbx-jwt-...`). |
| `ipAddress` | No | string | User's real IP. Helps fraud scoring. |
| `occupation` | No | string | Occupation code (e.g. `11-1011`). |
| `annualSalary` | No | string | E.g. `"75000 USD"`. |
| `accountPurpose` | No | string | E.g. `"Living Expense"`. |
| `expectedMonthlyVolume` | No | string | E.g. `"1000 USD"`. |

**Response 200**

```json
{ "code": "000000", "data": "Submitted" }
```

The decision arrives via the `KYC.UPDATED` webhook (typically <2 min).

---

## Get KYC / CDD status

```http
GET /v1/accounts/cdd/detail/{accountId}
x-access-token: <token>
```

**Response 200**

```json
{ "code": "000000", "data": { "kyc": { "status": "APPROVED", "caseId": "abc-123" } } }
```

| `status` | Meaning |
|---|---|
| `NONE` | No KYC submitted. |
| `PENDING` | Under review. |
| `APPROVED` | Cleared. The user can now be initialized and issued cards. |
| `REJECTED` | Failed. Inspect `caseId` and resubmit. |

---

## Initialize the account

```http
POST /v1/accounts/{accountId}/init
x-access-token: <token>
Content-Type: application/json

{}
```

Provisions the user's USD Wallet (USD wallet) and unlocks card issuance. Call this **once** per user, after KYC is `APPROVED`.

**Response 200**

```json
{ "code": "000000", "data": true }
```

---

# Cardholders

## Create a cardholder

Create exactly **one** cardholder per user. Re‑use its `id` for every card you issue to that user.

```http
POST /v1/cardholders
x-access-token: <token>
Idempotency-Key: <uuid>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `accountId` | Yes | string (UUID) | The user's sub‑account. |
| `binId` | Yes | string | UUID of the BIN (from `GET /v1/card/bins`). |
| `businessModel` | Yes | string | `"B2C_GATEWAY"` for consumer card programs. |
| `referenceId` | Yes | string | **Your** unique identifier per cardholder, e.g. `yourapp-ch-{userId}`. |
| `firstName` | Yes | string | A–Z only. Combined with `lastName` (incl. space) ≤ 23 chars. |
| `lastName` | Yes | string | A–Z only. |
| `email` | Yes | string | User's email. |
| `phoneCountryCode` | Yes | string | Digits only — no `+`. (`1`, not `+1`.) |
| `phoneNumber` | Yes | string | Without country code, ≤ 15 digits. |
| `address` | Yes | object | See below. |
| `address.addressLine1` | Yes | string | Street address. ASCII letters/digits/symbols. |
| `address.addressLine2` | No | string | Apartment / unit. |
| `address.city` | Yes | string | English letters and spaces only. |
| `address.state` | Yes | string | US/CA: two‑letter code (`NY`, `ON`). Otherwise: region name. |
| `address.country` | Yes | string | ISO 3166‑1 alpha‑2 (`US`, `GB`). |
| `address.postalCode` | Yes | string | ZIP / postal code. |

**Response 200**

```json
{
  "code": "000000",
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

Cardholder `status` transitions: `PENDING` → `APPROVED` (within seconds — listen for `CARDHOLDER.UPDATED`).

---

## List cardholders

```http
GET /v1/cardholders?accountId={accountId}
x-access-token: <token>
```

Returns all cardholders under a sub‑account. Useful for resolving "did I already create one?" before retrying.

---

## Get a cardholder

```http
GET /v1/cardholders/{cardholderId}?accountId={accountId}
x-access-token: <token>
```

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "id":        "1963922322985988097",
    "status":    "APPROVED",
    "firstName": "John",
    "lastName":  "Doe",
    "address":   { "addressLine1": "...", "city": "...", "state": "NY", "country": "US", "postalCode": "..." }
  }
}
```

> **Note:** `accountId` is a required query parameter on this endpoint. Omitting it returns 400.

---

## Update a cardholder

```http
PATCH /v1/cardholders/{cardholderId}
x-access-token: <token>
Content-Type: application/json
```

**Request body** — include only the fields you want to change. `accountId` is always required.

| Field | Type | Description |
|---|---|---|
| `accountId` | string | Required. |
| `email` | string | New email. (BB / BZ BINs only.) |
| `phoneCountryCode` | string | New country code. (Other BINs only.) |
| `phoneNumber` | string | New phone number. |
| `firstName` | string | If supported by your BIN. |
| `lastName` | string | If supported by your BIN. |
| `address` | object | Address change — limited support; contact support if you hit `010002`. |

---

# BINs

## List available BINs

```http
GET /v1/card/bins?accountId={accountId}
x-access-token: <token>
```

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "list": [
      {
        "id":                  "1997881966041939972",
        "bin":                 "411111",
        "type":                0,
        "currencies":          ["USD"],
        "network":             "VISA",
        "supportPhysicalCard": false
      }
    ]
  }
}
```

| `type` | Meaning |
|---|---|
| `0` | **Budget BIN.** Used in this guide. Cards spend from a budget. |
| `1` | Prepaid BIN. Cards spend from a balance attached directly to the cardholder. |

---

# Budgets

## Create a budget

```http
POST /v1/budgets
x-access-token: <token>
Idempotency-Key: <uuid>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `accountId` | Yes | string (UUID) | The user's sub‑account. |
| `name` | Yes | string | Internal label for the budget. |
| `currency` | No | string | Currently `"USD"` only (default). |

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "id":      "c0598084-16d9-4426-b98e-382166afb0eb",
    "balance": { "id": "0d13f168-339b-4b74-a412-07a6ababcd9c", "available": "0.00", "currency": "USD" },
    "status":  "ACTIVE"
  }
}
```

---

## Get a budget

```http
GET /v1/budgets/{budgetId}?accountId={accountId}
x-access-token: <token>
```

Returns the same shape as `Create a budget`, with the current `balance.available`.

---

## Fund a budget (transfer‑in)

Move funds from the user's USD Wallet to a budget.

```http
POST /v1/budgets/{budgetId}/transfer-in
x-access-token: <token>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `clientTransactionId` | Yes | string | Your idempotency key for this transfer. UUID v4 recommended. |
| `amount` | Yes | string | USD amount, up to 2 decimal places. E.g. `"100.00"`. |
| `accountId` | Yes | string (UUID) | The user's sub‑account. |

**Response 200**

```json
{ "code": "000000", "data": { "transactionId": "..." } }
```

---

## Withdraw from a budget (transfer‑out)

Pull funds back from a budget to the user's USD Wallet.

```http
POST /v1/budgets/{budgetId}/transfer-out
x-access-token: <token>
Content-Type: application/json
```

Same body as `transfer‑in`. The `amount` cannot exceed `balance.available` minus any locked funds.

---

# Inter‑account transfers

## Transfer between accounts

Move funds between USD Wallets (e.g. master merchant → user, or user → master). Used to top up user wallets before funding their budgets.

```http
POST /v1/business/transfer/external
x-access-token: <token>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `clientTransactionId` | Yes | string | Idempotency key (UUID v4). |
| `amount` | Yes | string | USD amount. |
| `from.accountId` | Yes | string (UUID) | Source account. |
| `from.id` | Yes | string (UUID) | Source USD Wallet balance ID — see [List wallets](#list-wallets--usd-wallet-balance). |
| `from.currency` | Yes | string | `"USD"`. |
| `from.businessType` | No | int | `0` (default). |
| `to.accountId` | Yes | string (UUID) | Destination account. |
| `to.id` | Yes | string (UUID) | Destination USD Wallet balance ID. |
| `to.currency` | Yes | string | `"USD"`. |

**Response 200**

```json
{ "code": "000000", "data": { "transactionId": "..." } }
```

---

## List wallets / USD Wallet balance

```http
GET /v1/cards/wallets?accountId={accountId}
x-access-token: <token>
```

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "list": [
      {
        "id":         "0d13f168-339b-4b74-a412-07a6ababcd9c",
        "objectType": 0,
        "available":  "100.00",
        "currency":   "USD"
      }
    ]
  }
}
```

| `objectType` | Meaning |
|---|---|
| `0` | The USD Wallet (USD wallet) — use `id` as the `from.id` / `to.id` in inter‑account transfers. |

---

# Cards

## Create a budget card

The headline endpoint — issue a virtual Visa card.

```http
POST /v1/budget-card
x-access-token: <token>
Idempotency-Key: <uuid>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `accountId` | Yes | string (UUID) | The user's sub‑account. |
| `binId` | Yes | string | UUID of the BIN to issue from (must be `type: 0`). |
| `cardMode` | Yes | string | `"VIRTUAL_CARD"` or `"PHYSICAL_CARD"`. |
| `cardholderId` | Yes | string | UUID of the user's cardholder. |
| `budgetId` | Yes | string (UUID) | UUID of the budget that backs this card. |
| `referenceId` | Yes | string | **Your** unique identifier for this card. Globally unique. |
| `label` | No | string | Display name for the card (e.g. `"Travel"`). ≤ 50 chars. |
| `useType` | No | string | Free‑form tag for reporting. |
| `physicalCardDesignId` | No | string | Required when `cardMode = PHYSICAL_CARD`. |

**Response 200**

```json
{
  "code": "000000",
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
    "billingAddress":  { "addressLine1": "...", "city": "...", "state": "NY", "country": "US", "postalCode": "..." },
    "transactionLimits": []
  }
}
```

---

## Get card details

Fetch a card by ID.

```http
GET /v1/card-list?accountId={accountId}&cardId={cardId}
x-access-token: <token>
```

Returns a paginated list — when filtered by `cardId`, it's at most one row.

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "list": [
      {
        "id":           "d8eda079-6ba7-409e-99c8-ab5f83566fbd",
        "status":       "ACTIVE",
        "cardLastFour": "4567",
        "bin":          "411111",
        "label":        "Primary card",
        "transactionLimits": [
          { "type": "MONTH", "value": "500", "currency": "USD" }
        ]
      }
    ]
  }
}
```

---

## Get card sensitive data (server‑side)

> **Strongly recommended:** use the [PCI Widget](/pci-widget) instead. It loads card details directly into iframes inside your client app, so your servers never touch raw card data.

For server‑side use cases (e.g. test scripts), this endpoint returns the masked or unmasked card details depending on your program's PCI configuration:

```http
GET /v1/cards/{cardId}?accountId={accountId}
x-access-token: <token>
```

**Response 200** (shape varies by PCI permissions)

```json
{
  "code": "000000",
  "data": {
    "id":           "d8eda079-6ba7-409e-99c8-ab5f83566fbd",
    "cardNumber":   "4111111111114567",
    "expiryDate":   "12/29",
    "cvv":          "123"
  }
}
```

---

## Get card access token (for the PCI widget)

Returns a short‑lived (≈ 5 min) JWT to bootstrap `Seismic Widget.js` in a client browser/WebView.

```http
GET /v1/cards/{cardId}/private-info/access-token?accountId={accountId}
x-access-token: <token>
```

**Response 200**

```json
{
  "code": "000000",
  "data": { "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJjYXJkSWQiOiI..." }
}
```

See [PCI Widget](/pci-widget) for how to use this token in your iOS / Android / web client.

---

## Update card label

```http
PUT /v1/cards/{cardId}
x-access-token: <token>
Content-Type: application/json

{
  "accountId":  "78ad30f2-5794-47c7-b413-62cc599ab203",
  "label":      "Travel card"
}
```

---

## Set velocity control

Apply a per‑card spending limit.

```http
PUT /v1/cards/{cardId}/velocity-control
x-access-token: <token>
Content-Type: application/json
```

**Request body**

| Field | Required | Type | Description |
|---|---|---|---|
| `accountId` | Yes | string (UUID) | The user's sub‑account. |
| `transactionLimitsType` | Yes | string | One of: `TRANSACTION`, `DAY`, `WEEK`, `MONTH`, `QUARTER`, `YEAR`, `LIFETIME`, `NA`. |
| `amountLimit` | Yes | string | USD limit, up to 2 decimal places. E.g. `"500.00"`. |

> Limits reset at 00:00 GMT+8 for periodic types (`DAY`, `WEEK`, `MONTH`, etc.). Use `LIFETIME` for absolute caps that never reset.

---

## Freeze a card

Temporarily decline all future authorizations. Existing settled charges are unaffected.

```http
POST /v1/cards/{cardId}/freeze
x-access-token: <token>
Content-Type: application/json

{ "accountId": "78ad30f2-5794-47c7-b413-62cc599ab203" }
```

**Response 200**

```json
{ "code": "000000", "data": { "status": "FROZEN" } }
```

---

## Unfreeze a card

```http
POST /v1/cards/{cardId}/unfreeze
x-access-token: <token>
Content-Type: application/json

{ "accountId": "78ad30f2-5794-47c7-b413-62cc599ab203" }
```

---

## Delete a card

Permanently close a card. Irreversible.

```http
DELETE /v1/cards/{cardId}?accountId={accountId}
x-access-token: <token>
```

---

# Card transactions

## List card transactions

Returns authorizations, settlements, refunds, and reversals for one card.

```http
GET /v1/cards/transaction-list?accountId={accountId}&cardId={cardId}&page=1&limit=50
x-access-token: <token>
```

**Query parameters**

| Name | Required | Type | Description |
|---|---|---|---|
| `accountId` | Yes | string (UUID) | The user's sub‑account. |
| `cardId` | Yes | string (UUID) | The card. |
| `page` | No | int | Default `1`. |
| `limit` | No | int | Default `50`, max `100`. |
| `id` | No | string | Filter by a single transaction UUID. |
| `clientTransactionId` | No | string | Filter by your client transaction ID. |
| `type` | No | string | Transaction type code (e.g. `"1"` = Consumption). |
| `status` | No | string | `CLOSED` / `PENDING` / `FAIL`. |
| `startTime` | No | string | Lower bound (Unix timestamp, ms). Default: 180 days ago. |
| `endTime` | No | string | Upper bound. Default: end of today. |

**Response 200**

```json
{
  "code": "000000",
  "data": {
    "page":      1,
    "limit":     50,
    "total":     12,
    "list": [
      {
        "id":                  "tx_abcdef123456",
        "cardId":              "d8eda079-6ba7-409e-99c8-ab5f83566fbd",
        "amount":              "12.50",
        "currency":            "USD",
        "merchantName":        "AMZN Mktp US",
        "merchantCategoryCode":"5942",
        "status":              "CLOSED",
        "type":                "1",
        "createTime":          "1710813276127"
      }
    ]
  }
}
```

| `status` | Meaning |
|---|---|
| `PENDING` | Authorization placed; not yet captured. |
| `CLOSED` | Settled (captured). Money has moved. |
| `FAIL` | Decline. |

> **Tip:** for real‑time updates, subscribe to the `CARD_TRANSACTION.CREATED` and `CARD_TRANSACTION.UPDATED` [webhooks](/webhooks) instead of polling.

# Seismic Cards API

Issue Visa / Mastercard virtual cards to your end users in minutes. Seismic's Cards API gives you a programmatic, PCI‑compliant card issuing platform — sub‑accounts, KYC, cardholders, funding budgets, virtual card creation, spend webhooks, and a drop‑in widget for displaying full card details on your own UI.

> **Version:** v1 (current)  
> **Base URL (Production):** `https://api.seismic-cards.systems`  
> **Base URL (Sandbox):**     `https://sandbox-api.seismic-cards.systems`  
> **Auth:** OAuth 2.0 (Client Credentials → short‑lived access token)  
> **Format:** `application/json` for all requests and responses

---

## Table of Contents

1. [Getting Started](/getting-started) — environments, OAuth flow, headers, your first API call.
2. [Issuing a Card (End‑to‑End)](/issuing-a-card) — the full lifecycle from a brand‑new user to a usable virtual card.
3. [API Reference](/api-reference) — every endpoint with request/response examples.
4. [Webhooks](/webhooks) — real‑time card transaction, KYC, and cardholder events.
5. [PCI Widget — Display PAN / CVV / Expiry](/pci-widget) — securely render full card details on your own UI without ever touching raw card data.
6. [Error Codes](/errors) — full error code reference.

---

## What you can do with the Seismic Cards API

| Capability | Description |
|---|---|
| **Sub‑account provisioning** | Create one Seismic sub‑account per end user. Each sub‑account is the legal "envelope" that owns the user's cardholder, budget, and cards. |
| **KYC / KYB** | Submit identity verification (via supported KYC providers or Seismic's hosted flow). KYC must pass before a card can be issued. |
| **Cardholder management** | Create one persistent cardholder profile per user. Update phone, email, name. |
| **Budgets** | Per‑user funding pools that back cards. Top up and withdraw on demand. |
| **Virtual card issuance** | Issue Visa or Mastercard virtual cards (`VIRTUAL_CARD`). Up to `N` cards per user (configurable). |
| **Card lifecycle** | Freeze, unfreeze, rename, and delete cards. |
| **Spending controls** | Set per‑card velocity limits (per transaction, daily, weekly, monthly, quarterly, yearly, lifetime). |
| **PCI display widget** | Show full PAN / CVV / expiry in your iOS, Android, or web app inside an iframe — your servers never touch raw card data. |
| **Real‑time webhooks** | Card authorizations, KYC status updates, cardholder events. HMAC‑SHA256 signed. |
| **Transactions** | List card authorizations and settled transactions, with merchant name, MCC, amount, and status. |

---

## Architecture overview

Seismic's card platform is a **two‑tier hierarchy**:

```
┌─────────────────────────────────────────────────────────────────┐
│                  YOUR PARTNER ACCOUNT (you)                     │
│  parentAccountId — held by you, the program operator            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │   USER SUB‑ACCOUNT (one per end user)                   │    │
│  │   accountId — provisioned via /v1/accounts/register     │    │
│  │                                                         │    │
│  │   ┌──────────────┐  ┌──────────────┐                    │    │
│  │   │  Cardholder  │  │    Budget    │                    │    │
│  │   │  (1 per user)│  │  (USD pool)  │                    │    │
│  │   └──────┬───────┘  └──────┬───────┘                    │    │
│  │          └──────┬──────────┘                            │    │
│  │                 ▼                                       │    │
│  │           ┌────────────┐                                │    │
│  │           │ Virtual    │   1..N per user                │    │
│  │           │ Card(s)    │                                │    │
│  │           └────────────┘                                │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

- **Your partner account** is created by Seismic during onboarding. You receive a `clientId`, `clientSecret`, `parentAccountId`, and a `merchantId`.
- **One sub‑account per end user.** Every cardholder, budget, and card lives under exactly one user sub‑account.
- **One cardholder per user.** All of a user's cards share one cardholder identity (their KYC'd persona).
- **One or more budgets per user.** Cards spend from the budget they're attached to. The budget must be funded before authorizations can succeed.
- **Many cards per user.** Each card is `VIRTUAL_CARD` by default and inherits the cardholder's identity and the budget's balance.

---

## Card issuance — the canonical flow

Every card you issue follows this 6‑step path. Steps 1–3 happen **once per user**. Steps 4–6 happen **every time you issue a new card** for that user.

```
                                                                          
   ┌─────────────────────────┐                                            
1. │  Authenticate           │  POST /v1/oauth/access-token               
   │  → access token (24h)   │                                            
   └────────────┬────────────┘                                            
                │                                                         
                ▼                                                         
   ┌─────────────────────────┐                                            
2. │  Create sub‑account     │  POST /v1/accounts/register                
   │  for the end user       │                                            
   └────────────┬────────────┘                                            
                │                                                         
                ▼                                                         
   ┌─────────────────────────┐                                            
3. │  Submit KYC             │  POST /v1/accounts/{accountId}/kyc         
   │  Wait for APPROVED      │  (webhook: KYC.UPDATED)                    
   │  Initialize account     │  POST /v1/accounts/{accountId}/init        
   └────────────┬────────────┘                                            
                │                                                         
                ▼                                                         
   ┌─────────────────────────┐                                            
4. │  Resolve a BIN          │  GET  /v1/card/bins                        
   │  Create cardholder      │  POST /v1/cardholders         (once)       
   │  Create budget          │  POST /v1/budgets             (once)       
   └────────────┬────────────┘                                            
                │                                                         
                ▼                                                         
   ┌─────────────────────────┐                                            
5. │  Fund the budget        │  POST /v1/budgets/{id}/transfer-in         
   └────────────┬────────────┘                                            
                │                                                         
                ▼                                                         
   ┌─────────────────────────┐                                            
6. │  Issue virtual card     │  POST /v1/budget-card                      
   │  → cardId, last 4, BIN  │                                            
   └─────────────────────────┘                                            
```

Once issued, a card is `ACTIVE` and ready to be used for online purchases. Use the [PCI widget](/pci-widget) to render full card details on your UI, and consume [webhooks](/webhooks) to track authorizations in real time.

For the full step‑by‑step walkthrough with copy‑paste cURL examples, see **[Issuing a Card](/issuing-a-card)**.

---

## Quick start

### 1. Get your credentials

After contracting with Seismic, you'll receive:

| Credential | What it is |
|---|---|
| `clientId` | Public identifier for your program. |
| `clientSecret` | Secret used to mint access tokens. **Never expose to clients.** |
| `parentAccountId` | UUID of your top‑level partner account. Pass this when creating user sub‑accounts. |
| `merchantId` | UUID of your master merchant account. Used for inter‑account funding transfers. |
| `defaultBinId` | UUID of the BIN your program is authorized to issue from. |
| `webhookSecret` | Used to verify `Signature` HMAC on incoming webhooks. |

### 2. Authenticate

```bash
# Step A: exchange clientId for a short-lived authorization code
curl "https://sandbox-api.seismic-cards.systems/v1/oauth/authorize?clientId=YOUR_CLIENT_ID"

# Step B: exchange code + secret for an access token (valid 24 hours)
curl -X POST https://sandbox-api.seismic-cards.systems/v1/oauth/access-token \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "YOUR_CLIENT_ID",
    "clientSecret": "YOUR_CLIENT_SECRET",
    "code": "8655cf76c744615b57e631216ee006df"
  }'
```

Response:

```json
{
  "code": "000000",
  "message": "success",
  "data": {
    "accessToken": "6da5bf8a64b34ea30cfb75a6a5e8a9a28a59b8a3",
    "refreshToken": "560d8accee67fb932688e568feca86c6b3866c4a858dce01b4cd66a73d7cc35a",
    "expiresIn": 86400,
    "timestamp": 1758169264
  }
}
```

### 3. Make your first authenticated call

Pass `x-access-token` on every subsequent request:

```bash
curl https://sandbox-api.seismic-cards.systems/v1/card/bins?accountId=YOUR_PARENT_ACCOUNT_ID \
  -H "x-access-token: 6da5bf8a64b34ea30cfb75a6a5e8a9a28a59b8a3"
```

That's it — you're now authenticated and can issue cards. Continue with **[Getting Started](/getting-started)** for full details, or jump straight to the **[card issuance walkthrough](/issuing-a-card)**.

---

## Conventions used throughout these docs

- All requests and responses are `application/json`. UTF‑8 only.
- Successful responses always have shape:

  ```json
  { "code": "000000", "message": "success", "data": { ... } }
  ```

- Error responses always have shape:

  ```json
  { "code": "40001", "message": "Invalid parameter" }
  ```

  See **[Error Codes](/errors)** for the full list.

- All amounts are USD strings with up to 2 decimal places (e.g. `"100.00"`, `"0.50"`).
- All timestamps are Unix milliseconds (string) unless noted otherwise.
- All UUIDs are v4. `referenceId` is **your** chosen idempotency key per resource — keep it unique per request.
- Mutating endpoints (`POST` to create/transfer) require an `Idempotency-Key` header — a UUID v4 you choose. Same key + same body = same response, safe to retry.

---

## Support

- **Sandbox dashboard:** _provided by your account manager during onboarding_
- **Status page:** `https://status.seismic-cards.systems`
- **Email:** `support@seismic-cards.systems`
- **Production access:** complete sandbox integration, then request production credentials.

---

© Seismic Systems, Inc. All rights reserved. PCI DSS Level 1 certified.

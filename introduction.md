# Seismic Cards API

Issue branded virtual cards in minutes. Manage cardholders, programs, and spend — all through a single REST API.

> **What is this?** A B2B card-issuing API. You create *organizations* (the companies you serve), provision *cardholders* under them, and issue Visa-branded virtual cards. Every cent moves through Seismic's regulated card-issuing partners under the hood; you never touch PCI scope.

---

## Who this is for

| Audience | Use case |
|---|---|
| **Fintech apps** | Issue cards to your end users (consumer debit, neobank, expense-tracker brands). |
| **Corporate spend tools** | Issue cards to employees of the SMBs you sell to. |
| **Marketplaces & platforms** | Pay sellers/contractors with controlled, reloadable cards. |
| **Payroll & EWA providers** | Convert wages into instantly-spendable cards. |

---

## Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────┐
│                         YOUR APPLICATION                         │
│  (web app, mobile app, internal tooling — anything HTTPS)        │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                  HTTPS  +  Bearer JWT
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│             https://api.seismic-cards.systems/api/v1             │
│                  Seismic Cards API (this product)                │
│                                                                  │
│   • clientId + apiKey  →  short-lived session JWT (1 h)          │
│   • Organizations      →  the companies you serve                │
│   • Cardholders        →  end users / employees                  │
│   • Cards              →  virtual cards (Visa, more soon)        │
│   • PIN / freeze / etc.                                          │
└──────────────────────────────────┬───────────────────────────────┘
                                   │
                       (Seismic handles all card-network +
                        regulatory plumbing on your behalf)
                                   │
                                   ▼
                  ┌───────────────────────────────┐
                  │  Card networks + Issuer BIN   │
                  │  (Visa, Mastercard, ACH)      │
                  └───────────────────────────────┘
```

You only ever talk to **`https://api.seismic-cards.systems`** (production) or **`https://sandbox-api.seismic-cards.systems`** (test).

---

## The three things you'll create

### 1. Organization

A **logical tenant** representing one of your customers (or one of your internal programs). Every cardholder belongs to exactly one organization.

```json
{
  "id":          "uuid",
  "name":        "Acme Corp",
  "slug":        "acme-corp",
  "programType": "CORPORATE | CONSUMER_BRAND",
  "status":      "ACTIVE"
}
```

`programType` controls funding rails and KYC flow:

- **`CORPORATE`** — typical for B2B cards (employee/contractor cards funded from corporate balance).
- **`CONSUMER_BRAND`** — typical for neobanks and consumer fintechs (per-cardholder funding).

### 2. Cardholder

The **person** who will hold the card. You provision a cardholder under an organization with a stable `externalUserId` of your choosing (your internal user UUID, employee number, etc.).

```json
{
  "externalUserId": "emp-00481",
  "displayName":    "Priya Sharma"
}
```

Provisioning runs KYC behind the scenes. You get back a Seismic `cardholderId` you'll use for card operations.

### 3. Card

A **virtual card** issued to a cardholder. Returns the full card details (PAN, CVV, expiry) once at creation; afterwards retrievable only via the [PCI Widget](/pci-widget) (coming soon).

---

## Quick start (5 minutes)

1. **Get credentials.** Email [support@seismic-cards.systems](mailto:support@seismic-cards.systems) — we'll provision a sandbox `clientId` + `apiKey` within a business day.
2. **Exchange them for a JWT.** Single `POST /api/v1/auth/session` call. See [Getting Started](/getting-started).
3. **Create an organization.** `POST /api/v1/organizations`.
4. **Provision a cardholder.** `POST /api/v1/organizations/{orgId}/cardholders/provision`.
5. **Issue your first card.** `POST /api/v1/organizations/{orgId}/cardholders/{externalUserId}/cards`.

Full walkthrough → **[Issuing your first card](/issuing-a-card)**.

---

## What's not in this version

We are intentionally launching a focused surface. The following are **on the roadmap** and have placeholder pages so you can plan integrations:

- **Webhooks** — real-time auth/decline/refund events. ([roadmap](/webhooks))
- **PCI Widget** — drop-in iframe for displaying full card details safely. ([roadmap](/pci-widget))
- **BIN selection** — currently the program-default BIN is used.
- **Physical cards** — virtual only at launch.

---

## Conventions used in these docs

- All examples use the **sandbox** base URL. Swap `sandbox-api` for `api` when you go live.
- All requests are JSON. `Content-Type: application/json` is implied unless noted.
- All authenticated routes require `Authorization: Bearer <session JWT>`. Anything else returns `401`.
- Time-zone is UTC, ISO-8601 (e.g. `2026-05-16T05:00:00.000Z`).
- All money fields are **integer minor units** (cents/paise) unless explicitly named `*Decimal`.

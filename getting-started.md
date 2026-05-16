---
title: "Getting started"
description: "Environments, credentials, authentication, and your first authenticated call."
---

# Getting Started

Five minutes from credentials in hand to your first authenticated call.

---

## 1. Environments

| Environment | Base URL | Purpose |
|---|---|---|
| **Sandbox** | `https://sandbox-api.seismic-cards.systems` | Build and test. Synthetic KYC, test BIN, no real money. |
| **Production** | `https://api.seismic-cards.systems` | Real cards. Real money. Requires production credentials issued after sandbox sign-off. |

> All examples in these docs use the sandbox URL.

> **Heads up — sandbox URL during private beta:** while `sandbox-api.seismic-cards.systems` finishes DNS propagation, you can test against `https://rave-card-api-production.up.railway.app` (same API, same credentials).

---

## 2. Credentials

During onboarding you receive **two values**, both per-environment:

| Field | Visibility | Description |
|---|---|---|
| `clientId` | Public-ish (looks like `cid_…`) | Identifies your program. Safe to commit if you isolate by branch. |
| `apiKey` | **Server-side only** (looks like `cik_sbx_…`). | Your secret. Treat like a password. **Never** ship in mobile apps or websites. |

**Storage best practices:**

- Store `apiKey` in a secret manager (AWS Secrets Manager, GCP Secret Manager, Doppler, Vault, 1Password).
- Rotate `apiKey` on a 90-day cadence — request a new one and we revoke the old.
- Never log it. Never embed it client-side.

**Lost your key?** Email [support@seismic-cards.systems](mailto:support@seismic-cards.systems); we revoke and re-issue.

---

## 3. Authentication — single call

Seismic uses a **simple bearer token exchange**. No OAuth dance, no refresh tokens. You exchange `clientId` + `apiKey` for a **session JWT**, valid for **1 hour**, then call all other endpoints with that JWT.

```bash
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/auth/session" \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "cid_3c8e4bd37cacc84879dc14b9",
    "apiKey":   "cik_sbx_c72a52304cc64fa9f83e4c5ac3f7a62de01b84846387ee2d"
  }'
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiI...",
  "tokenType":   "Bearer",
  "expiresIn":   3600
}
```

`expiresIn` is seconds. Cache the token in memory or Redis; re-authenticate when you're within 60 seconds of expiry.

**Errors:**

| HTTP | When |
|------|------|
| `400` | Missing `clientId` or `apiKey`. |
| `401` | Wrong `clientId` / wrong key / revoked key / suspended program. |
| `403` | Your IP is not in the allowlist (if your program has IP allowlisting enabled). |

---

## 4. Calling authenticated endpoints

Every endpoint under `/api/v1/*` (except `/auth/session`) requires `Authorization: Bearer <accessToken>`.

```bash
TOKEN="eyJhbGciOiJIUzI1NiI..."

curl "https://sandbox-api.seismic-cards.systems/api/v1/me" \
  -H "Authorization: Bearer $TOKEN"
```

**Response (200):**

```json
{
  "id":             "uuid",
  "publicClientId": "cid_3c8e4bd37cacc84879dc14b9",
  "name":           "Your Program Name",
  "slug":           "your-program",
  "status":         "ACTIVE"
}
```

`/api/v1/me` is your **smoke test** — if it returns 200, your auth is wired correctly.

---

## 5. Production-ready Node.js helper

A minimal, production-grade auth client that caches and auto-refreshes the JWT:

```ts
// seismic-client.ts
const BASE = process.env.SEISMIC_API_BASE ?? "https://sandbox-api.seismic-cards.systems";
const CLIENT_ID = process.env.SEISMIC_CLIENT_ID!;
const API_KEY = process.env.SEISMIC_API_KEY!;

let cached: { token: string; expiresAt: number } | null = null;

async function fetchToken() {
  const r = await fetch(`${BASE}/api/v1/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: CLIENT_ID, apiKey: API_KEY }),
  });
  if (!r.ok) throw new Error(`Auth failed: ${r.status} ${await r.text()}`);
  const { accessToken, expiresIn } = await r.json();
  cached = { token: accessToken, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
  return accessToken;
}

export async function getToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt) return cached.token;
  return fetchToken();
}

export async function seismic<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}
```

Use it like:

```ts
import { seismic } from "./seismic-client";
const me = await seismic("/api/v1/me");
console.log(me);
```

---

## 6. Common headers

| Header | Required | Notes |
|--------|----------|-------|
| `Authorization` | Yes (except `/auth/session`) | `Bearer <accessToken>` |
| `Content-Type` | Yes for `POST`/`PATCH` | `application/json` |
| `Idempotency-Key` | Recommended for mutations | UUID v4. Same key = same response within 24 h. *(Coming soon)* |

---

## Next steps

- **[Issue your first card](/issuing-a-card)** — full end-to-end walkthrough.
- Open **Seismic Playground** in the docs header (`/seismic-playground`) for the Mintlify OpenAPI explorer (**Try it** + bearer auth against sandbox / staging).
- **[Errors](/errors)** — error codes and how to recover.

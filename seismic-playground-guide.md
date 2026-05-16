---
title: "Seismic Playground"
description: "How to use the Seismic-hosted API explorer — Try it, auth, servers, and keeping OpenAPI in sync."
---

# Seismic Playground

Open the **Seismic Playground** tab in the header (generated pages live under **`/seismic-playground`**; `mint.json` → `tabs[].url`). That surface is Mintlify’s **API Playground** backed by **`openapi.json`** — Seismic’s interactive reference alongside these docs.

What you get there:

| Feature | Details |
|---------|---------|
| **Try it** | Send real HTTP requests from your browser against the sandbox, production (when wired), or temporary staging hostname. |
| **Server picker** | Select **Sandbox**, **Production**, or **Staging** from the dropdown (see `openapi.json` → `servers`). |
| **Session auth** | Call **`POST /api/v1/auth/session`** with `{ clientId, apiKey }`, copy `accessToken`, then paste it under **Authorize** → **partnerBearer** (Bearer JWT). |
| **Every partner route** | Organizations, provisioning, cards, PIN, freeze — same operations as described in Markdown guides and as implemented on the backend. |

> **Safety:** Never type a **production** `apiKey` into a playground on a site that anyone can bookmark. Sandbox keys only unless the docs deployment is gated (e.g. Mintlify SSO / private repo).

---

## Keep the playground in sync

The committed spec mirrors the deployed API (`GET …/docs/json`), with platform-only routes removed for partners.

From this repo folder:

```bash
cd cards
npm run openapi:refresh
git add openapi.json && git commit -m "chore(docs): refresh OpenAPI for Seismic Playground"
git push   # Mintlify redeploys; playground updates automatically
```

Override URL when iterating locally:

```bash
SOURCE_URL=http://localhost:4010/docs/json npm run openapi:refresh
```

---

## Pair with these docs

| Goal | Where |
|------|--------|
| Narrative onboarding | **Documentation** tab → **Getting started**, **Issue your first card**. |
| Error semantics | **Errors** under **Reference**. |
| Raw Swagger (optional) | `GET https://<your-api-host>/docs` on any Seismic-backed API hostname. |

The **Markdown** guides explain PIN rules, provisioning fields, and white-label semantics; **Seismic Playground** is where integrators poke the live endpoints with correct shapes.

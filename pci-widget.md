---
title: "PCI Widget"
description: "Display full PAN/CVV/expiry to your cardholders without entering PCI scope. Roadmap."
---

# PCI Widget

> **Status: roadmap.** The PCI Widget will ship in **v0.2**. This page is published so you can plan UI placement; the integration contract below is what we'll ship.
>
> Need it now? Email [support@seismic-cards.systems](mailto:support@seismic-cards.systems) — we have early-access slots open.

---

## Why a widget?

To display the full **PAN**, **CVV**, and **expiry** to a cardholder, your servers and frontend must stay out of PCI DSS scope. The standard pattern is an **iframe** that renders the sensitive fields directly from Seismic's PCI-compliant origin, with your domain as the parent. Your backend never sees the raw card data — neither does your DOM.

Industry parallels: Stripe Issuing's `<CardComponent>`, Marqeta's PCI Widget, Adyen's `<CardWidget>`.

## Planned integration (v0.2)

### 1. Mint a short-lived display token (server-side)

```bash
curl -X POST "https://sandbox-api.seismic-cards.systems/api/v1/organizations/$ORG_ID/cards/$CARD_ID/display-token" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "externalUserId": "emp-00481" }'
```

Returns:

```json
{
  "displayToken": "dt_01HX…",
  "expiresIn":    60
}
```

Tokens expire in 60 s and are single-use.

### 2. Drop the iframe in your frontend

```html
<script src="https://widget.seismic-cards.systems/v1/widget.js" defer></script>

<seismic-card-widget
  display-token="dt_01HX…"
  fields="number,expiry,cvv"
  theme="dark"
></seismic-card-widget>
```

Customizable via CSS variables on the host element:

```css
seismic-card-widget {
  --seismic-font:           "Inter", sans-serif;
  --seismic-fg:             #FFFFFF;
  --seismic-bg:             #0D0D0D;
  --seismic-radius:         12px;
  --seismic-spacing:        16px;
}
```

### 3. Lifecycle events

The widget dispatches DOM events on the host element:

```ts
const el = document.querySelector("seismic-card-widget")!;
el.addEventListener("ready",   (e) => { /* widget rendered */ });
el.addEventListener("revealed",(e) => { /* user clicked "show" */ });
el.addEventListener("copied",  (e) => { /* user copied PAN/CVV */ });
el.addEventListener("error",   (e) => { console.error((e as CustomEvent).detail); });
```

### 4. PCI scope summary

| Layer | Sees PAN/CVV? | PCI scope |
|-------|---------------|-----------|
| Your backend | ❌ | Out |
| Your frontend (DOM) | ❌ | Out |
| Browser memory of the iframe | ✅ (Seismic origin) | In (Seismic's responsibility) |
| Your network | ❌ | Out |

The display token + iframe pattern keeps you at PCI **SAQ A** — the simplest level.

---

## Until v0.2 ships

For sandbox testing, you can fetch full card details from the Seismic dashboard. For production access in advance of widget GA, contact support — we can arrange a server-to-server PAN-retrieval endpoint **for short-lived test cards only** while you build your UI.

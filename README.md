# Seismic Cards API — Documentation

Source for the public docs site at **[docs.seismic.systems](https://docs.seismic.systems)**.

## What's here

| File | Purpose |
|---|---|
| [`introduction.md`](./introduction.md) | Landing page — overview, architecture, full flow, quick start. |
| [`getting-started.md`](./getting-started.md) | Environments, OAuth flow, headers, first authenticated call. |
| [`issuing-a-card.md`](./issuing-a-card.md) | End-to-end card creation walkthrough (sub-account → KYC → cardholder → budget → card). |
| [`api-reference.md`](./api-reference.md) | Every endpoint with request/response examples. |
| [`webhooks.md`](./webhooks.md) | Real-time events + HMAC-SHA256 signature verification. |
| [`pci-widget.md`](./pci-widget.md) | Displaying PAN/CVV/expiry securely via Seismic Widget.js. |
| [`errors.md`](./errors.md) | Full error code reference. |
| [`mint.json`](./mint.json) | Mintlify deploy configuration. |
| [`DEPLOY.md`](./DEPLOY.md) | Step-by-step deploy guide for Mintlify (custom domain, branding, OpenAPI). |

## Local preview

```bash
npm install -g mintlify
cd cards/
mintlify dev
```

Open `http://localhost:3000`.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md) for the full guide. TL;DR — push to GitHub, connect at [mintlify.com/start](https://mintlify.com/start), point your CNAME, done.

## Editing

- All pages are plain Markdown. `.mdx` is supported if you need React components.
- Internal links use absolute paths without extension: `[link text](/issuing-a-card)`.
- After adding a page, register it in `mint.json` under `navigation`.

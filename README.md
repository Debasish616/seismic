# Seismic Cards API — Documentation

Source for the public docs site at **[docs.seismic-cards.systems](https://docs.seismic-cards.systems)**.

## What's here

| File | Purpose |
|---|---|
| [`introduction.md`](./introduction.md) | Landing page — overview, architecture, full flow, quick start. |
| [`getting-started.md`](./getting-started.md) | Environments, session auth (`clientId` + `apiKey` → JWT), first call. |
| [`issuing-a-card.md`](./issuing-a-card.md) | End-to-end org → provision → issue card → PIN/freeze. |
| [`openapi.json`](/openapi.json) | OpenAPI 3.1 spec for **Seismic Playground** (Mintlify; tab URL `/seismic-playground`). Refresh with `npm run openapi:refresh`. |
| [`seismic-playground-guide.md`](./seismic-playground-guide.md) | Notes on playground auth + keeping the spec in sync. |
| [`webhooks.md`](./webhooks.md) | Roadmap webhooks contract. |
| [`pci-widget.md`](./pci-widget.md) | Roadmap: PCI iframe widget for displaying PAN/CVV. |
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

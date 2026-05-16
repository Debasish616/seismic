# Deploy these docs to Mintlify

This folder is a fully Mintlify-ready site. Follow the steps below to go from a local clone to a public docs URL with a custom domain in about 10 minutes.

---

## Prerequisites

- A GitHub account with permission to push a new repository.
- An email you can sign up to Mintlify with.
- (Optional, for custom domain) Access to your DNS for `seismic-cards.systems`.

---

## 1. Push to a GitHub repo

Create an empty repo (private is fine — Mintlify supports private GitHub repos) called e.g. `seismic-systems/cards-docs`:

```bash
cd cards/                                  # this folder
git init
git add .
git commit -m "Initial Seismic Cards API docs"

# create the repo on github.com first (UI), then:
git remote add origin git@github.com:seismic-systems/cards-docs.git
git branch -M main
git push -u origin main
```

> **Already inside a parent repo?** If `cards/` lives inside a larger monorepo, just point Mintlify at the subdirectory in step 2 — no need to extract.

---

## 2. Connect Mintlify

1. Go to [mintlify.com/start](https://mintlify.com/start) and sign in with GitHub.
2. Click **"Create a deployment"** (or **"Add a project"**).
3. Pick the repo (`seismic-systems/cards-docs`).
4. **If your docs live in a subfolder**, set the **"Path to mint.json"** to `cards/mint.json` during onboarding.
5. Mintlify will install its GitHub App, parse `mint.json`, and provision a deploy.

Within ~30 seconds you'll get a default URL:

```
https://seismic-systems.mintlify.app
```

The site is live. Every push to `main` auto-redeploys.

---

## 3. Wire a custom domain

1. In the Mintlify dashboard → **Settings → Custom Domain** → enter `docs.seismic-cards.systems`.
2. Mintlify gives you a `CNAME` target — usually `cname.mintlify.app` or similar.
3. In your DNS provider (Cloudflare / Route53 / Namecheap / etc.):

```dns
docs.seismic-cards.systems   CNAME   cname.mintlify.app    300
```

> If `seismic-cards.systems` is on Cloudflare with proxy enabled (orange cloud), set the record to **DNS only** (grey cloud) so Mintlify can issue the TLS cert.

4. Wait for DNS to propagate (~1–5 min). Mintlify auto-issues a Let's Encrypt cert and flips the domain green when ready.

You'll now have:

```
https://docs.seismic-cards.systems
```

---

## 4. Replace placeholder branding (optional but recommended)

The repo ships with auto-generated SVG logos under `logo/`. Swap them with your real brand:

```
cards/
├── logo/
│   ├── light.svg          ← shown in light mode
│   └── dark.svg           ← shown in dark mode
└── favicon.svg            ← browser tab icon
```

**Recommended dimensions:**

| Asset       | Dimensions       | Notes |
|---|---|---|
| `light.svg` / `dark.svg` | ~360×64 (or any 5–6 : 1 ratio) | Wordmark + small icon. Will be displayed at ~32 px tall in the topbar. |
| `favicon.svg`            | 64×64                          | Square. Mintlify also accepts `.png` or `.ico`. |
| `logo/og.png`            | 1200×630                       | Open Graph preview image used when the docs are shared on Twitter / Slack / LinkedIn. |

Edit `mint.json` under `colors` to match your brand:

```json
"colors": {
  "primary":    "#YOUR_BRAND_COLOR",
  "light":      "#FAFAFA",
  "dark":       "#0D0D0D"
}
```

---

## 5. Local preview while editing

Mintlify ships a local dev server so you can preview changes before pushing.

```bash
npm install -g mintlify
cd cards/
mintlify dev
```

Then open `http://localhost:3000`. Saves auto-reload.

---

## 6. Common questions

### How do I add a new page?

1. Create the file: `cards/new-page.md` (or `.mdx`).
2. Add it to `mint.json` → `navigation`:

   ```json
   {
     "group": "Guides",
     "pages": ["issuing-a-card", "pci-widget", "new-page"]
   }
   ```

3. Push to `main`.

### How do I publish an OpenAPI spec for the "Try it" experience?

1. Place a file at `cards/openapi.json` (or `.yaml`).
2. Reference it from `mint.json`:

   ```json
   "openapi": "openapi.json"
   ```

3. Mintlify auto-generates one page per endpoint, with an interactive request form.

#### After API changes — refresh playground

Partners see **Seismic Playground** (Mintlify API Playground at `/playground`). Regenerate OpenAPI locally before commit:

```bash
cd cards
npm run openapi:refresh
git add openapi.json && git commit -m "chore(docs): refresh OpenAPI spec"
```

### Can I gate the docs behind a login?

Yes — Mintlify Pro and Enterprise support SSO via **Auth0**, **Okta**, **Clerk**, **JWT**, **API key auth**, or a partner-portal-style workflow. Configure under **Settings → Authentication**. Useful if you want only paying clients to see the API surface.

### How do I get analytics?

Mintlify ships built-in basic analytics (page views, search queries). For deeper tracking, add to `mint.json`:

```json
"analytics": {
  "ga4":      { "measurementId": "G-XXXXXXX" },
  "posthog":  { "apiKey": "phc_..." },
  "plausible":{ "domain": "docs.seismic-cards.systems" }
}
```

---

## 7. Project structure (for reference)

```
cards/
├── mint.json                  ← Mintlify config (theme, navigation, branding)
├── openapi.json               ← OpenAPI for Seismic Playground (refresh: npm run openapi:refresh)
├── scripts/build-openapi.mjs  ← Fetches live /docs/json, strips Raven internal routes for Seismic
├── favicon.svg
├── logo/
│   ├── light.svg
│   └── dark.svg
│
├── introduction.md            ← Landing page (rendered at "/")
├── getting-started.md
├── issuing-a-card.md
├── seismic-playground-guide.md  ← Bearer auth + spec refresh notes for playground users
├── errors.md
├── webhooks.md
└── pci-widget.md
```

That's it — push, connect, and your client has a polished docs portal at `docs.seismic-cards.systems`.

---

## 8. Wiring the API URLs (Seismic Cards specifics)

These docs reference two API hostnames:

| URL | Status |
|-----|--------|
| `https://api.seismic-cards.systems` | **Registered** in Rave's white-label hostname table for Seismic. Awaiting Seismic DNS + TLS. |
| `https://sandbox-api.seismic-cards.systems` | **Registered** in Rave's white-label hostname table for Seismic. Awaiting Seismic DNS + TLS. |
| `https://rave-card-api-production.up.railway.app` | **Live today.** Same API; Seismic credentials work against it. Used as the temporary sandbox URL until DNS lands. |

### Step 1 — Seismic adds DNS

In Seismic's DNS provider (Cloudflare, Route53, GoDaddy, etc.):

```dns
api.seismic-cards.systems          CNAME   rave-card-api-production.up.railway.app   300
sandbox-api.seismic-cards.systems  CNAME   rave-card-api-production.up.railway.app   300
```

> If Seismic uses Cloudflare with proxy enabled (orange cloud), set the records to **DNS only** (grey cloud) so Railway can issue TLS.

### Step 2 — Add custom domains in Railway (Rave operator)

In Railway → `rave-card-issuance` project → `rave-card-api` service → **Settings → Networking → Custom Domain**:

```
api.seismic-cards.systems
sandbox-api.seismic-cards.systems
```

Railway auto-issues Let's Encrypt certs once it sees the CNAME. Usually under 60 seconds.

### Step 3 — Verify the hostname → tenant mapping

```bash
curl https://api.seismic-cards.systems/.well-known/rave-card-issuance.json
# expected:
# {"ok": true, "hostname": "api.seismic-cards.systems",
#  "partnerName": "Seismic", "partnerSlug": "seismic", "publicClientId": "cid_..."}
```

If this returns the right `partnerSlug`, every call to `https://api.seismic-cards.systems/api/v1/...` will:

1. Resolve the `Host` header → Seismic partner row.
2. Reject any session JWT or `clientId/apiKey` that doesn't belong to Seismic (`403`).

### Step 4 — Update these docs (after DNS lands)

The example URLs in this site already reference `(sandbox-)api.seismic-cards.systems`. Once steps 1–3 are done, the docs become accurate without further edits.

If you want to leave breadcrumbs while DNS is pending, replace the example URLs with `https://rave-card-api-production.up.railway.app` and add a banner in `mint.json`:

```json
"topAnnouncementBar": {
  "content": "Sandbox is currently live at rave-card-api-production.up.railway.app while api.seismic-cards.systems DNS propagates."
}
```

---

## 9. Troubleshooting

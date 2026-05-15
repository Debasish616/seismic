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

> Tip: a Postman collection isn't enough — Mintlify wants OpenAPI 3.x. We can generate one from `api-reference.md` in a follow-up if you want.

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
├── favicon.svg
├── logo/
│   ├── light.svg
│   └── dark.svg
│
├── introduction.md            ← Landing page (rendered at "/")
├── getting-started.md
├── issuing-a-card.md
├── api-reference.md
├── webhooks.md
├── pci-widget.md
└── errors.md
```

That's it — push, connect, and your client has a polished docs portal at `docs.seismic-cards.systems`.

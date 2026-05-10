# PCI Widget — Display PAN, CVV, Expiry

`Seismic Widget.js` is a PCI‑compliant client‑side JavaScript library that loads a user's full card number, expiry date, and CVV directly into iframes hosted on Seismic's PCI‑certified domain. **Your servers and your front‑end code never touch raw card data**, which keeps your application out of PCI scope.

> **TL;DR — three things in three places:**
>
> 1. **Server:** Mint a 5‑minute access token via `GET /v1/cards/{cardId}/private-info/access-token`.
> 2. **Client:** Load `Seismic Widget.js`, give it three `<div>` IDs and the access token.
> 3. **Dashboard:** Allowlist the host(s) where the widget will run.

---

## 1. How it works

```
┌──────────────────────────────────────────────────────────────────┐
│  YOUR APP                                                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Your server (PCI scope: SAQ A)                            │  │
│  │   1. GET /v1/cards/{cardId}/private-info/access-token     │  │
│  │   2. Returns 5-minute JWT                                  │  │
│  └────────────────────┬───────────────────────────────────────┘  │
│                       │ JWT                                      │
│  ┌────────────────────▼───────────────────────────────────────┐  │
│  │  Your client (web / iOS WebView / Android WebView)         │  │
│  │                                                            │  │
│  │   <script src="https://widget.seismic.systems/index.min.js" />  │  │
│  │                                                            │  │
│  │   widget.bootstrap({                                       │  │
│  │     clientAccessToken: jwt,                                │  │
│  │     component: { showPan: { cardPan, cardExp, cardCvv } }  │  │
│  │   });                                                      │  │
│  │                                                            │  │
│  │   ┌──────────────────────────────────────────────┐         │  │
│  │   │  3 iframes injected by Widget.js:            │         │  │
│  │   │   • #card-pan  ←  iframe → widget.seismic.systems │         │  │
│  │   │   • #card-exp  ←  iframe → widget.seismic.systems │         │  │
│  │   │   • #card-cvv  ←  iframe → widget.seismic.systems │         │  │
│  │   └──────────────────────────────────────────────┘         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

The iframes are served from Seismic's PCI domain. Card data is rendered there and never crosses your origin.

---

## 2. Step 1 — mint a client access token (server)

```http
GET /v1/cards/{cardId}/private-info/access-token?accountId={accountId}
x-access-token: <token>
```

**Response 200**

```json
{
  "code": "000000",
  "data": { "accessToken": "eyJhbGciOiJIUzI1NiJ9.eyJjYXJkSWQiOi..." }
}
```

The returned `accessToken` is a JWT scoped to one card and one user, valid for ~5 minutes. Send it to your client and discard.

> **Don't cache.** Mint a fresh token every time the user opens the "Show card details" sheet.

---

## 3. Step 2 — drop the widget into your client

### 3a. Web (HTML / React / any framework)

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>My card</title>
  <style>
    .row   { margin: 16px 0; }
    .label { font-size: 12px; opacity: 0.6; margin-bottom: 4px; }
    .pane  { min-height: 44px; padding: 10px; border: 1px solid #ccc; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="row"><div class="label">Card number</div><div id="card-pan" class="pane"></div></div>
  <div class="row"><div class="label">Expires</div>     <div id="card-exp" class="pane"></div></div>
  <div class="row"><div class="label">CVV</div>         <div id="card-cvv" class="pane"></div></div>

  <script src="https://widget.seismic.systems/index.min.js"></script>
  <script>
    fetch("/api/cards/CARD_UUID/access-token", { credentials: "include" })
      .then((r) => r.json())
      .then(({ data }) => {
        widget.bootstrap({
          clientAccessToken: data.accessToken,
          component: {
            showPan: {
              cardPan: { domId: "card-pan", format: true, styles: { span: { color: "#111", "font-size": "17px" } } },
              cardExp: { domId: "card-exp", format: true, styles: { span: { color: "#111", "font-size": "17px" } } },
              cardCvv: { domId: "card-cvv",                  styles: { span: { color: "#111", "font-size": "17px" } } }
            }
          },
          callbackEvents: {
            onSuccess: () => console.log("Widget rendered"),
            onFailure: (err) => console.error("Widget failed", err)
          }
        });
      });
  </script>
</body>
</html>
```

### 3b. iOS (Swift / WKWebView)

Host an HTML page on your server that contains the markup above, then load it in a `WKWebView` with `Authorization: Bearer <session JWT>` so your server can fetch the access token on the user's behalf.

```swift
import WebKit

let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())
let request = URLRequest(
  url: URL(string: "https://api.your-app.com/cards/\(cardId)/pci-widget")!
)
webView.load(request)
```

> **In the iOS WebView, after the layout settles, call `widget.destroy()` and re‑bootstrap once the panes have stable size.** This avoids blank iframes when the parent view animates / flips. The reference HTML below handles this for you.

### 3c. Android (Kotlin / WebView)

Same approach — host the HTML on your server, load it in a `WebView`, ensure JavaScript and `setDomStorageEnabled(true)` are on.

```kotlin
val webView = findViewById<WebView>(R.id.cardWebView)
webView.settings.javaScriptEnabled  = true
webView.settings.domStorageEnabled  = true
webView.loadUrl("https://api.your-app.com/cards/$cardId/pci-widget")
```

---

## 4. Step 3 — allowlist your host(s)

In the Seismic dashboard → **Widget → Allowed Domains**, add every host that will load the widget — e.g.:

```
app.your-company.com
api.your-company.com         ← if iOS/Android WebView loads HTML from your API host
sandbox.your-company.com
localhost:3000               ← for local dev (sandbox only)
```

> **Hostname only — no scheme, no path.** Iframes will silently render blank if the host isn't allowlisted.

---

## 5. Reference: server‑rendered widget page

If you'd rather your server compose the widget HTML and serve it directly (recommended for mobile WebViews), here's a complete handler. Your server fetches the access token, embeds it in the page, and returns the HTML. The page then bootstraps the widget on load.

```ts
// Express / Fastify / any Node server
import axios from "axios";

async function pciWidgetHandler(req, res) {
  const { cardId } = req.params;
  const userId = req.user.id;                                    // your auth
  const accountId = await getAccountIdForUser(userId);           // your DB

  // 1. Mint a 5-minute access token from Seismic
  const access = await axios.get(
    `${SEISMIC}/v1/cards/${cardId}/private-info/access-token`,
    { params: { accountId }, headers: { "x-access-token": SEISMIC_TOKEN } },
  );
  const cardJwt = access.data.data.accessToken;

  // 2. Return an HTML page that bootstraps Seismic Widget.js
  res.type("text/html").send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <title>Card</title>
  <style>
    body  { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 24px; color: #111; }
    .row   { margin-bottom: 16px; }
    .label { font-size: 11px; opacity: .55; text-transform: uppercase; margin-bottom: 4px; }
    .pane  { min-height: 44px; padding: 10px 12px; border: 1px solid rgba(0,0,0,.1); border-radius: 10px; background: #f7f7fa; }
  </style>
</head>
<body>
  <div class="row"><div class="label">Card number</div><div id="card-pan" class="pane"></div></div>
  <div class="row"><div class="label">Expires</div>     <div id="card-exp" class="pane"></div></div>
  <div class="row"><div class="label">CVV</div>         <div id="card-cvv" class="pane"></div></div>

  <script src="https://widget.seismic.systems/index.min.js"></script>
  <script>
    var token = ${JSON.stringify(cardJwt)};
    function boot() {
      widget.bootstrap({
        clientAccessToken: token,
        component: {
          showPan: {
            cardPan: { domId: "card-pan", format: true, styles: { span: { "font-size": "17px", color: "#111" } } },
            cardExp: { domId: "card-exp", format: true, styles: { span: { "font-size": "17px", color: "#111" } } },
            cardCvv: { domId: "card-cvv",                  styles: { span: { "font-size": "17px", color: "#111" } } }
          }
        },
        callbackEvents: {
          onFailure: function (err) { console.error(err); }
        }
      });
    }
    if (document.readyState === "complete") boot();
    else window.addEventListener("load", boot);
  </script>
</body>
</html>`);
}
```

---

## 6. Customizing the look

The widget exposes a single CSS selector per field — `span` — that you can theme via the `styles` config. Fonts, colors, letter spacing, and weight all flow through.

```js
widget.bootstrap({
  clientAccessToken: token,
  component: {
    showPan: {
      cardPan: {
        domId: "card-pan",
        format: true,
        styles: {
          span: {
            color: "#ffffff",
            "font-size": "20px",
            "font-weight": "700",
            "letter-spacing": "0.06em",
            "font-family": "-apple-system, sans-serif"
          }
        }
      },
      cardExp: { domId: "card-exp", format: true, styles: { span: { color: "#ffffff", "font-size": "16px" } } },
      cardCvv: { domId: "card-cvv",                  styles: { span: { color: "#ffffff", "font-size": "16px" } } }
    }
  }
});
```

- The iframes inherit the dimensions of their target `<div>`. Give the divs a **non‑zero width and height** before calling `bootstrap()`. The widget refuses to render into a 0×0 element.
- Make the parent `<div>` `min-height: 44px` to be safe on all browsers.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Iframes load but stay blank | Host not allowlisted | Add the **exact hostname** (no scheme) to the dashboard's allowed domains. |
| `widget.bootstrap is not a function` | Script not loaded | Confirm the `<script src=...>` URL resolves; check network tab. |
| `onFailure` fires with `token expired` | Access token older than ~5 min | Mint a fresh token; do not cache. |
| Iframes are 0px tall on iOS / WebView | Parent `<div>` measured 0×0 at bootstrap time | Wait for layout (`requestAnimationFrame` x2) or set explicit `min-height`. |
| Widget renders, then flashes blank when the card flips | Re‑bootstrap was called during animation | Call `widget.destroy()` then `widget.bootstrap()` only after the flip animation settles. |
| `widget` is `undefined` | The script URL isn't allowlisted (CSP) | Allow `widget.seismic.systems` in your `Content-Security-Policy: script-src` and `frame-src`. |

---

## 8. PCI scope reminder

Because all card data lives inside iframes from `widget.seismic.systems`, your application:

- Can be assessed under PCI DSS **SAQ A** (the lightest tier — ~22 controls vs. 200+ for full scope).
- Never logs, stores, transmits, or processes raw PAN / CVV / track data.
- Doesn't need a tokenization vault on your end — Seismic is the vault.

For a copy of Seismic's PCI DSS Attestation of Compliance, contact your account manager.

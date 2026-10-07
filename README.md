# PrintMomentum landing page

Static marketing site for [printmomentum.com](https://printmomentum.com). No build step.

## Local preview

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` (Turkish: `http://localhost:4173/tr/`).

Check translations (EN/TR key parity and every key used in the pages exists):

```bash
node scripts/build-pages.mjs        # after editing i18n.js or a page template: refreshes the EN pages and their tr/ copies (list: PAGES in the script)
node scripts/check-i18n.mjs && node scripts/build-pages.mjs --check && node --check script.js
```

CI runs the same checks on every pull request.

## Deploy

Pushes to `main` sync this folder to S3 (with `--delete`) and EC2 via GitHub Actions (`.github/workflows/ci.yml`), then check that the live `i18n.js` matches the commit.

Production path on the box: `/opt/printmomentum/landing` (served by Caddy on `printmomentum.com`).

## Files

- `index.html` — main landing (EN/TR, dark mode): hero with the rising designs list, rising designs (speed score 0–100), your shop (Etsy connection, trademark risk scan, sales overview), pricing, FAQ; live "products tracked" line from `/api/v1/health` with a plain fallback. Product mocks are plain HTML/CSS with made-up data.
- `tr/index.html` — Turkish home page, **generated** by `scripts/build-pages.mjs` (do not edit by hand)
- `how-we-measure/index.html` — "How we measure momentum": signals behind the speed score, what "Momentum Leader" / "Fast Mover" mean (our own measurement), limits. Linked from the footer and from the app's metric help. Turkish copy at `tr/how-we-measure/index.html` (generated).
- `trademark-check/index.html` + `phrase-check.js` — free phrase risk check, no sign-up. Calls `GET /api/v1/public/phrase-check?q=` on the same origin (Caddy proxies `/api`), which checks only our own trademark watchlist (never Etsy data), rate-limited per IP. Turkish copy at `tr/trademark-check/index.html` (generated). Public URLs must not contain "etsy".
- `404.html` — error page (EN + TR), served by Caddy for unknown paths
- `theme-init.js` — sets the theme before first paint (external so the CSP needs no inline scripts)
- `privacy.html`, `terms.html` — legal pages, full EN and TR versions side by side (DRAFT, pending legal review)
- `i18n.js` — translations (every key must exist in both `en` and `tr`)
- `script.js` — language (`/tr/` path, then `?lang=`, saved choice, browser; the language toggle on the home page opens `/` or `/tr/`), theme, health stats, campaign pass-through (links to the app carry the visit's `utm_*` and an external referrer host as `ref`; tab-only sessionStorage, no cookies)
- `og-image.png` — social sharing image (1200×630)
- `pm-logo-64.png` (header/footer logo, 2× for 28px), `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png` — small variants cut from `pm-logo.png` (1024px original, kept as the source)

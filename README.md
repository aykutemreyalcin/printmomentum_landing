# PrintMomentum landing page

Static marketing site for [printmomentum.com](https://printmomentum.com). No build step.

## Local preview

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173` (add `?lang=tr` for Turkish).

## Deploy

Pushes to `main` sync this folder to S3 and EC2 via GitHub Actions (`.github/workflows/ci.yml`).

Production path on the box: `/opt/printmomentum/landing` (served by Caddy on `printmomentum.com`).

## Files

- `index.html` — main landing (EN/TR, dark mode, pricing, FAQ, live "products tracked" line from `/api/v1/health` with a plain fallback)
- `privacy.html`, `terms.html` — legal pages, full EN and TR versions side by side (DRAFT, pending legal review)
- `i18n.js` — translations (every key must exist in both `en` and `tr`)
- `script.js` — language (`?lang=en|tr`, then saved choice, then browser), theme, health stats
- `og-image.png` — social sharing image (1200×630)

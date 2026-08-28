# PrintMomentum landing page

Static marketing site for [printmomentum.com](https://printmomentum.com). No build step.

## Local preview

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

## Deploy

Pushes to `main` sync this folder to S3 and EC2 via GitHub Actions (`.github/workflows/ci.yml`).

Production path on the box: `/opt/printmomentum/landing` (served by Caddy on `printmomentum.com`).

## Files

- `index.html` — main landing (EN/TR, dark mode, live health stats)
- `privacy.html`, `terms.html` — legal pages
- `i18n.js` — translations
- `og-image.png` — social sharing image (1200×630)

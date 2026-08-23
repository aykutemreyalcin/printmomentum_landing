# PrintMomentum landing page

Static, single-page website for PrintMomentum. It uses the same Editorial Grid visual system as the
product frontend and has no build step or runtime dependencies.

## Local preview

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Select **Other** as the framework preset.
3. Leave the build command empty.
4. Keep the output directory as the repository root (`.`).
5. Deploy.

No environment variables are required.

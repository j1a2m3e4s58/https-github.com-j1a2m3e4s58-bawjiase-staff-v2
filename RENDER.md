# Render Preview Deploy

This repo includes a [render.yaml](C:/Users/james/Downloads/Compressed/bawjiase-staff-portal-main/render.yaml) blueprint for a quick preview deployment on Render.

It creates:

- `bawjiase-staff-api`: Python web service for email and shared presence endpoints
- `bawjiase-staff-preview`: static frontend site

The frontend build uses `VITE_MAIL_API_URL=https://bawjiase-staff-api.onrender.com/api` so upload and API requests go directly to the Render API service during preview deploys.

Note: the static-site build command should use `corepack pnpm ...` directly on Render. Do not use `corepack enable` there, because Render's filesystem can be read-only during builds.

## How to deploy

1. Push this repo to GitHub.
2. In Render, click `New` -> `Blueprint`.
3. Connect the GitHub repo and deploy the blueprint.
4. After the services are created, open the `bawjiase-staff-api` service and set:
   - `MAIL_SERVER`
   - `MAIL_USERNAME`
   - `MAIL_PASSWORD`
   - `MAIL_DEFAULT_SENDER`
   - `PORTAL_PUBLIC_URL`
5. Redeploy the API service after adding those values.

## Important note

The frontend blueprint rewrites `/mail-api/*` to `https://bawjiase-staff-api.onrender.com/*`.

If Render gives your API service a different hostname, update that route in Render or in [render.yaml](C:/Users/james/Downloads/Compressed/bawjiase-staff-portal-main/render.yaml), then redeploy the static site.

## Preview-only caveat

`ALLOWED_ORIGINS` is set to `*` for easier testing on Render previews. Tighten this before production.

The presence store uses a local JSON file, so online-status data is temporary on Render's ephemeral filesystem.

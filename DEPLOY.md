# Deploy: Vercel + Railway (production / staging)

| | Git branch | Vercel | Railway DB | Cloudinary folder |
|---|---|---|---|---|
| Production | `main` | Production deployment | environment `production` | `attendance/production/<employeeCode>/` |
| Staging | `dev` | Preview deployment of `dev` | environment `staging` | `attendance/dev/<employeeCode>/` |

Workflow: work on `dev` -> test on staging -> merge `dev` into `main` -> production.

## 1. Railway (MySQL, one per environment)

1. railway.com -> **New Project** -> **Deploy MySQL**. The default environment is `production`.
2. Top bar -> environment dropdown -> **New Environment** -> name it `staging`
   (choose "Duplicate environment: production" so it also gets its own MySQL service).
3. In each environment: MySQL service -> **Variables** -> copy `MYSQL_PUBLIC_URL`
   (looks like `mysql://root:<pw>@<host>.proxy.rlwy.net:<port>/railway`).
   Use the **public** URL: Vercel runs outside Railway's private network.
4. Append `?connection_limit=5` to it. This becomes `DATABASE_URL` for that environment.
   Serverless functions open many short-lived connections, so cap them.

## 2. Run migrations (from your machine, once per database)

PowerShell, inside `server/`:

```powershell
$env:DATABASE_URL = "<staging DATABASE_URL>"
npx prisma migrate deploy      # applies every migration in prisma/migrations
node prisma/seed.js            # first time only: creates the admin user etc.
node prisma/seed-demo.js       # staging only: demo data. Never on production.
```

Repeat with the production URL (without `seed-demo`).
Use `migrate deploy`, never `migrate dev`, against Railway.
After every future schema change: commit the migration, then run `migrate deploy` against
staging first, then production (before merging to `main`).

## 3. Vercel: two projects from the same repo

Import `The-Emperor-House/attendance-app` twice (Add New -> Project):

| Project | Root Directory | Framework |
|---|---|---|
| `attendance-api` | `server` | Other |
| `attendance-web` | `web` | Nuxt (auto-detected) |

For both: Settings -> Git -> **Production Branch = `main`**.
Every push to `dev` then builds a Preview deployment.

Give `dev` a stable URL: Settings -> Domains -> add e.g. `attendance-api-dev.vercel.app`
and assign it to Git branch `dev`. Same for web (`attendance-web-dev.vercel.app`).
Without this, preview URLs change on every deployment.

## 4. Environment variables (Settings -> Environment Variables)

For each variable, choose the environment scope: **Production** = `main`,
**Preview** (branch `dev`) = staging.

### attendance-api

| Variable | Production | Preview (dev) |
|---|---|---|
| `DATABASE_URL` | production Railway URL | staging Railway URL |
| `JWT_SECRET` | long random string A | a different long random string B |
| `CORS_ORIGIN` | production web URL | staging web URL (`https://attendance-web-dev.vercel.app`) |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | same | same |

`APP_ENV` is not needed: the photo folder is `production` on Vercel Production and `dev` elsewhere.
Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### attendance-web

| Variable | Production | Preview (dev) |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | production API URL | staging API URL |

`NUXT_PUBLIC_API_BASE` is baked in at build time, so redeploy the web project after changing it.

## 5. Verify

1. `https://<api>/health` returns `{"ok":true}`.
2. Log in on the web app, check in with a photo, and confirm the image appears in Cloudinary under
   `attendance/dev/<employeeCode>/` (staging) or `attendance/production/...` (production).
3. Confirm staging and production have different data (they use different databases).

## Troubleshooting

- **CORS error in browser**: `CORS_ORIGIN` on the API must exactly match the web URL (no trailing slash). Redeploy the API.
- **`Prisma Client could not locate the Query Engine` on Vercel**: add
  `binaryTargets = ["native", "rhel-openssl-3.0.x"]` to `generator client` in `schema.prisma`.
- **Photo upload 413**: Vercel caps request bodies at ~4.5MB; the API already limits photos to 4MB.
- **`Too many connections`**: lower `connection_limit` in `DATABASE_URL`.

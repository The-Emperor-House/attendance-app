# Deploy: Vercel + Railway + Cloudinary (production / staging)

This describes how the project is actually set up. No secrets live in this file.

## Overview

| | Production | Staging |
|---|---|---|
| Git branch | `main` | `dev` |
| Web (Vercel project `attendance-app`, root `web`) | `https://attendance-app-wine-seven.vercel.app` | `https://attendance-app-git-dev-emperor-houses-projects.vercel.app` |
| API (Vercel project `attendance-api`, root `server`) | `https://attendance-app-zeta-taupe.vercel.app` | `https://attendance-api-git-dev-emperor-houses-projects.vercel.app` |
| Database | Railway MySQL (production) | Railway MySQL (staging), has demo data |
| Photos (Cloudinary) | `attendance/production/<employeeCode>/` | `attendance/dev/<employeeCode>/` |

- Vercel team `emperor-houses-projects`, **Hobby** plan. Hobby cannot deploy private repos owned by a
  GitHub organization, so the repo `The-Emperor-House/attendance-app` is **public**.
- Staging URLs are the automatic per-branch aliases (`<project>-git-dev-<team>.vercel.app`), stable across
  deployments. No custom domain is needed.
- Workflow: work on `dev` -> test on staging -> merge `dev` into `main` -> Vercel deploys production.

## Local env files (in `server/`, all git-ignored)

| File | Points at | Used by |
|---|---|---|
| `.env` | Railway **staging** DB (local docker URL kept as a comment) | `npm run dev`, `seed.js`, `seed-demo.js` |
| `.env.production` | Railway **production** DB | `npm run seed:prod` only |
| `.env.example` | placeholders | committed as a template |

Vercel does **not** read these files; copy values into Vercel's Environment Variables by hand.

## Environment variables on Vercel

Scope Production = `main`, scope Preview = `dev`.

### `attendance-api`

| Variable | Production | Preview |
|---|---|---|
| `DATABASE_URL` | production Railway public URL (`?connection_limit=5`) | staging Railway public URL (`?connection_limit=5`) |
| `JWT_SECRET` | random string A | a different random string B |
| `CORS_ORIGIN` | production web URL | staging web URL |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | same Cloudinary account | same Cloudinary account |

- `CORS_ORIGIN` must match the web URL exactly (`https://...`, no trailing slash, not a placeholder).
- `APP_ENV` is optional. Photo folder is `production` on a Vercel Production deployment and `dev`
  everywhere else; set `APP_ENV` only to force it.
- `ADMIN_CODE`, `ADMIN_NAME`, `ADMIN_PASSWORD` are only for the seed scripts on your machine.
  The API does not use them, so do **not** keep them on Vercel.
- Use the **Public** Railway URL (`*.proxy.rlwy.net`), not `*.railway.internal`: Vercel is outside Railway's network.

### `attendance-app` (web)

| Variable | Scope | Value |
|---|---|---|
| `NUXT_PUBLIC_API_BASE` | Production only | production API URL |
| `NUXT_PUBLIC_API_BASE` | Preview only | staging API URL |

This value is baked in at build time: redeploy the web project after changing it.

## Vercel project settings

- Both projects: Git -> Production Branch = `main`.
- **Deployment Protection -> Vercel Authentication must be off for Preview** on *both* projects
  (or "Only Production Deployments"). Hobby turns it on by default; with it on, staging URLs answer
  `302` to a Vercel login page and the staging web app cannot call the staging API.
  Changing this is a security setting, so it is done by hand in the dashboard.

## Database (Railway)

Two separate MySQL databases (production, staging). For each: MySQL service -> Variables -> copy
`MYSQL_PUBLIC_URL`, append `?connection_limit=5`, use it as that environment's `DATABASE_URL`.

### Migrations

Run from `server/`, once per database, and again after every schema change (staging first, then production,
**before** merging to `main`). Use `migrate deploy`, never `migrate dev`, against Railway.

```powershell
$env:DATABASE_URL = "<that database's public URL>"
npx prisma migrate deploy
```

> Prisma auto-loads `server/.env` (staging). Always set `DATABASE_URL` explicitly for the target
> database, and double-check the host printed in the output.

### Seeding

| Database | Command | What it does |
|---|---|---|
| Staging | `node prisma/seed.js` then `node prisma/seed-demo.js` | reference data, demo users (`password123`), 40 demo employees, 90 days of history |
| Production | `npm run seed:prod` | reference data (leave categories/quotas) + **one admin** only, no demo data |

- `seed.js` reads `ADMIN_CODE`, `ADMIN_NAME`, `ADMIN_PASSWORD` from `.env`; other demo users still use `password123`.
- `seed:prod` reads `.env.production` (forces it over `.env`), requires `ADMIN_PASSWORD` of 10+ characters,
  prints `Target DB host: ...` before writing, and never resets an existing admin's password.
  Remove `ADMIN_PASSWORD` from `.env.production` afterwards if you do not need it.
- **Login uses the employee code** (`ADMIN_CODE`), not the display name (`ADMIN_NAME`).
- Demo attendance rows point to `/uploads/seed-placeholder.jpg`, which does not exist (photos are on
  Cloudinary now), so those photos will not render on staging.

## Photos (Cloudinary)

Check-in/out photos are uploaded by the API to Cloudinary and the database stores the full
`https://res.cloudinary.com/...` URL. Path: `attendance/<production|dev>/<employeeCode>/<date>-<in|out>-<timestamp>`.
Requests are limited to 4MB (Vercel caps request bodies at ~4.5MB).

Staging and production share one Cloudinary account and are separated by folder.
Deleting photos from Cloudinary breaks the matching rows' images.

## Admins

Admins are managed in the app (Admin -> employees, role "ผู้ดูแลระบบ"). The API refuses to demote,
deactivate or resign the **last active admin** (HTTP 409), so the system cannot lock itself out.

## Deploying

1. Commit and push to `dev`. Vercel builds Preview for both projects (staging).
2. Test on staging.
3. If the schema changed, run `prisma migrate deploy` against production.
4. Merge `dev` into `main` and push. Vercel builds Production. There is no auto-merge on purpose.

**Env var changes only affect new deployments.** To rebuild staging after editing Preview variables,
push a new commit to `dev` (an empty commit works: `git commit --allow-empty -m "rebuild"`).
Vercel's "Redeploy" button on a Production deployment does *not* rebuild `dev`, even if you pick
the Preview target: it redeploys the `main` code.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Browser CORS error; `Access-Control-Allow-Origin` shows `localhost` or a `<placeholder>` | `CORS_ORIGIN` on the API is wrong for that scope. Fix, then rebuild the API. |
| Login button does nothing / requests go to `localhost:4000` | `NUXT_PUBLIC_API_BASE` missing or web not rebuilt. |
| Staging web opens a Vercel login page (`302` to `vercel.com/sso-api`) | Vercel Authentication is still on for Preview. |
| `401 Invalid credentials` | Wrong employee code/password, or the API points at a different database than you seeded. |
| `Invalid Signature` on photo upload | `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` belong to different Cloudinary accounts. Check both in the same scope. |
| `Prisma Client could not locate the Query Engine` on Vercel | Add `binaryTargets = ["native", "rhel-openssl-3.0.x"]` to `generator client` in `schema.prisma`. |
| `Too many connections` | Lower `connection_limit` in `DATABASE_URL`. |
| Photo upload `413` | Photo over ~4MB. |

## Security housekeeping

- Never commit `.env` / `.env.production`. `.gitignore` covers `.env.*` except `.env.example`.
- Secrets pasted into chats or tickets should be rotated: Railway DB passwords, Cloudinary API secrets, admin password.
- In Vercel, mark `DATABASE_URL`, `JWT_SECRET` and `CLOUDINARY_*` as **Secret** type (the dashboard flags them "Needs Attention").

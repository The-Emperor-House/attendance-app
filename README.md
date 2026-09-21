# Attendance App

Check-in / check-out app with geofence verification and photo capture.

## Stack

- **web/** — Nuxt 4 (SPA mode, Tailwind, Pinia)
- **server/** — Express + Prisma + MySQL
- **docker-compose.yml** — local MySQL for development

## Local development

1. Start the database:
   ```
   docker compose up -d
   ```

2. Backend:
   ```
   cd server
   cp .env.example .env
   npm install
   npx prisma migrate dev
   npm run seed
   npm run dev
   ```
   API runs at http://localhost:4000. Seeded accounts (password `password123`):
   - admin@example.com (ADMIN)
   - employee@example.com (EMPLOYEE)

3. Frontend:
   ```
   cd web
   cp .env.example .env
   npm install
   npm run dev
   ```
   App runs at http://localhost:3000.

## Deploying to Vercel

Deploy `web` and `server` as two separate Vercel projects (each points its Vercel "Root Directory" setting at the respective folder).

- **server**: Express is wrapped as a serverless function in `server/api/index.js` with `server/vercel.json` rewriting all routes to it. Set env vars in Vercel: `DATABASE_URL` (a managed MySQL, e.g. PlanetScale/Aiven — Docker MySQL is local-only), `JWT_SECRET`, `CORS_ORIGIN` (the deployed web URL).
- **web**: set `NUXT_PUBLIC_API_BASE` to the deployed server URL.

### Important production note: photo storage

`multer` currently saves photos to local disk (`server/uploads`). Vercel's serverless filesystem is ephemeral — uploaded files will NOT persist between requests in production. Before going live, swap the storage in `server/src/routes/attendance.js` for a persistent object store (Vercel Blob or S3-compatible bucket) and store the resulting URL instead of a local path.

## Project structure

```
attendance-app/
├── docker-compose.yml     # local MySQL
├── server/
│   ├── prisma/schema.prisma
│   ├── prisma/seed.js
│   ├── src/app.js         # Express app (routes, middleware)
│   ├── src/server.js      # local dev entrypoint
│   ├── api/index.js       # Vercel serverless entrypoint
│   └── vercel.json
└── web/
    ├── app/pages/         # login, index (check-in), history, admin
    ├── app/stores/auth.ts
    └── app/composables/useApi.ts
```

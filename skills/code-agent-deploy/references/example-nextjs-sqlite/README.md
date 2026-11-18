# Example: Next.js + SQLite (passed acceptance on the platform)

A minimal project written to the ready-to-deploy checklist. Compare against it when making another project ready:

| File | What to note |
|---|---|
| `Dockerfile` | Multi-stage; the build and the runtime stage both use the platform's `node-base`; `.npmrc` is copied before `npm ci`; `ARG NEXT_PUBLIC_APP_URL` is declared; the runtime stage has `USER 10001` and `CMD ["node", "server.js"]` |
| `.npmrc` | npmmirror, and the binary mirror for better-sqlite3 |
| `.dockerignore` | Excludes node_modules, .next, .env* and the local data directory |
| `next.config.mjs` | `output: 'standalone'` |
| `src/lib/db.ts` | The database path is read from `DATABASE_URL`; locally it defaults to `./data/app.db` |
| `src/app/api/health/route.ts` | The health check: a read-only database check, no business logic |
| `deploy.manifest.json` | sqlite storage, `.next/cache` as ephemeral storage, `SESSION_SECRET` created by the platform, `NEXT_PUBLIC_APP_URL` taken from the application's address |

Notes:
- better-sqlite3 is pinned to 12.x (12.11.1): npmmirror has a prebuilt binary of it for Node 24. It has none for 13.x, and the build would fail.
- `package-lock.json` is not part of this template. In a project, create it with `npm install` and commit it (`npm ci` needs it).

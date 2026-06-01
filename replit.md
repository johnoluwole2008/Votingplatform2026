# PharmSci E-Voting Platform

A secure online student election platform for the Faculty of Pharmaceutical Sciences. ~900 students across 6 academic levels (100L–600L) can register, authenticate, and cast ballots. Admins manage the election lifecycle via a real-time dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/pharmvote run dev` — run the frontend
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed` — seed the database with demo data
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (Tailwind CSS, shadcn/ui, TanStack Query, Wouter)
- API: Express 5 at `/api`
- DB: PostgreSQL + Drizzle ORM
- Auth: express-session + connect-pg-simple (PostgreSQL session store)
- Passwords: bcrypt (cost factor 12), lockout after 5 failures in 15 min
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/election.ts` — all database table definitions (source of truth)
- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for API contract)
- `lib/api-client-react/src/generated/` — auto-generated hooks (do not edit)
- `lib/api-zod/src/generated/` — auto-generated Zod schemas (do not edit)
- `artifacts/api-server/src/routes/` — all Express route handlers
- `artifacts/pharmvote/src/pages/` — all frontend pages
- `artifacts/pharmvote/src/pages/admin/` — admin backend UI

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval → React Query hooks + Zod schemas
- Session auth via PostgreSQL-backed connect-pg-simple (session table must exist before startup — NOT using `createTableIfMissing` because esbuild doesn't bundle the required .sql asset file)
- Ballot anonymity: votes stored with a SHA-256 hash of sessionID+officeId+candidateId+timestamp; no voter-to-vote link in the votes table
- Role-based admin access: `super_admin` (full), `editor` (manage data), `observer` (read-only)
- Phase is computed from timestamps: setup → registration → voting → results

## Product

- **Landing page** (`/`) — shows election phase, countdown, "Cast Your Vote" CTA
- **Student registration** (`/register`) — matric+email verified against official student records
- **Voter login** (`/login`) → ballot selection (`/ballot`) → review (`/ballot-review`) → success
- **Admin portal** (`/admin/login`) — dashboard with live stats, voter management, office/candidate management, results preview, audit log, settings, student records, admin accounts

## Seeded demo data

- **Admin:** `admin@pharmsci.edu.ng` / `Admin@12345` (super_admin)
- **Voters (10 registered):** matric `PHA/2024/001`–`PHA/2024/010`, email `student1@pharmsci.edu.ng`–`student10@pharmsci.edu.ng`, password `Test@12345`
- **Student records:** 30 sample records across 6 levels
- **Election:** 5 offices, 11 candidates, voting currently open

## Gotchas

- **Session table**: `connect-pg-simple` needs the `session` table to exist in PostgreSQL. `createTableIfMissing` is NOT used (esbuild strips the SQL asset file). If you wipe the DB, run: `CREATE TABLE "session" ("sid" varchar NOT NULL, "sess" json NOT NULL, "expire" timestamp(6) NOT NULL, CONSTRAINT "session_pkey" PRIMARY KEY ("sid")); CREATE INDEX "IDX_session_expire" ON "session" ("expire");`
- **Re-seeding**: The seed script skips rows that already exist. To reseed from scratch, truncate the relevant tables first.
- **Orval hooks**: When passing custom query options, spread the `getXxxQueryOptions()` return value (which includes the required `queryKey`) before adding your overrides: `{ query: { ...getXxxQueryOptions(), retry: false } }`
- **List hooks**: Params are the first argument, not inside `{ params: ... }`: `useListVoters(params, options?)`
- **API paths are not rewritten** by the proxy — services must handle their full base path (e.g. `/api/ballot`, not `/ballot`)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

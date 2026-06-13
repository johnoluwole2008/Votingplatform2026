---
name: Session store setup
description: connect-pg-simple session table must be pre-created; createTableIfMissing breaks under esbuild
---

When bundled with esbuild, `connect-pg-simple`'s `createTableIfMissing: true` option fails silently with `ENOENT: .../dist/table.sql`. The package reads a SQL asset file at runtime that esbuild does not bundle. Sessions appear to save (login returns 200) but the session data is never persisted, so every subsequent request starts with an empty session (401).

**Why:** esbuild only bundles JS; SQL/text assets in node_modules are not included in the output bundle.

**How to apply:** Never use `createTableIfMissing: true`. Instead, export an `ensureSessionTable()` async function from `app.ts` that runs the DDL with `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, and call it from `index.ts` before `app.listen()`. This self-heals on every deploy including fresh production databases.

```sql
CREATE TABLE IF NOT EXISTS "session" (
  "sid" varchar NOT NULL COLLATE "default",
  "sess" json NOT NULL,
  "expire" timestamp(6) NOT NULL,
  CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
```

**Production proxy loop fix:** In Replit's deployed environment, also set `app.set("trust proxy", 1)` and `sameSite: "lax"` (not `"strict"`). Without `trust proxy`, Express sees requests as HTTP even over HTTPS — `secure: true` cookies are dropped and every authenticated request returns 401, causing an infinite login→dashboard→login redirect loop.

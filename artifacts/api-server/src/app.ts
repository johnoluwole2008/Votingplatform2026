import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    voterId?: number;
    matricNumber?: string;
    adminId?: number;
    adminEmail?: string;
    adminRole?: string;
    adminName?: string;
  }
}

const PgStore = connectPgSimple(session);

// Ensure the session table exists before the session middleware tries to use it.
// connect-pg-simple's createTableIfMissing is NOT used because esbuild strips
// the bundled .sql asset file. We create it directly with raw SQL instead.
export async function ensureSessionTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid"    varchar        NOT NULL COLLATE "default",
      "sess"   json           NOT NULL,
      "expire" timestamp(6)   NOT NULL,
      CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire")
  `);
}

const app: Express = express();

// Trust Replit's reverse proxy so Express sees HTTPS correctly.
// Without this, `secure: true` cookies are never echoed back by the browser
// because Express thinks the request is plain HTTP.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  session({
    store: new PgStore({
      pool: pool as never,
      tableName: "session",
    }),
    secret: process.env.SESSION_SECRET ?? "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 30 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
    },
  }),
);

app.use("/api", router);

export default app;

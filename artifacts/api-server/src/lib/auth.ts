import bcrypt from "bcrypt";
import { db, loginAttemptsTable } from "@workspace/db";
import { and, eq, gte, count } from "drizzle-orm";

const BCRYPT_ROUNDS = 12;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function recordLoginAttempt(
  matricNumber: string,
  ipAddress: string | undefined,
  success: boolean,
): Promise<void> {
  await db.insert(loginAttemptsTable).values({
    matricNumber,
    ipAddress: ipAddress ?? null,
    success,
  });
}

export async function isAccountLocked(matricNumber: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60 * 1000);
  const [result] = await db
    .select({ failCount: count() })
    .from(loginAttemptsTable)
    .where(
      and(
        eq(loginAttemptsTable.matricNumber, matricNumber),
        eq(loginAttemptsTable.success, false),
        gte(loginAttemptsTable.attemptedAt, windowStart),
      ),
    );
  return (result?.failCount ?? 0) >= MAX_ATTEMPTS;
}

export function getClientIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    return first?.split(",")[0]?.trim();
  }
  return req.ip;
}

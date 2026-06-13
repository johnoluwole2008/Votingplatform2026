import { Router } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, adminsTable, adminInviteTokensTable } from "@workspace/db";
import { hashPassword } from "../../lib/auth";
import { logAuditEvent } from "../../lib/audit";

const router = Router();

function requireSuperAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (req.session.adminRole !== "super_admin") {
    res.status(403).json({ error: "Super admin access required." }); return false;
  }
  return true;
}

router.post("/admin/invites", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;

  const { role = "observer", email } = req.body as { role?: string; email?: string };

  const validRoles = ["super_admin", "editor", "observer"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role. Must be super_admin, editor, or observer." });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await db.insert(adminInviteTokensTable).values({
    token,
    role: role as "super_admin" | "editor" | "observer",
    createdByAdminId: req.session.adminId,
    email: email?.toLowerCase() || null,
    expiresAt,
  });

  await logAuditEvent({
    eventType: "admin_invite_created",
    description: `Invite link created for role: ${role}${email ? ` (pre-filled: ${email})` : ""}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({ token, expiresAt: expiresAt.toISOString(), role });
});

router.get("/admin/invites/:token", async (req, res): Promise<void> => {
  const { token } = req.params;

  const [invite] = await db
    .select()
    .from(adminInviteTokensTable)
    .where(eq(adminInviteTokensTable.token, token))
    .limit(1);

  if (!invite) { res.status(404).json({ error: "Invite not found or invalid." }); return; }
  if (invite.usedAt) { res.status(410).json({ error: "This invite has already been used." }); return; }
  if (new Date() > invite.expiresAt) { res.status(410).json({ error: "This invite link has expired." }); return; }

  res.json({
    valid: true,
    role: invite.role,
    email: invite.email ?? null,
    expiresAt: invite.expiresAt.toISOString(),
  });
});

router.post("/admin/join", async (req, res): Promise<void> => {
  const { token, name, email, password } = req.body as {
    token?: string;
    name?: string;
    email?: string;
    password?: string;
  };

  if (!token || !name || !email || !password) {
    res.status(400).json({ error: "All fields (token, name, email, password) are required." });
    return;
  }
  if (name.trim().length < 2) {
    res.status(400).json({ error: "Name must be at least 2 characters." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  const [invite] = await db
    .select()
    .from(adminInviteTokensTable)
    .where(eq(adminInviteTokensTable.token, token))
    .limit(1);

  if (!invite) { res.status(404).json({ error: "Invite not found or invalid." }); return; }
  if (invite.usedAt) { res.status(410).json({ error: "This invite has already been used." }); return; }
  if (new Date() > invite.expiresAt) { res.status(410).json({ error: "This invite link has expired." }); return; }

  const normalizedEmail = email.toLowerCase();

  const [existing] = await db
    .select({ id: adminsTable.id })
    .from(adminsTable)
    .where(eq(adminsTable.email, normalizedEmail))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "An admin account with this email already exists." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [admin] = await db.insert(adminsTable).values({
    email: normalizedEmail,
    name: name.trim(),
    passwordHash,
    role: invite.role,
  }).returning();

  await db.update(adminInviteTokensTable)
    .set({ usedAt: new Date(), usedByEmail: normalizedEmail })
    .where(eq(adminInviteTokensTable.token, token));

  await logAuditEvent({
    eventType: "admin_account_created_via_invite",
    description: `Admin account created via invite: ${normalizedEmail} (role: ${invite.role})`,
    actorId: normalizedEmail,
    actorType: "admin",
  });

  res.status(201).json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });
});

export default router;

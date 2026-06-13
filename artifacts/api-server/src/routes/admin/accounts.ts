import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import { hashPassword } from "../../lib/auth";
import { logAuditEvent } from "../../lib/audit";
import { CreateAdminAccountBody, DeleteAdminAccountParams } from "@workspace/api-zod";

const router = Router();

function requireSuperAdmin(req: any, res: any): boolean {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return false; }
  if (req.session.adminRole !== "super_admin") {
    res.status(403).json({ error: "Super admin access required." }); return false;
  }
  return true;
}

router.get("/admin/accounts", async (req, res): Promise<void> => {
  if (!req.session.adminId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const accounts = await db.select().from(adminsTable).orderBy(adminsTable.createdAt);

  res.json(
    accounts.map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      createdAt: a.createdAt.toISOString(),
      lastLogin: a.lastLogin?.toISOString() ?? null,
    })),
  );
});

router.post("/admin/accounts", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;

  const parsed = CreateAdminAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { email, name, password, role } = parsed.data;

  const passwordHash = await hashPassword(password);

  const [admin] = await db
    .insert(adminsTable)
    .values({ email: email.toLowerCase(), name, passwordHash, role: role as never })
    .returning();

  await logAuditEvent({
    eventType: "admin_account_created",
    description: `Super admin created new admin account: ${email} (${role})`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.status(201).json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    createdAt: admin.createdAt.toISOString(),
    lastLogin: null,
  });
});

router.put("/admin/accounts/:id/password", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { password } = req.body;
  if (!password || typeof password !== "string" || password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." }); return;
  }

  const [existing] = await db.select().from(adminsTable).where(eq(adminsTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ error: "Account not found" }); return; }

  const passwordHash = await hashPassword(password);
  await db.update(adminsTable).set({ passwordHash }).where(eq(adminsTable.id, id));

  await logAuditEvent({
    eventType: "admin_password_reset",
    description: `Super admin reset password for: ${existing.email}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({ success: true, message: "Password updated" });
});

router.delete("/admin/accounts/:id", async (req, res): Promise<void> => {
  if (!requireSuperAdmin(req, res)) return;

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  if (id === req.session.adminId) {
    res.status(400).json({ error: "Cannot delete your own account." }); return;
  }

  const [deleted] = await db.delete(adminsTable).where(eq(adminsTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Account not found" }); return; }

  await logAuditEvent({
    eventType: "admin_account_deleted",
    description: `Super admin deleted admin account: ${deleted.email}`,
    actorId: String(req.session.adminId),
    actorType: "admin",
  });

  res.json({ success: true, message: "Account deleted" });
});

export default router;

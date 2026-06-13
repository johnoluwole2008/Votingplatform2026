import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import { verifyPassword, hashPassword } from "../../lib/auth";
import { logAuditEvent } from "../../lib/audit";
import { getClientIp } from "../../lib/auth";
import { LoginAdminBody } from "@workspace/api-zod";

const router = Router();

router.post("/admin/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginAdminBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const ip = getClientIp(req);

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, email.toLowerCase()))
    .limit(1);

  if (!admin) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    await logAuditEvent({
      eventType: "admin_login_failed",
      description: `Failed admin login for ${email}`,
      actorId: email,
      actorType: "admin",
      ipAddress: ip,
    });
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  await db
    .update(adminsTable)
    .set({ lastLogin: new Date() })
    .where(eq(adminsTable.id, admin.id));

  req.session.adminId = admin.id;
  req.session.adminEmail = admin.email;
  req.session.adminRole = admin.role;
  req.session.adminName = admin.name;

  await logAuditEvent({
    eventType: "admin_login",
    description: `Admin ${admin.name} (${admin.email}) logged in`,
    actorId: String(admin.id),
    actorType: "admin",
    ipAddress: ip,
  });

  res.json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });
});

router.put("/admin/auth/me/password", async (req, res): Promise<void> => {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Current and new password are required." });
    return;
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters." });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.adminId))
    .limit(1);

  if (!admin) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  const valid = await verifyPassword(currentPassword, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await db.update(adminsTable).set({ passwordHash }).where(eq(adminsTable.id, admin.id));

  await logAuditEvent({
    eventType: "admin_password_changed",
    description: `Admin ${admin.email} changed their own password`,
    actorId: String(admin.id),
    actorType: "admin",
  });

  res.json({ success: true, message: "Password updated successfully." });
});

router.put("/admin/auth/me/email", async (req, res): Promise<void> => {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { currentPassword, newEmail } = req.body;
  if (!currentPassword || !newEmail) {
    res.status(400).json({ error: "Current password and new email are required." });
    return;
  }
  if (typeof newEmail !== "string" || !newEmail.includes("@")) {
    res.status(400).json({ error: "Invalid email address." });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.adminId))
    .limit(1);

  if (!admin) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  const valid = await verifyPassword(currentPassword, admin.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  const normalised = newEmail.toLowerCase().trim();

  const [conflict] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.email, normalised))
    .limit(1);

  if (conflict) {
    res.status(409).json({ error: "That email is already in use." });
    return;
  }

  await db.update(adminsTable).set({ email: normalised }).where(eq(adminsTable.id, admin.id));

  req.session.adminEmail = normalised;

  await logAuditEvent({
    eventType: "admin_email_changed",
    description: `Admin changed email from ${admin.email} to ${normalised}`,
    actorId: String(admin.id),
    actorType: "admin",
  });

  res.json({ success: true, message: "Email updated successfully.", email: normalised });
});

router.post("/admin/auth/logout", async (req, res): Promise<void> => {
  const name = req.session.adminName;
  req.session.destroy(() => {});
  if (name) {
    await logAuditEvent({
      eventType: "admin_logout",
      description: `Admin ${name} logged out`,
      actorType: "admin",
    });
  }
  res.json({ success: true, message: "Logged out" });
});

router.get("/admin/auth/me", async (req, res): Promise<void> => {
  if (!req.session.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [admin] = await db
    .select()
    .from(adminsTable)
    .where(eq(adminsTable.id, req.session.adminId))
    .limit(1);

  if (!admin) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalid" });
    return;
  }

  res.json({
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  });
});

export default router;

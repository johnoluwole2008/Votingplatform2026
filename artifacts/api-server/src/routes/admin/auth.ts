import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, adminsTable } from "@workspace/db";
import { verifyPassword } from "../../lib/auth";
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

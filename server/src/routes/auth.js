import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  employeeCode: z.string().min(1),
  password: z.string().min(6),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { employeeCode, password } = parsed.data;
  const employee = await prisma.employee.findUnique({ where: { employeeCode } });

  if (!employee || !employee.active) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, employee.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = jwt.sign(
    { sub: employee.id, role: employee.role, name: employee.name },
    process.env.JWT_SECRET,
    { expiresIn: "12h" }
  );

  res.json({
    token,
    user: {
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      role: employee.role,
    },
  });
});

// Short-lived, single-purpose token for Excel export links (an <a href> can't set an
// Authorization header). Minting this fresh on click keeps the exposure window to
// minutes instead of reusing the full 12h session JWT in a URL.
router.get("/export-token", requireAuth, (req, res) => {
  const token = jwt.sign(
    { sub: req.user.sub, role: req.user.role, scope: "export" },
    process.env.JWT_SECRET,
    { expiresIn: "5m" }
  );
  res.json({ token });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post("/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const employee = await prisma.employee.findUnique({ where: { id: req.user.sub } });
  const valid = await bcrypt.compare(parsed.data.currentPassword, employee.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "รหัสผ่านปัจจุบันไม่ถูกต้อง" });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.employee.update({ where: { id: req.user.sub }, data: { passwordHash } });
  res.json({ ok: true });
});

export default router;

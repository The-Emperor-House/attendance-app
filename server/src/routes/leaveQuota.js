import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getQuotaSummary } from "../lib/leaveQuota.js";

const router = Router();
router.use(requireAuth);

function currentYear() {
  return new Date().getFullYear();
}

router.get("/me", async (req, res) => {
  const year = req.query.year ? Number(req.query.year) : currentYear();
  const summary = await getQuotaSummary(req.user.sub, year);
  res.json({ year, summary });
});

router.get("/defaults", async (req, res) => {
  const [categories, rows] = await Promise.all([
    prisma.leaveCategory.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    prisma.leaveQuotaDefault.findMany(),
  ]);
  const byType = Object.fromEntries(rows.map((r) => [r.type, r.annualDays]));
  res.json(categories.map(({ code, name }) => ({ type: code, name, annualDays: byType[code] ?? 0 })));
});

const defaultSchema = z.object({
  type: z.string().min(1),
  annualDays: z.number().int().min(0),
});

router.put("/defaults", requireRole("ADMIN"), async (req, res) => {
  const parsed = defaultSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { type, annualDays } = parsed.data;
  const row = await prisma.leaveQuotaDefault.upsert({
    where: { type },
    update: { annualDays },
    create: { type, annualDays },
  });
  res.json(row);
});

router.get("/:employeeId", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const employeeId = Number(req.params.employeeId);
  const year = req.query.year ? Number(req.query.year) : currentYear();
  const summary = await getQuotaSummary(employeeId, year);
  res.json({ year, summary });
});

const overrideSchema = z.object({
  type: z.string().min(1),
  year: z.number().int(),
  days: z.number().int().min(0),
});

router.put("/:employeeId", requireRole("ADMIN"), async (req, res) => {
  const parsed = overrideSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const employeeId = Number(req.params.employeeId);
  const { type, year, days } = parsed.data;

  const row = await prisma.leaveQuota.upsert({
    where: { employeeId_type_year: { employeeId, type, year } },
    update: { days },
    create: { employeeId, type, year, days },
  });
  res.json(row);
});

export default router;

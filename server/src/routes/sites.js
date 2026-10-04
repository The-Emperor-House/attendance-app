import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const siteSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  radiusM: z.number().int().positive().optional(),
});

router.use(requireAuth);

// `?mine=1` returns only the sites the caller may check in at (see canUseSite in
// attendance.js); without it, the full list (used by the admin screens).
router.get("/", async (req, res) => {
  let where;
  if (req.query.mine) {
    const assigned = await prisma.employeeSite.findMany({
      where: { employeeId: req.user.sub },
      select: { siteId: true },
    });
    if (assigned.length) where = { id: { in: assigned.map((a) => a.siteId) } };
  }
  const sites = await prisma.site.findMany({ where, orderBy: { name: "asc" } });
  res.json(sites);
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = siteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const site = await prisma.site.create({ data: parsed.data });
  res.status(201).json(site);
});

router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = siteSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const site = await prisma.site.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
  });
  res.json(site);
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.site.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: "ลบไม่ได้ เนื่องจากมีพนักงานหรือประวัติเช็คอินผูกกับสถานที่นี้อยู่" });
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const departmentSchema = z.object({ name: z.string().min(1) });

router.get("/", async (req, res) => {
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });
  res.json(departments);
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = departmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const department = await prisma.department.create({ data: parsed.data });
  res.status(201).json(department);
});

router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = departmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const department = await prisma.department.update({
    where: { id: Number(req.params.id) },
    data: parsed.data,
  });
  res.json(department);
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.department.delete({ where: { id: Number(req.params.id) } });
    res.status(204).send();
  } catch {
    res.status(409).json({ error: "ลบไม่ได้ เนื่องจากมีพนักงานอยู่ในแผนกนี้" });
  }
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1),
});

router.get("/", async (req, res) => {
  const { year } = req.query;
  const holidays = await prisma.holiday.findMany({
    where: year
      ? { date: { gte: new Date(`${year}-01-01`), lte: new Date(`${year}-12-31`) } }
      : undefined,
    orderBy: { date: "asc" },
  });
  res.json(holidays);
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = holidaySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const holiday = await prisma.holiday.create({
      data: { date: new Date(parsed.data.date), name: parsed.data.name },
    });
    res.status(201).json(holiday);
  } catch {
    res.status(409).json({ error: "มีวันหยุดในวันที่นี้อยู่แล้ว" });
  }
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  await prisma.holiday.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;

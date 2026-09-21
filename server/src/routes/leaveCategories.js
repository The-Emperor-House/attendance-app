import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function slugify(name) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9฀-๿]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 30);
}

router.get("/", async (req, res) => {
  const includeInactive = req.query.all === "true";
  const categories = await prisma.leaveCategory.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: { createdAt: "asc" },
  });
  res.json(categories);
});

const createSchema = z.object({ name: z.string().min(1) });

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const code = slugify(parsed.data.name);
  if (!code) {
    return res.status(400).json({ error: "ชื่อหมวดหมู่ไม่ถูกต้อง" });
  }
  try {
    const category = await prisma.leaveCategory.create({
      data: { code, name: parsed.data.name },
    });
    res.status(201).json(category);
  } catch {
    res.status(409).json({ error: "มีหมวดหมู่นี้อยู่แล้ว" });
  }
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

router.put("/:code", requireRole("ADMIN"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const category = await prisma.leaveCategory.update({
    where: { code: req.params.code },
    data: parsed.data,
  });
  res.json(category);
});

export default router;

import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

const shiftSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  graceMinutes: z.number().int().min(0).default(0),
  workDays: z.array(z.number().int().min(1).max(7)).min(1),
});

// Separate create/update schemas on purpose: zod's `.default()` fires whenever a key
// is absent, even under `.partial()`, so reusing one schema for PUT silently reset
// omitted fields like `role` and `siteIds` to their defaults on every partial edit.
const employeeCreateSchema = z.object({
  employeeCode: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(6),
  role: z.enum(["EMPLOYEE", "SUPERVISOR", "ADMIN"]).default("EMPLOYEE"),
  departmentId: z.number().int().nullable().optional(),
  supervisorId: z.number().int().nullable().optional(),
  siteIds: z.array(z.number().int()).default([]),
  shift: shiftSchema.nullable().optional(),
});

const employeeUpdateSchema = z.object({
  employeeCode: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["EMPLOYEE", "SUPERVISOR", "ADMIN"]).optional(),
  departmentId: z.number().int().nullable().optional(),
  supervisorId: z.number().int().nullable().optional(),
  siteIds: z.array(z.number().int()).optional(),
  shift: shiftSchema.nullable().optional(),
});

const employeeInclude = {
  department: true,
  supervisor: { select: { id: true, name: true, employeeCode: true } },
  shift: true,
  sites: { include: { site: true } },
};

// Blocks any change that would leave the system without an active ADMIN
// (demoting, deactivating or resigning the last one), which would lock everyone out.
async function isLastActiveAdmin(id) {
  const target = await prisma.employee.findUnique({ where: { id }, select: { role: true, active: true } });
  if (!target || target.role !== "ADMIN" || !target.active) return false;
  const others = await prisma.employee.count({ where: { role: "ADMIN", active: true, id: { not: id } } });
  return others === 0;
}

const LAST_ADMIN_ERROR = "ไม่สามารถดำเนินการได้ เพราะเป็นผู้ดูแลระบบคนสุดท้าย ต้องมีผู้ดูแลระบบอย่างน้อย 1 คน";

function omitPassword({ passwordHash, ...rest }) {
  return rest;
}

router.get("/", async (req, res) => {
  const { search, departmentId, page = "1", pageSize = "20" } = req.query;

  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: String(search) } },
            { employeeCode: { contains: String(search) } },
          ],
        }
      : {}),
    ...(departmentId ? { departmentId: Number(departmentId) } : {}),
  };

  const take = Math.min(Number(pageSize) || 20, 100);
  const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      include: employeeInclude,
      skip,
      take,
    }),
    prisma.employee.count({ where }),
  ]);

  res.json({ data: employees.map(omitPassword), total, page: Number(page), pageSize: take });
});

router.post("/", async (req, res) => {
  const parsed = employeeCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { employeeCode, name, email, password, role, departmentId, supervisorId, siteIds, shift } = parsed.data;

  const passwordHash = await bcrypt.hash(password, 10);
  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      name,
      email,
      passwordHash,
      role,
      departmentId,
      supervisorId,
      sites: {
        create: siteIds.map((siteId, i) => ({ siteId, isDefault: i === 0 })),
      },
      shift: shift ? { create: shift } : undefined,
    },
    include: employeeInclude,
  });

  res.status(201).json(omitPassword(employee));
});

router.put("/:id", async (req, res) => {
  const parsed = employeeUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { password, siteIds, shift, ...rest } = parsed.data;
  const data = { ...rest };
  if (password) {
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  const employeeId = Number(req.params.id);

  if (data.supervisorId === employeeId) {
    return res.status(400).json({ error: "พนักงานไม่สามารถเป็นหัวหน้าของตัวเองได้" });
  }

  if (data.role && data.role !== "ADMIN" && (await isLastActiveAdmin(employeeId))) {
    return res.status(409).json({ error: LAST_ADMIN_ERROR });
  }

  const employee = await prisma.employee.update({
    where: { id: employeeId },
    data,
  });

  if (siteIds) {
    await prisma.employeeSite.deleteMany({ where: { employeeId } });
    await prisma.employeeSite.createMany({
      data: siteIds.map((siteId, i) => ({ employeeId, siteId, isDefault: i === 0 })),
    });
  }

  if (shift !== undefined) {
    if (shift === null) {
      await prisma.shift.deleteMany({ where: { employeeId } });
    } else {
      await prisma.shift.upsert({
        where: { employeeId },
        update: shift,
        create: { ...shift, employeeId },
      });
    }
  }

  const full = await prisma.employee.findUnique({ where: { id: employeeId }, include: employeeInclude });
  res.json(omitPassword(full));
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (await isLastActiveAdmin(id)) {
    return res.status(409).json({ error: LAST_ADMIN_ERROR });
  }
  await prisma.employee.update({
    where: { id },
    data: { active: false },
  });
  res.status(204).send();
});

const resignSchema = z.object({
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resignationType: z.enum(["RESIGNED", "TERMINATED", "RETIRED", "OTHER"]),
  resignationReason: z.string().optional(),
});

router.post("/:id/resign", async (req, res) => {
  const parsed = resignSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const id = Number(req.params.id);
  if (await isLastActiveAdmin(id)) {
    return res.status(409).json({ error: LAST_ADMIN_ERROR });
  }
  const employee = await prisma.employee.update({
    where: { id },
    data: {
      active: false,
      resignedAt: new Date(parsed.data.effectiveDate),
      resignationType: parsed.data.resignationType,
      resignationReason: parsed.data.resignationReason,
    },
    include: employeeInclude,
  });
  res.json(omitPassword(employee));
});

router.post("/:id/reactivate", async (req, res) => {
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { active: true, resignedAt: null, resignationType: null, resignationReason: null },
    include: employeeInclude,
  });
  res.json(omitPassword(employee));
});

export default router;

import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { getQuotaDays, getUsedDays, daysInclusive } from "../lib/leaveQuota.js";

const router = Router();
router.use(requireAuth);

const leaveSchema = z.object({
  type: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = leaveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { type, startDate, endDate, reason } = parsed.data;

  const category = await prisma.leaveCategory.findUnique({ where: { code: type } });
  if (!category || !category.active) {
    return res.status(400).json({ error: "หมวดหมู่การลานี้ไม่มีอยู่หรือถูกปิดใช้งานแล้ว" });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    return res.status(400).json({ error: "วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด" });
  }

  const requestedDays = daysInclusive(start, end);
  const year = start.getUTCFullYear();
  const [quota, used] = await Promise.all([
    getQuotaDays(req.user.sub, type, year),
    getUsedDays(req.user.sub, type, year),
  ]);
  const remaining = quota - used;
  if (requestedDays > remaining) {
    return res.status(400).json({
      error: `โควตาไม่พอ: ขอ ${requestedDays} วัน แต่เหลือโควตา ${Math.max(remaining, 0)} วัน`,
    });
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      employeeId: req.user.sub,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
    },
  });
  res.status(201).json(leave);
});

router.get("/me", async (req, res) => {
  const leaves = await prisma.leaveRequest.findMany({
    where: { employeeId: req.user.sub },
    orderBy: { startDate: "desc" },
  });
  res.json(leaves);
});

router.delete("/:id", async (req, res) => {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: Number(req.params.id) } });
  if (!leave || leave.employeeId !== req.user.sub) {
    return res.status(404).json({ error: "Not found" });
  }
  if (leave.status !== "PENDING") {
    return res.status(409).json({ error: "ยกเลิกได้เฉพาะคำขอที่ยังไม่อนุมัติ" });
  }
  await prisma.leaveRequest.delete({ where: { id: leave.id } });
  res.status(204).send();
});

const leaveStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]).optional();

router.get("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const statusParsed = leaveStatusSchema.safeParse(req.query.status || undefined);
  if (!statusParsed.success) {
    return res.status(400).json({ error: "Invalid status filter" });
  }
  const status = statusParsed.data;

  // Supervisors only see leave requests from employees assigned to them; admins see everyone.
  const employeeScope = req.user.role === "SUPERVISOR" ? { supervisorId: req.user.sub } : {};

  const leaves = await prisma.leaveRequest.findMany({
    where: { ...(status ? { status } : {}), employee: employeeScope },
    orderBy: { createdAt: "desc" },
    include: { employee: { include: { department: true } }, approvedBy: true },
  });
  res.json(leaves);
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

router.post("/:id/decide", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const existing = await prisma.leaveRequest.findUnique({
    where: { id: Number(req.params.id) },
    include: { employee: true },
  });
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }
  if (req.user.role === "SUPERVISOR" && existing.employee.supervisorId !== req.user.sub) {
    return res.status(403).json({ error: "คุณไม่ได้เป็นหัวหน้างานของพนักงานคนนี้" });
  }

  const leave = await prisma.leaveRequest.update({
    where: { id: Number(req.params.id) },
    data: {
      status: parsed.data.decision,
      approvedById: req.user.sub,
      approvedAt: new Date(),
      approverNote: parsed.data.note,
    },
  });
  res.json(leave);
});

export default router;

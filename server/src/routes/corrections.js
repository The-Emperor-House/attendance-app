import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { canUseSite } from "../lib/attendance.js";
import { bangkokTodayDateOnly, wallClockInterval, isLateCheckIn, resolveShift } from "../lib/time.js";
import { requireAuth, requireRole, employeeScope } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// How far back an employee may ask for a correction.
const MAX_DAYS_BACK = 30;
const DAY_MS = 86400000;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const createSchema = z.discriminatedUnion("type", [
  // Change an existing visit, e.g. add the check-out that was forgotten.
  z.object({
    type: z.literal("FIX_VISIT"),
    attendanceId: z.number().int(),
    checkInTime: hhmm.optional(),
    checkOutTime: hhmm.optional(),
    reason: z.string().trim().min(1, "กรุณาระบุเหตุผล"),
  }),
  // Record a visit that was never checked in.
  z.object({
    type: z.literal("ADD_VISIT"),
    siteId: z.number().int(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkInTime: hhmm,
    checkOutTime: hhmm,
    reason: z.string().trim().min(1, "กรุณาระบุเหตุผล"),
  }),
]);

function validateTimes(date, checkInAt, checkOutAt) {
  const today = bangkokTodayDateOnly();
  if (date > today) return "เลือกวันในอนาคตไม่ได้";
  if (today.getTime() - date.getTime() > MAX_DAYS_BACK * DAY_MS) {
    return `ขอแก้ไขย้อนหลังได้ไม่เกิน ${MAX_DAYS_BACK} วัน`;
  }
  const now = new Date();
  if ((checkInAt && checkInAt > now) || (checkOutAt && checkOutAt > now)) return "เวลาที่ขอต้องไม่อยู่ในอนาคต";
  if (checkInAt && checkOutAt && checkOutAt <= checkInAt) return "เวลาเช็คเอาต์ต้องหลังเวลาเช็คอิน";
  return null;
}

// Another visit of this employee overlapping [checkInAt, checkOutAt].
function findOverlap(employeeId, checkInAt, checkOutAt, excludeId) {
  return prisma.dailyAttendance.findFirst({
    where: {
      employeeId,
      id: excludeId ? { not: excludeId } : undefined,
      checkInAt: { lt: checkOutAt },
      OR: [{ checkOutAt: { gt: checkInAt } }, { checkOutAt: null, checkInAt: { gte: checkInAt } }],
    },
    include: { site: true },
  });
}

async function overlapMessage(employeeId, checkInAt, checkOutAt, excludeId) {
  if (!checkInAt || !checkOutAt) return null;
  const overlap = await findOverlap(employeeId, checkInAt, checkOutAt, excludeId);
  return overlap ? `ช่วงเวลานี้ซ้อนกับรอบที่ ${overlap.site.name} ที่บันทึกไว้แล้ว` : null;
}

// The interval a correction would leave its visit with once applied.
async function resultingInterval(correction) {
  if (correction.type === "ADD_VISIT") {
    return { checkInAt: correction.checkInAt, checkOutAt: correction.checkOutAt, excludeId: undefined };
  }
  const visit = await prisma.dailyAttendance.findUnique({ where: { id: correction.attendanceId } });
  return {
    checkInAt: correction.checkInAt ?? visit.checkInAt,
    checkOutAt: correction.checkOutAt ?? visit.checkOutAt,
    excludeId: visit.id,
  };
}

const correctionInclude = {
  site: true,
  attendance: { include: { site: true } },
  reviewedBy: { select: { id: true, name: true } },
};

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const input = parsed.data;
  const employeeId = req.user.sub;

  let data;
  if (input.type === "FIX_VISIT") {
    if (!input.checkInTime && !input.checkOutTime) {
      return res.status(400).json({ error: "กรุณาระบุเวลาที่ต้องการแก้ไขอย่างน้อย 1 ช่อง" });
    }
    const visit = await prisma.dailyAttendance.findFirst({ where: { id: input.attendanceId, employeeId } });
    if (!visit) {
      return res.status(404).json({ error: "ไม่พบรายการเช็คอินนี้" });
    }
    const pending = await prisma.attendanceCorrection.findFirst({
      where: { attendanceId: visit.id, status: "PENDING" },
    });
    if (pending) {
      return res.status(409).json({ error: "รายการนี้มีคำขอแก้ไขที่รออนุมัติอยู่แล้ว" });
    }

    const requested = wallClockInterval(visit.date, input.checkInTime, input.checkOutTime, visit.checkInAt, visit.checkOutAt);
    const error = validateTimes(visit.date, requested.checkInAt, requested.checkOutAt);
    if (error) return res.status(400).json({ error });
    const overlapError = await overlapMessage(employeeId, requested.checkInAt, requested.checkOutAt, visit.id);
    if (overlapError) return res.status(409).json({ error: overlapError });

    data = {
      type: "FIX_VISIT",
      attendanceId: visit.id,
      siteId: visit.siteId,
      date: visit.date,
      // Only the fields being changed; null means "keep what's recorded".
      checkInAt: input.checkInTime ? requested.checkInAt : null,
      checkOutAt: input.checkOutTime ? requested.checkOutAt : null,
    };
  } else {
    const date = new Date(`${input.date}T00:00:00.000Z`);
    const { checkInAt, checkOutAt } = wallClockInterval(date, input.checkInTime, input.checkOutTime);
    const error = validateTimes(date, checkInAt, checkOutAt);
    if (error) return res.status(400).json({ error });

    const site = await prisma.site.findUnique({ where: { id: input.siteId } });
    if (!site) {
      return res.status(404).json({ error: "Site not found" });
    }
    if (!(await canUseSite(employeeId, site.id))) {
      return res.status(403).json({ error: "คุณไม่ได้รับสิทธิ์ให้ลงเวลาที่สถานที่นี้" });
    }
    const overlapError = await overlapMessage(employeeId, checkInAt, checkOutAt);
    if (overlapError) return res.status(409).json({ error: overlapError });

    data = { type: "ADD_VISIT", siteId: site.id, date, checkInAt, checkOutAt };
  }

  const correction = await prisma.attendanceCorrection.create({
    data: { ...data, employeeId, reason: input.reason },
    include: correctionInclude,
  });
  res.status(201).json(correction);
});

router.get("/me", async (req, res) => {
  const corrections = await prisma.attendanceCorrection.findMany({
    where: { employeeId: req.user.sub },
    orderBy: { createdAt: "desc" },
    include: correctionInclude,
    take: 50,
  });
  res.json(corrections);
});

router.delete("/:id", async (req, res) => {
  const { count } = await prisma.attendanceCorrection.deleteMany({
    where: { id: Number(req.params.id), employeeId: req.user.sub, status: "PENDING" },
  });
  if (count === 0) {
    return res.status(409).json({ error: "ยกเลิกได้เฉพาะคำขอของคุณที่ยังรออนุมัติ" });
  }
  res.status(204).send();
});

const statusFilterSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]).optional();

router.get("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsedStatus = statusFilterSchema.safeParse(req.query.status || undefined);
  if (!parsedStatus.success) {
    return res.status(400).json({ error: "Invalid status filter" });
  }
  const corrections = await prisma.attendanceCorrection.findMany({
    where: {
      ...(parsedStatus.data ? { status: parsedStatus.data } : {}),
      employee: employeeScope(req.user),
    },
    orderBy: { createdAt: "desc" },
    include: { ...correctionInclude, employee: { include: { department: true } } },
    take: 500,
  });
  res.json(corrections);
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().optional(),
});

// Applies an approved correction to DailyAttendance. Runs inside the decision's
// transaction, so a failure here leaves the request PENDING.
async function applyCorrection(tx, correction, reviewerId) {
  const audit = { editedByHr: true, editedById: reviewerId, editedAt: new Date() };
  const noteLine = `แก้ไขตามคำขอ #${correction.id}: ${correction.reason}`;

  if (correction.type === "FIX_VISIT") {
    const visit = await tx.dailyAttendance.findUnique({ where: { id: correction.attendanceId } });
    await tx.dailyAttendance.update({
      where: { id: visit.id },
      data: {
        ...(correction.checkInAt ? { checkInAt: correction.checkInAt } : {}),
        ...(correction.checkOutAt ? { checkOutAt: correction.checkOutAt } : {}),
        note: visit.note ? `${visit.note}\n${noteLine}` : noteLine,
        ...audit,
      },
    });
    return visit.id;
  }

  const sameDay = await tx.dailyAttendance.findMany({
    where: { employeeId: correction.employeeId, date: correction.date },
    select: { seq: true, checkInAt: true },
  });
  const seq = Math.max(0, ...sameDay.map((v) => v.seq)) + 1;
  // Only the day's first arrival can be late, same as a live check-in.
  const isFirstOfDay = sameDay.every((v) => !v.checkInAt || v.checkInAt > correction.checkInAt);
  const employee = await tx.employee.findUnique({ where: { id: correction.employeeId }, include: { shift: true } });
  const shift = resolveShift(employee);
  const late = isFirstOfDay && shift ? isLateCheckIn(correction.checkInAt, shift.startTime, shift.graceMinutes) : false;

  const visit = await tx.dailyAttendance.create({
    data: {
      employeeId: correction.employeeId,
      siteId: correction.siteId,
      date: correction.date,
      seq,
      checkInAt: correction.checkInAt,
      checkOutAt: correction.checkOutAt,
      checkInLate: late,
      note: noteLine,
      ...audit,
    },
  });
  return visit.id;
}

router.post("/:id/decide", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const id = Number(req.params.id);
  const correction = await prisma.attendanceCorrection.findFirst({
    where: { id, employee: employeeScope(req.user) },
  });
  if (!correction) {
    return res.status(404).json({ error: "Not found" });
  }
  if (correction.status !== "PENDING") {
    return res.status(409).json({ error: "คำขอนี้ถูกดำเนินการไปแล้ว" });
  }
  if (parsed.data.decision === "APPROVED") {
    // Re-check: a check-in or another approval may have filled this time slot since.
    const { checkInAt, checkOutAt, excludeId } = await resultingInterval(correction);
    const overlapError = await overlapMessage(correction.employeeId, checkInAt, checkOutAt, excludeId);
    if (overlapError) return res.status(409).json({ error: `อนุมัติไม่ได้: ${overlapError}` });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Conditional on PENDING so two reviewers deciding at once can't both apply it.
      const { count } = await tx.attendanceCorrection.updateMany({
        where: { id, status: "PENDING" },
        data: {
          status: parsed.data.decision,
          reviewedById: req.user.sub,
          reviewedAt: new Date(),
          reviewerNote: parsed.data.note,
        },
      });
      if (count === 0) return null;

      if (parsed.data.decision === "APPROVED") {
        const attendanceId = await applyCorrection(tx, correction, req.user.sub);
        await tx.attendanceCorrection.update({ where: { id }, data: { attendanceId } });
      }
      return tx.attendanceCorrection.findUnique({ where: { id }, include: correctionInclude });
    });
    if (!updated) {
      return res.status(409).json({ error: "คำขอนี้ถูกดำเนินการไปแล้ว" });
    }
    res.json(updated);
  } catch (err) {
    // The employee checked in on the same day at the same moment and took the seq.
    if (err.code === "P2002") {
      return res.status(409).json({ error: "มีการบันทึกเวลาซ้อนกัน กรุณาลองอนุมัติอีกครั้ง" });
    }
    throw err;
  }
});

export default router;

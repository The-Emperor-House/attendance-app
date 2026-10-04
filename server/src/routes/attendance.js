import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { uploadPhoto } from "../lib/cloudinary.js";
import { distanceMeters } from "../lib/geo.js";
import { canUseSite, findOpenVisit, visitOrdinals } from "../lib/attendance.js";
import { bangkokTodayDateOnly, isLateCheckIn, resolveShift } from "../lib/time.js";
import { requireAuth, requireRole, employeeScope } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Vercel functions cap request bodies at ~4.5MB, so keep the limit below that.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed"));
    }
    cb(null, true);
  },
});

const checkSchema = z.object({
  siteId: z.coerce.number().int(),
  lat: z.coerce.number(),
  lng: z.coerce.number(),
  note: z.string().optional(),
  // Multipart fields arrive as strings; z.coerce.boolean() would turn "false" into true.
  isOffSite: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

// Check-out always happens at the check-in site, so siteId is optional there and,
// if sent, must match.
const checkOutSchema = checkSchema.extend({ siteId: z.coerce.number().int().optional() });

const SITE_NOT_ASSIGNED = "คุณไม่ได้รับสิทธิ์ให้ลงเวลาที่สถานที่นี้";
const CONCURRENT_SUBMIT = "มีการบันทึกซ้อนกัน กรุณาโหลดหน้าใหม่แล้วตรวจสอบอีกครั้ง";

function siteStatus(site, lat, lng, isOffSite) {
  const distanceM = distanceMeters(lat, lng, site.lat, site.lng);
  const status = isOffSite ? "OFF_SITE" : distanceM <= site.radiusM ? "NORMAL" : "OUT_OF_RANGE";
  return { distanceM, status };
}

router.post("/check-in", upload.single("photo"), async (req, res) => {
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Photo is required" });
  }

  const { siteId, lat, lng, note, isOffSite } = parsed.data;
  const date = bangkokTodayDateOnly();
  const [site, employee, openVisit, lastVisitToday] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId } }),
    prisma.employee.findUnique({ where: { id: req.user.sub }, include: { shift: true } }),
    findOpenVisit(req.user.sub),
    prisma.dailyAttendance.findFirst({
      where: { employeeId: req.user.sub, date },
      orderBy: { seq: "desc" },
      select: { seq: true },
    }),
  ]);
  if (!site) {
    return res.status(404).json({ error: "Site not found" });
  }
  if (!(await canUseSite(req.user.sub, siteId))) {
    return res.status(403).json({ error: SITE_NOT_ASSIGNED });
  }
  if (openVisit) {
    return res.status(409).json({
      error: `ยังไม่ได้เช็คเอาต์จาก ${openVisit.site.name} กรุณาเช็คเอาต์ก่อนเช็คอินที่ใหม่`,
    });
  }

  const seq = (lastVisitToday?.seq ?? 0) + 1;
  const { distanceM, status } = siteStatus(site, lat, lng, isOffSite);
  const checkInAt = new Date();
  // Lateness is about arriving for the day, so only the first visit can be late.
  const shift = resolveShift(employee);
  const late = seq === 1 && shift ? isLateCheckIn(checkInAt, shift.startTime, shift.graceMinutes) : false;

  try {
    const record = await prisma.dailyAttendance.create({
      data: {
        employeeId: req.user.sub,
        siteId,
        date,
        seq,
        checkInAt,
        checkInLat: lat,
        checkInLng: lng,
        checkInDistanceM: distanceM,
        checkInPhotoUrl: await uploadPhoto(req.file.buffer, employee.employeeCode, "in"),
        checkInStatus: status,
        checkInLate: late,
        note,
      },
      include: { site: true },
    });
    res.status(201).json(record);
  } catch (err) {
    // A double-submit raced past the checks above and took the same seq.
    if (err.code === "P2002") {
      return res.status(409).json({ error: CONCURRENT_SUBMIT });
    }
    throw err;
  }
});

router.post("/check-out", upload.single("photo"), async (req, res) => {
  const parsed = checkOutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Photo is required" });
  }

  const { siteId, lat, lng, note, isOffSite } = parsed.data;
  const [openVisit, employee] = await Promise.all([
    findOpenVisit(req.user.sub),
    prisma.employee.findUnique({ where: { id: req.user.sub }, select: { employeeCode: true } }),
  ]);

  if (!openVisit) {
    return res.status(400).json({ error: "ไม่มีรายการเช็คอินที่ยังไม่ได้เช็คเอาต์" });
  }
  // Distance and status are measured against the visit's own site; the row stores
  // one site, so checking out elsewhere would be reported as if it happened there.
  const site = openVisit.site;
  if (siteId !== undefined && siteId !== site.id) {
    return res.status(400).json({ error: `ต้องเช็คเอาต์ที่สถานที่เดียวกับที่เช็คอิน (${site.name})` });
  }

  const { distanceM, status } = siteStatus(site, lat, lng, isOffSite);
  const { count } = await prisma.dailyAttendance.updateMany({
    where: { id: openVisit.id, checkOutAt: null },
    data: {
      checkOutAt: new Date(),
      checkOutLat: lat,
      checkOutLng: lng,
      checkOutDistanceM: distanceM,
      checkOutPhotoUrl: await uploadPhoto(req.file.buffer, employee.employeeCode, "out"),
      checkOutStatus: status,
      note: note ?? openVisit.note,
    },
  });
  if (count === 0) {
    return res.status(409).json({ error: CONCURRENT_SUBMIT });
  }

  res
    .status(201)
    .json(await prisma.dailyAttendance.findUnique({ where: { id: openVisit.id }, include: { site: true } }));
});

// Today's visits plus the visit waiting for check-out (which may have started
// yesterday for a shift crossing midnight).
router.get("/today", async (req, res) => {
  const [visits, openVisit] = await Promise.all([
    prisma.dailyAttendance.findMany({
      where: { employeeId: req.user.sub, date: bangkokTodayDateOnly() },
      orderBy: { checkInAt: "asc" },
      include: { site: true },
    }),
    findOpenVisit(req.user.sub),
  ]);
  res.json({ visits: visits.map((v, i) => ({ ...v, visitNo: i + 1 })), openVisit });
});

router.get("/me", async (req, res) => {
  const records = await prisma.dailyAttendance.findMany({
    where: { employeeId: req.user.sub },
    orderBy: [{ date: "desc" }, { checkInAt: "desc" }],
    include: { site: true },
    take: 100,
  });
  const ordinals = visitOrdinals(records);
  res.json(records.map((r) => ({ ...r, visitNo: ordinals.get(r.id) })));
});

const statusFilterSchema = z.enum(["NORMAL", "OUT_OF_RANGE", "OFF_SITE"]).optional();

router.get("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const { siteId, employeeId, from, to } = req.query;

  const statusParsed = statusFilterSchema.safeParse(req.query.status || undefined);
  if (!statusParsed.success) {
    return res.status(400).json({ error: "Invalid status filter" });
  }
  const status = statusParsed.data;

  const baseWhere = {
    siteId: siteId ? Number(siteId) : undefined,
    employeeId: employeeId ? Number(employeeId) : undefined,
    date: {
      gte: from ? new Date(from) : undefined,
      lte: to ? new Date(to) : undefined,
    },
    employee: employeeScope(req.user),
  };

  const records = await prisma.dailyAttendance.findMany({
    where: {
      ...baseWhere,
      ...(status ? { OR: [{ checkInStatus: status }, { checkOutStatus: status }] } : {}),
    },
    orderBy: [{ date: "desc" }, { employeeId: "asc" }, { checkInAt: "asc" }],
    include: { employee: true, site: true },
    take: 10000,
  });

  // With a status filter some visits of a day are missing, so number visits against
  // the unfiltered set (ids and times only) to keep "visit N" correct.
  const ordinals = visitOrdinals(
    status
      ? await prisma.dailyAttendance.findMany({
          where: baseWhere,
          select: { id: true, employeeId: true, date: true, checkInAt: true },
        })
      : records
  );
  res.json(records.map((r) => ({ ...r, visitNo: ordinals.get(r.id) })));
});

const editSchema = z.object({
  checkInAt: z.string().datetime().nullable().optional(),
  checkOutAt: z.string().datetime().nullable().optional(),
  checkInStatus: z.enum(["NORMAL", "OUT_OF_RANGE", "OFF_SITE"]).optional(),
  checkOutStatus: z.enum(["NORMAL", "OUT_OF_RANGE", "OFF_SITE"]).optional(),
  checkInLate: z.boolean().optional(),
  note: z.string().optional(),
});

router.put("/:id", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const parsed = editSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { checkInAt, checkOutAt, ...rest } = parsed.data;
  const data = { ...rest };
  if (checkInAt !== undefined) data.checkInAt = checkInAt ? new Date(checkInAt) : null;
  if (checkOutAt !== undefined) data.checkOutAt = checkOutAt ? new Date(checkOutAt) : null;

  const existing = await prisma.dailyAttendance.findFirst({
    where: { id: Number(req.params.id), employee: employeeScope(req.user) },
  });
  if (!existing) {
    return res.status(404).json({ error: "Not found" });
  }

  const record = await prisma.dailyAttendance.update({
    where: { id: existing.id },
    data: {
      ...data,
      editedByHr: true,
      editedById: req.user.sub,
      editedAt: new Date(),
    },
  });

  res.json(record);
});

export default router;

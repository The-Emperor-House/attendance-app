import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { distanceMeters } from "../lib/geo.js";
import { isLateCheckIn, resolveShift } from "../lib/time.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const uploadDir = process.env.UPLOAD_DIR || "./uploads";
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${req.user.sub}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
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
  isOffSite: z.coerce.boolean().optional().default(false),
});

function todayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
  const [site, employee] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId } }),
    prisma.employee.findUnique({ where: { id: req.user.sub }, include: { shift: true } }),
  ]);
  if (!site) {
    return res.status(404).json({ error: "Site not found" });
  }

  const date = todayDateOnly();
  const existing = await prisma.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId: req.user.sub, date } },
  });

  if (existing?.checkInAt) {
    return res.status(409).json({ error: "วันนี้เช็คอินไปแล้ว หากผิดพลาดให้ติดต่อ HR" });
  }

  const distanceM = distanceMeters(lat, lng, site.lat, site.lng);
  const status = isOffSite ? "OFF_SITE" : distanceM <= site.radiusM ? "NORMAL" : "OUT_OF_RANGE";
  const checkInAt = new Date();
  const shift = resolveShift(employee);
  const late = shift ? isLateCheckIn(checkInAt, shift.startTime, shift.graceMinutes) : false;

  const data = {
    checkInAt,
    checkInLat: lat,
    checkInLng: lng,
    checkInDistanceM: distanceM,
    checkInPhotoUrl: `/uploads/${req.file.filename}`,
    checkInStatus: status,
    checkInLate: late,
    note,
  };

  const record = existing
    ? await prisma.dailyAttendance.update({ where: { id: existing.id }, data: { ...data, siteId } })
    : await prisma.dailyAttendance.create({
        data: { employeeId: req.user.sub, siteId, date, ...data },
      });

  res.status(201).json(record);
});

router.post("/check-out", upload.single("photo"), async (req, res) => {
  const parsed = checkSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Photo is required" });
  }

  const { siteId, lat, lng, note, isOffSite } = parsed.data;
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    return res.status(404).json({ error: "Site not found" });
  }

  const date = todayDateOnly();
  const existing = await prisma.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId: req.user.sub, date } },
  });

  if (!existing?.checkInAt) {
    return res.status(400).json({ error: "ยังไม่ได้เช็คอินวันนี้" });
  }
  if (existing.checkOutAt) {
    return res.status(409).json({ error: "วันนี้เช็คเอาต์ไปแล้ว หากผิดพลาดให้ติดต่อ HR" });
  }

  const distanceM = distanceMeters(lat, lng, site.lat, site.lng);
  const status = isOffSite ? "OFF_SITE" : distanceM <= site.radiusM ? "NORMAL" : "OUT_OF_RANGE";

  const record = await prisma.dailyAttendance.update({
    where: { id: existing.id },
    data: {
      checkOutAt: new Date(),
      checkOutLat: lat,
      checkOutLng: lng,
      checkOutDistanceM: distanceM,
      checkOutPhotoUrl: `/uploads/${req.file.filename}`,
      checkOutStatus: status,
      note: note ?? existing.note,
    },
  });

  res.status(201).json(record);
});

router.get("/today", async (req, res) => {
  const record = await prisma.dailyAttendance.findUnique({
    where: { employeeId_date: { employeeId: req.user.sub, date: todayDateOnly() } },
  });
  res.json(record);
});

router.get("/me", async (req, res) => {
  const records = await prisma.dailyAttendance.findMany({
    where: { employeeId: req.user.sub },
    orderBy: { date: "desc" },
    include: { site: true },
    take: 100,
  });
  res.json(records);
});

const statusFilterSchema = z.enum(["NORMAL", "OUT_OF_RANGE", "OFF_SITE"]).optional();

router.get("/", requireRole("ADMIN", "SUPERVISOR"), async (req, res) => {
  const { siteId, employeeId, from, to } = req.query;

  const statusParsed = statusFilterSchema.safeParse(req.query.status || undefined);
  if (!statusParsed.success) {
    return res.status(400).json({ error: "Invalid status filter" });
  }
  const status = statusParsed.data;

  const records = await prisma.dailyAttendance.findMany({
    where: {
      siteId: siteId ? Number(siteId) : undefined,
      employeeId: employeeId ? Number(employeeId) : undefined,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
      ...(status
        ? { OR: [{ checkInStatus: status }, { checkOutStatus: status }] }
        : {}),
    },
    orderBy: { date: "desc" },
    include: { employee: true, site: true },
    take: 10000,
  });
  res.json(records);
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

  const record = await prisma.dailyAttendance.update({
    where: { id: Number(req.params.id) },
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

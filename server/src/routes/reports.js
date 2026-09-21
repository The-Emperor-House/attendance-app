import { Router } from "express";
import ExcelJS from "exceljs";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { formatTimeHHMM, formatDateISO } from "../lib/time.js";

const router = Router();
router.use(requireAuth, requireRole("ADMIN", "SUPERVISOR"));

router.get("/export", async (req, res) => {
  const { siteId, from, to } = req.query;

  const records = await prisma.dailyAttendance.findMany({
    where: {
      siteId: siteId ? Number(siteId) : undefined,
      date: {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      },
    },
    orderBy: { date: "desc" },
    include: { employee: true, site: true },
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Attendance");
  sheet.columns = [
    { header: "Employee code", key: "employeeCode", width: 16 },
    { header: "Employee", key: "employee", width: 24 },
    { header: "Site", key: "site", width: 20 },
    { header: "Date", key: "date", width: 14 },
    { header: "Check-in time", key: "checkIn", width: 14 },
    { header: "Check-in status", key: "checkInStatus", width: 16 },
    { header: "Late", key: "late", width: 10 },
    { header: "Check-out time", key: "checkOut", width: 14 },
    { header: "Check-out status", key: "checkOutStatus", width: 16 },
    { header: "Edited by HR", key: "edited", width: 14 },
    { header: "Note", key: "note", width: 30 },
  ];

  for (const record of records) {
    sheet.addRow({
      employeeCode: record.employee.employeeCode,
      employee: record.employee.name,
      site: record.site.name,
      date: formatDateISO(record.date),
      checkIn: formatTimeHHMM(record.checkInAt),
      checkInStatus: record.checkInStatus ?? "",
      late: record.checkInLate ? "สาย" : "",
      checkOut: formatTimeHHMM(record.checkOutAt),
      checkOutStatus: record.checkOutStatus ?? "",
      edited: record.editedByHr ? "Yes" : "",
      note: record.note ?? "",
    });
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=attendance-report.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

function monthRange(year, month) {
  // month is 1-12; returns [gte, lte] covering the whole month in UTC date-only terms.
  const gte = new Date(Date.UTC(year, month - 1, 1));
  const lte = new Date(Date.UTC(year, month, 0));
  return { gte, lte };
}

function yearRange(year) {
  return { gte: new Date(Date.UTC(year, 0, 1)), lte: new Date(Date.UTC(year, 11, 31)) };
}

async function computeLateStats({ gte, lte, departmentId }) {
  const records = await prisma.dailyAttendance.findMany({
    where: {
      date: { gte, lte },
      checkInAt: { not: null },
      ...(departmentId ? { employee: { departmentId } } : {}),
    },
    select: {
      date: true,
      checkInLate: true,
      employee: {
        select: { id: true, employeeCode: true, name: true, departmentId: true, department: { select: { name: true } } },
      },
    },
  });

  const byDept = new Map();
  const byEmployee = new Map();

  for (const r of records) {
    const deptId = r.employee.departmentId ?? 0;
    const deptName = r.employee.department?.name ?? "ไม่ระบุแผนก";

    if (!byDept.has(deptId)) {
      byDept.set(deptId, { departmentId: deptId, departmentName: deptName, totalCheckIns: 0, lateCount: 0, monthly: {} });
    }
    const dept = byDept.get(deptId);
    dept.totalCheckIns += 1;
    if (r.checkInLate) dept.lateCount += 1;

    const monthKey = r.date.getUTCMonth() + 1;
    dept.monthly[monthKey] = dept.monthly[monthKey] || { month: monthKey, totalCheckIns: 0, lateCount: 0 };
    dept.monthly[monthKey].totalCheckIns += 1;
    if (r.checkInLate) dept.monthly[monthKey].lateCount += 1;

    const empId = r.employee.id;
    if (!byEmployee.has(empId)) {
      byEmployee.set(empId, {
        employeeId: empId,
        employeeCode: r.employee.employeeCode,
        employeeName: r.employee.name,
        departmentName: deptName,
        totalCheckIns: 0,
        lateCount: 0,
      });
    }
    const emp = byEmployee.get(empId);
    emp.totalCheckIns += 1;
    if (r.checkInLate) emp.lateCount += 1;
  }

  const departments = [...byDept.values()]
    .map((d) => ({
      ...d,
      latePercent: d.totalCheckIns ? Math.round((d.lateCount / d.totalCheckIns) * 1000) / 10 : 0,
      monthly: Object.values(d.monthly).sort((a, b) => a.month - b.month),
    }))
    .sort((a, b) => b.lateCount - a.lateCount);

  const employees = [...byEmployee.values()]
    .map((e) => ({
      ...e,
      latePercent: e.totalCheckIns ? Math.round((e.lateCount / e.totalCheckIns) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.lateCount - a.lateCount);

  return { departments, employees };
}

router.get("/late-stats", async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const employeeLimit = Math.min(Number(req.query.employeeLimit) || 10, 100);

  const range = month ? monthRange(year, month) : yearRange(year);
  const { departments, employees } = await computeLateStats({ ...range, departmentId });

  res.json({
    year,
    month,
    departments,
    employees: employees.slice(0, employeeLimit),
    employeeTotal: employees.length,
  });
});

router.get("/late-stats/export", async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = req.query.month ? Number(req.query.month) : null;
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : null;

  const range = month ? monthRange(year, month) : yearRange(year);
  const { departments, employees } = await computeLateStats({ ...range, departmentId });

  const workbook = new ExcelJS.Workbook();

  const deptSheet = workbook.addWorksheet("By Department");
  deptSheet.columns = [
    { header: "Department", key: "dept", width: 24 },
    { header: "Total check-ins", key: "total", width: 16 },
    { header: "Late count", key: "late", width: 14 },
    { header: "Late %", key: "pct", width: 10 },
  ];
  for (const d of departments) {
    deptSheet.addRow({ dept: d.departmentName, total: d.totalCheckIns, late: d.lateCount, pct: d.latePercent });
  }

  const empSheet = workbook.addWorksheet("By Employee");
  empSheet.columns = [
    { header: "Employee code", key: "code", width: 16 },
    { header: "Employee", key: "name", width: 24 },
    { header: "Department", key: "dept", width: 20 },
    { header: "Total check-ins", key: "total", width: 16 },
    { header: "Late count", key: "late", width: 14 },
    { header: "Late %", key: "pct", width: 10 },
  ];
  for (const e of employees) {
    empSheet.addRow({
      code: e.employeeCode,
      name: e.employeeName,
      dept: e.departmentName,
      total: e.totalCheckIns,
      late: e.lateCount,
      pct: e.latePercent,
    });
  }

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", `attachment; filename=late-stats-${year}${month ? "-" + month : ""}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
});

export default router;

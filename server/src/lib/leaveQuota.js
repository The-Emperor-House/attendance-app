import { prisma } from "./prisma.js";
import { DEFAULT_WORK_DAYS, yearRange } from "./leaveDays.js";

export { countLeaveDays, yearRange } from "./leaveDays.js";

// Work days and public holidays needed to turn a date range into chargeable leave days.
export async function loadLeaveCalendar(employeeId, from, to) {
  const [shift, holidays] = await Promise.all([
    prisma.shift.findUnique({ where: { employeeId }, select: { workDays: true } }),
    prisma.holiday.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true } }),
  ]);
  const workDays = Array.isArray(shift?.workDays) && shift.workDays.length ? shift.workDays : DEFAULT_WORK_DAYS;
  return {
    workDays: new Set(workDays),
    holidays: new Set(holidays.map((h) => h.date.getTime())),
  };
}

// Quota for one employee/type/year: an explicit LeaveQuota override wins,
// otherwise fall back to the company-wide LeaveQuotaDefault (0 if unset).
export async function getQuotaDays(employeeId, type, year) {
  const override = await prisma.leaveQuota.findUnique({
    where: { employeeId_type_year: { employeeId, type, year } },
  });
  if (override) return override.days;

  const def = await prisma.leaveQuotaDefault.findUnique({ where: { type } });
  return def?.annualDays ?? 0;
}

// Days already requested (PENDING or APPROVED — REJECTED frees the quota back up)
// for this employee/type, counting only the part of each request inside `year`.
export async function getUsedDays(employeeId, type, year, calendar) {
  const { from, to } = yearRange(year);
  const cal = calendar ?? (await loadLeaveCalendar(employeeId, from, to));

  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      type,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: to },
      endDate: { gte: from },
    },
  });

  return requests.reduce((sum, r) => sum + countLeaveDays(r.startDate, r.endDate, cal, from, to), 0);
}

export async function getQuotaSummary(employeeId, year) {
  const { from, to } = yearRange(year);
  const [categories, calendar] = await Promise.all([
    prisma.leaveCategory.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } }),
    loadLeaveCalendar(employeeId, from, to),
  ]);

  const summary = [];
  for (const { code, name } of categories) {
    const [quota, used] = await Promise.all([
      getQuotaDays(employeeId, code, year),
      getUsedDays(employeeId, code, year, calendar),
    ]);
    summary.push({ type: code, name, quota, used, remaining: Math.max(quota - used, 0) });
  }
  return summary;
}

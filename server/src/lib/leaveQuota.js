import { prisma } from "./prisma.js";

function daysInclusive(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / 86400000) + 1;
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
// for this employee/type within the given calendar year.
export async function getUsedDays(employeeId, type, year) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));

  const requests = await prisma.leaveRequest.findMany({
    where: {
      employeeId,
      type,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: yearEnd },
      endDate: { gte: yearStart },
    },
  });

  return requests.reduce((sum, r) => sum + daysInclusive(r.startDate, r.endDate), 0);
}

export async function getQuotaSummary(employeeId, year) {
  const categories = await prisma.leaveCategory.findMany({
    where: { active: true },
    orderBy: { createdAt: "asc" },
  });

  const summary = [];
  for (const { code, name } of categories) {
    const [quota, used] = await Promise.all([
      getQuotaDays(employeeId, code, year),
      getUsedDays(employeeId, code, year),
    ]);
    summary.push({ type: code, name, quota, used, remaining: Math.max(quota - used, 0) });
  }
  return summary;
}

export { daysInclusive };

import { prisma } from "./prisma.js";

// Employees may only check in at sites assigned to them. Someone with no
// assignments yet may use any site, so new hires aren't locked out.
export async function canUseSite(employeeId, siteId) {
  const assigned = await prisma.employeeSite.findMany({ where: { employeeId }, select: { siteId: true } });
  return assigned.length === 0 || assigned.some((a) => a.siteId === siteId);
}

// How far back an un-checked-out visit still counts as open. Long enough for a shift
// that crosses midnight to check out next morning; short enough that a visit someone
// forgot to close days ago doesn't block them forever.
const OPEN_VISIT_WINDOW_MS = 18 * 60 * 60 * 1000;

// The visit waiting for check-out, if any. A visit whose missing check-out is already
// covered by a pending correction request doesn't count, so an employee who forgot to
// check out at one site can still check in at the next while the request is reviewed.
export function findOpenVisit(employeeId) {
  return prisma.dailyAttendance.findFirst({
    where: {
      employeeId,
      checkOutAt: null,
      checkInAt: { gte: new Date(Date.now() - OPEN_VISIT_WINDOW_MS) },
      corrections: { none: { status: "PENDING", type: "FIX_VISIT", checkOutAt: { not: null } } },
    },
    orderBy: { checkInAt: "desc" },
    include: { site: true },
  });
}

// Numbers each visit 1, 2, ... within its employee and day, by check-in time.
// `seq` is only a unique key: a visit added later by a correction request gets the
// next seq even if it happened earlier in the day.
export function visitOrdinals(records) {
  const byDay = new Map();
  for (const r of records) {
    const key = `${r.employeeId}|${r.date.toISOString()}`;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(r);
  }
  const ordinals = new Map();
  for (const visits of byDay.values()) {
    visits
      .sort((a, b) => (a.checkInAt?.getTime() ?? 0) - (b.checkInAt?.getTime() ?? 0))
      .forEach((v, i) => ordinals.set(v.id, i + 1));
  }
  return ordinals;
}

// Pure date math for leave requests (no DB access), shared by leaveQuota.js and tests.

const DAY_MS = 86400000;
// Used when an employee has no shift: Monday..Friday.
export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];

export function yearRange(year) {
  return { from: new Date(Date.UTC(year, 0, 1)), to: new Date(Date.UTC(year, 11, 31)) };
}

// Leave days charged for the UTC-midnight range [start, end], clipped to [from, to]:
// only the employee's work days count, and public holidays are skipped.
export function countLeaveDays(start, end, calendar, from = start, to = end) {
  const first = Math.max(start.getTime(), from.getTime());
  const last = Math.min(end.getTime(), to.getTime());
  let days = 0;
  for (let t = first; t <= last; t += DAY_MS) {
    const isoWeekday = ((new Date(t).getUTCDay() + 6) % 7) + 1;
    if (calendar.workDays.has(isoWeekday) && !calendar.holidays.has(t)) days += 1;
  }
  return days;
}

const TIME_ZONE = "Asia/Bangkok";

// Minutes since midnight for `date` as observed in Asia/Bangkok, regardless of server TZ.
export function minutesSinceMidnight(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour").value);
  const minute = Number(parts.find((p) => p.type === "minute").value);
  return hour * 60 + minute;
}

// "HH:mm" -> minutes since midnight.
export function parseHHMM(value) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

// date -> "HH:mm" as observed in Asia/Bangkok, for display (e.g. Excel export) instead of a raw timestamp.
export function formatTimeHHMM(date) {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// date -> "YYYY-MM-DD" as observed in Asia/Bangkok.
export function formatDateISO(date) {
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Today's calendar date as observed in Asia/Bangkok, as a UTC-midnight Date
// (the shape stored in @db.Date columns). Using the UTC date instead would roll
// check-ins between 00:00 and 06:59 Bangkok time back to the previous day.
export function bangkokTodayDateOnly(now = new Date()) {
  return new Date(`${formatDateISO(now)}T00:00:00.000Z`);
}

// Current calendar year in Asia/Bangkok (the server itself may run in UTC).
export function bangkokYear(now = new Date()) {
  return Number(formatDateISO(now).slice(0, 4));
}

// Combine a UTC-midnight calendar date with an "HH:mm" Bangkok wall-clock time
// (plus an optional minute offset) into the corresponding UTC Date instant.
export function bangkokWallClockToDate(dateOnly, hhmm, offsetMinutes = 0) {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(dateOnly.getUTCFullYear(), dateOnly.getUTCMonth(), dateOnly.getUTCDate(), h - 7, m + offsetMinutes)
  );
}

// Bangkok "HH:mm" check-in/out times on a UTC-midnight `dateOnly` -> instants. A missing
// time falls back to the given instant. A check-out at or before the check-in time is
// taken to be the next day (a shift crossing midnight).
export function wallClockInterval(dateOnly, checkInTime, checkOutTime, fallbackIn = null, fallbackOut = null) {
  const checkInAt = checkInTime ? bangkokWallClockToDate(dateOnly, checkInTime) : fallbackIn;
  let checkOutAt = checkOutTime ? bangkokWallClockToDate(dateOnly, checkOutTime) : fallbackOut;
  if (checkOutTime && checkInAt && checkOutAt <= checkInAt) {
    checkOutAt = new Date(checkOutAt.getTime() + 86400000);
  }
  return { checkInAt, checkOutAt };
}

export function isLateCheckIn(checkInAt, shiftStart, graceMinutes = 0) {
  if (!shiftStart) return false;
  const threshold = parseHHMM(shiftStart) + graceMinutes;
  return minutesSinceMidnight(checkInAt) > threshold;
}

// ISO weekday in Asia/Bangkok: Monday=1 .. Sunday=7.
export function isoWeekday(date) {
  const weekdayName = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
  }).format(date);
  const map = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[weekdayName];
}

// An employee's personal shift is the only source of late calculation.
// No shift assigned means the employee is never flagged as late.
export function resolveShift(employee) {
  if (!employee?.shift) return null;
  return {
    startTime: employee.shift.startTime,
    graceMinutes: employee.shift.graceMinutes,
    workDays: employee.shift.workDays,
  };
}

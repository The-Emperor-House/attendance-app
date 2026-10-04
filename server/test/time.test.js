import { test } from "node:test";
import assert from "node:assert/strict";
import { bangkokTodayDateOnly, bangkokYear, isLateCheckIn, isoWeekday, wallClockInterval } from "../src/lib/time.js";

test("bangkokTodayDateOnly uses the Bangkok calendar day, not UTC", () => {
  // 06:30 Bangkok on Oct 4 is still Oct 3 in UTC.
  assert.equal(bangkokTodayDateOnly(new Date("2026-10-03T23:30:00Z")).toISOString(), "2026-10-04T00:00:00.000Z");
  assert.equal(bangkokTodayDateOnly(new Date("2026-10-04T16:59:00Z")).toISOString(), "2026-10-04T00:00:00.000Z");
  assert.equal(bangkokTodayDateOnly(new Date("2026-10-04T17:00:00Z")).toISOString(), "2026-10-05T00:00:00.000Z");
});

test("bangkokYear rolls over at Bangkok midnight", () => {
  assert.equal(bangkokYear(new Date("2026-12-31T16:59:00Z")), 2026);
  assert.equal(bangkokYear(new Date("2026-12-31T17:00:00Z")), 2027);
});

test("isLateCheckIn applies grace minutes in Bangkok time", () => {
  // 08:10 Bangkok
  const at = new Date("2026-10-05T01:10:00Z");
  assert.equal(isLateCheckIn(at, "08:00", 10), false);
  assert.equal(isLateCheckIn(at, "08:00", 9), true);
});

test("isoWeekday is Monday=1 .. Sunday=7 in Bangkok", () => {
  // Sunday 23:30 UTC = Monday 06:30 Bangkok
  assert.equal(isoWeekday(new Date("2026-10-04T23:30:00Z")), 1);
});

test("wallClockInterval converts Bangkok times and rolls an overnight check-out to the next day", () => {
  const day = new Date("2026-10-04T00:00:00Z");
  const sameDay = wallClockInterval(day, "08:30", "17:00");
  assert.equal(sameDay.checkInAt.toISOString(), "2026-10-04T01:30:00.000Z");
  assert.equal(sameDay.checkOutAt.toISOString(), "2026-10-04T10:00:00.000Z");

  const overnight = wallClockInterval(day, "22:00", "06:00");
  assert.equal(overnight.checkInAt.toISOString(), "2026-10-04T15:00:00.000Z");
  assert.equal(overnight.checkOutAt.toISOString(), "2026-10-04T23:00:00.000Z");
});

test("wallClockInterval keeps the recorded time for a field not being changed", () => {
  const day = new Date("2026-10-04T00:00:00Z");
  const recordedIn = new Date("2026-10-04T01:00:00Z"); // 08:00 Bangkok
  const fixed = wallClockInterval(day, undefined, "12:00", recordedIn, null);
  assert.equal(fixed.checkInAt, recordedIn);
  assert.equal(fixed.checkOutAt.toISOString(), "2026-10-04T05:00:00.000Z");
});

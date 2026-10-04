import { test } from "node:test";
import assert from "node:assert/strict";
import { countLeaveDays, yearRange } from "../src/lib/leaveDays.js";

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);
const calendar = (workDays = [1, 2, 3, 4, 5], holidays = []) => ({
  workDays: new Set(workDays),
  holidays: new Set(holidays.map((h) => d(h).getTime())),
});

test("weekends are not charged", () => {
  // Fri 2026-10-02 .. Mon 2026-10-05
  assert.equal(countLeaveDays(d("2026-10-02"), d("2026-10-05"), calendar()), 2);
});

test("public holidays are not charged", () => {
  assert.equal(countLeaveDays(d("2026-10-12"), d("2026-10-16"), calendar(undefined, ["2026-10-13"])), 4);
});

test("employee shift work days are respected", () => {
  // Mon..Sat shift, Mon 2026-10-05 .. Sun 2026-10-11
  assert.equal(countLeaveDays(d("2026-10-05"), d("2026-10-11"), calendar([1, 2, 3, 4, 5, 6])), 6);
});

test("a request spanning New Year is split by year", () => {
  // Wed 2026-12-30 .. Fri 2027-01-01
  const start = d("2026-12-30");
  const end = d("2027-01-01");
  const y26 = yearRange(2026);
  const y27 = yearRange(2027);
  assert.equal(countLeaveDays(start, end, calendar(), y26.from, y26.to), 2);
  assert.equal(countLeaveDays(start, end, calendar(), y27.from, y27.to), 1);
});

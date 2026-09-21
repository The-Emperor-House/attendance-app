import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { isoWeekday, bangkokWallClockToDate } from "../src/lib/time.js";

const prisma = new PrismaClient();

const DEPARTMENTS = ["ฝ่ายขาย", "ฝ่ายบุคคล", "ฝ่ายผลิต", "ฝ่ายบัญชี"];
const EMPLOYEE_COUNT = 40;
const HISTORY_DAYS = 90; // ~3 months

// A handful of shift templates so employees don't all work identical hours/days.
const SHIFT_TEMPLATES = [
  { startTime: "08:00", endTime: "17:00", graceMinutes: 5, workDays: [1, 2, 3, 4, 5, 6] }, // 6-day
  { startTime: "09:00", endTime: "18:00", graceMinutes: 10, workDays: [1, 2, 3, 4, 5] }, // 5-day
  { startTime: "09:30", endTime: "18:30", graceMinutes: 0, workDays: [1, 2, 3, 4, 5] }, // 5-day
  { startTime: "07:30", endTime: "16:30", graceMinutes: 15, workDays: [1, 2, 3, 4, 5, 6] }, // 6-day, early
];

// Departments get different "punctuality" baselines so the late-stats report
// has a meaningful ranking to show, instead of uniform noise.
const DEPT_LATE_RATE = {
  ฝ่ายขาย: 0.32,
  ฝ่ายบุคคล: 0.12,
  ฝ่ายผลิต: 0.22,
  ฝ่ายบัญชี: 0.08,
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function todayDateOnly() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(date, days) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const office = await prisma.site.findFirst({ orderBy: { id: "asc" } });
  if (!office) {
    throw new Error("No site found — run `npm run seed` first to create the default site.");
  }

  const departments = {};
  for (const name of DEPARTMENTS) {
    departments[name] = await prisma.department.upsert({ where: { name }, update: {}, create: { name } });
  }

  console.log(`Creating/updating ${EMPLOYEE_COUNT} demo employees...`);

  const employees = [];
  for (let i = 1; i <= EMPLOYEE_COUNT; i++) {
    const employeeCode = `EMP${String(100 + i)}`;
    const deptName = DEPARTMENTS[i % DEPARTMENTS.length];
    const shiftTemplate = SHIFT_TEMPLATES[i % SHIFT_TEMPLATES.length];

    const employee = await prisma.employee.upsert({
      where: { employeeCode },
      update: { departmentId: departments[deptName].id },
      create: {
        employeeCode,
        name: `พนักงานทดสอบ ${i}`,
        passwordHash,
        role: "EMPLOYEE",
        departmentId: departments[deptName].id,
        sites: { create: { siteId: office.id, isDefault: true } },
      },
    });

    await prisma.shift.upsert({
      where: { employeeId: employee.id },
      update: shiftTemplate,
      create: { employeeId: employee.id, ...shiftTemplate },
    });

    employees.push({ ...employee, department: deptName, shift: shiftTemplate });
  }

  console.log(`Generating ${HISTORY_DAYS} days of attendance history...`);

  const today = todayDateOnly();
  const startDate = addDays(today, -HISTORY_DAYS);

  const rows = [];
  for (const employee of employees) {
    const lateRate = DEPT_LATE_RATE[employee.department] ?? 0.2;

    for (let d = 0; d <= HISTORY_DAYS; d++) {
      const date = addDays(startDate, d);
      if (date.getTime() === today.getTime()) continue; // leave "today" for live testing
      if (!employee.shift.workDays.includes(isoWeekday(date))) continue;
      if (Math.random() < 0.04) continue; // simulate occasional day off / leave

      const isLate = Math.random() < lateRate;
      const checkInOffset = isLate
        ? randomInt(employee.shift.graceMinutes + 1, employee.shift.graceMinutes + 40)
        : randomInt(-15, employee.shift.graceMinutes);
      const checkOutOffset = randomInt(0, 45);

      const checkInAt = bangkokWallClockToDate(date, employee.shift.startTime, checkInOffset);
      const checkOutAt = bangkokWallClockToDate(date, employee.shift.endTime, checkOutOffset);
      const outOfRange = Math.random() < 0.03;

      rows.push({
        employeeId: employee.id,
        siteId: office.id,
        date,
        checkInAt,
        checkInLat: office.lat,
        checkInLng: office.lng,
        checkInDistanceM: outOfRange ? office.radiusM + randomInt(50, 300) : randomInt(0, 20),
        checkInPhotoUrl: "/uploads/seed-placeholder.jpg",
        checkInStatus: outOfRange ? "OUT_OF_RANGE" : "NORMAL",
        checkInLate: isLate,
        checkOutAt,
        checkOutLat: office.lat,
        checkOutLng: office.lng,
        checkOutDistanceM: randomInt(0, 20),
        checkOutPhotoUrl: "/uploads/seed-placeholder.jpg",
        checkOutStatus: "NORMAL",
      });
    }
  }

  console.log(`Inserting ${rows.length} attendance rows...`);

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await prisma.dailyAttendance.createMany({ data: batch, skipDuplicates: true });
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length}\r`);
  }

  console.log(`\nDone. ${employees.length} employees, ${rows.length} attendance records across ${DEPARTMENTS.length} departments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

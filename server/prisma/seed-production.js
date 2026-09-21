// Production bootstrap: reference data + one admin. No demo users, no default password.
//
// Reads server/.env.production (DATABASE_URL, ADMIN_CODE, ADMIN_NAME, ADMIN_PASSWORD), then:
//   npm run seed:prod
//
// Safe to re-run: existing rows are left untouched (an existing admin's password is NOT reset).
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// override: Prisma auto-loads server/.env (staging) on import, which must not win over production.
dotenv.config({ path: ".env.production", override: true });
console.log("Target DB host:", new URL(process.env.DATABASE_URL).host);

const prisma = new PrismaClient();

const { ADMIN_CODE, ADMIN_NAME, ADMIN_PASSWORD, ADMIN_EMAIL } = process.env;

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!process.env.DATABASE_URL) fail("DATABASE_URL is required");
if (!ADMIN_CODE || !ADMIN_NAME || !ADMIN_PASSWORD) {
  fail("ADMIN_CODE, ADMIN_NAME and ADMIN_PASSWORD are required");
}
if (ADMIN_PASSWORD.length < 10 || ADMIN_PASSWORD.toLowerCase() === "password123") {
  fail("ADMIN_PASSWORD must be at least 10 characters and not a default password");
}

async function main() {
  const leaveCategories = [
    { code: "SICK", name: "ลาป่วย" },
    { code: "VACATION", name: "ลาพักร้อน" },
    { code: "PERSONAL", name: "ลากิจ" },
  ];
  for (const c of leaveCategories) {
    await prisma.leaveCategory.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  const leaveDefaults = [
    { type: "SICK", annualDays: 30 },
    { type: "VACATION", annualDays: 6 },
    { type: "PERSONAL", annualDays: 3 },
  ];
  for (const d of leaveDefaults) {
    await prisma.leaveQuotaDefault.upsert({ where: { type: d.type }, update: {}, create: d });
  }

  const existing = await prisma.employee.findUnique({ where: { employeeCode: ADMIN_CODE } });
  if (existing) {
    console.log(`Admin ${ADMIN_CODE} already exists — left unchanged.`);
    return;
  }

  const admin = await prisma.employee.create({
    data: {
      employeeCode: ADMIN_CODE,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL || null,
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
      role: "ADMIN",
    },
  });
  console.log(`Created admin ${admin.employeeCode}. Add sites, departments and employees from the admin page.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

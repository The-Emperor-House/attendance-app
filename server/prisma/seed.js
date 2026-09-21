import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);
  // Admin code/name/password come from .env (ADMIN_CODE, ADMIN_NAME, ADMIN_PASSWORD); fall back to the demo password for local dev.
  const adminCode = process.env.ADMIN_CODE || "ADMIN001";
  const adminName = process.env.ADMIN_NAME || "Admin User";
  const adminPassword = process.env.ADMIN_PASSWORD || "password123";
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const office = await prisma.site.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "สำนักงานใหญ่",
      address: "กรุงเทพฯ",
      lat: 13.7563,
      lng: 100.5018,
      radiusM: 150,
    },
  });

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

  const hrDept = await prisma.department.upsert({
    where: { name: "ฝ่ายบุคคล" },
    update: {},
    create: { name: "ฝ่ายบุคคล" },
  });
  const salesDept = await prisma.department.upsert({
    where: { name: "ฝ่ายขาย" },
    update: {},
    create: { name: "ฝ่ายขาย" },
  });

  const admin = await prisma.employee.upsert({
    where: { employeeCode: adminCode },
    update: { name: adminName, departmentId: hrDept.id, passwordHash: adminPasswordHash },
    create: {
      employeeCode: adminCode,
      name: adminName,
      email: "admin@example.com",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      departmentId: hrDept.id,
      sites: { create: { siteId: office.id, isDefault: true } },
    },
  });
  await prisma.shift.upsert({
    where: { employeeId: admin.id },
    update: {},
    create: { employeeId: admin.id, startTime: "09:00", endTime: "18:00", graceMinutes: 10, workDays: [1, 2, 3, 4, 5] },
  });

  const employee = await prisma.employee.upsert({
    where: { employeeCode: "EMP001" },
    update: { departmentId: salesDept.id },
    create: {
      employeeCode: "EMP001",
      name: "Somchai Test",
      email: "employee@example.com",
      passwordHash,
      role: "EMPLOYEE",
      departmentId: salesDept.id,
      sites: { create: { siteId: office.id, isDefault: true } },
    },
  });
  // 6-day week, starts earlier than office default.
  await prisma.shift.upsert({
    where: { employeeId: employee.id },
    update: {},
    create: { employeeId: employee.id, startTime: "08:00", endTime: "17:00", graceMinutes: 5, workDays: [1, 2, 3, 4, 5, 6] },
  });

  console.log({ office, departments: [hrDept.name, salesDept.name], admin: admin.employeeCode, employee: employee.employeeCode });
  console.log(process.env.ADMIN_PASSWORD ? "Seed complete. Admin password taken from ADMIN_PASSWORD; other demo users use password123." : "Seed complete. Login with password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

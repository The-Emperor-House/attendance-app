import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import siteRoutes from "./routes/sites.js";
import employeeRoutes from "./routes/employees.js";
import departmentRoutes from "./routes/departments.js";
import attendanceRoutes from "./routes/attendance.js";
import reportRoutes from "./routes/reports.js";
import leaveRoutes from "./routes/leaves.js";
import holidayRoutes from "./routes/holidays.js";
import leaveQuotaRoutes from "./routes/leaveQuota.js";
import leaveCategoryRoutes from "./routes/leaveCategories.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
  app.use(express.json());

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/sites", siteRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/departments", departmentRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/leaves", leaveRoutes);
  app.use("/api/holidays", holidayRoutes);
  app.use("/api/leave-quota", leaveQuotaRoutes);
  app.use("/api/leave-categories", leaveCategoryRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  });

  return app;
}

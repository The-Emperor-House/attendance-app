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
import correctionRoutes from "./routes/corrections.js";

export function createApp() {
  const app = express();
  // Behind Vercel/Railway's proxy: trust its X-Forwarded-For so rate limiting sees the client IP.
  app.set("trust proxy", 1);

  // Allow-all CORS only for local dev; in production an unset CORS_ORIGIN blocks
  // cross-origin calls (and logs why) instead of silently opening the API to any site.
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin && process.env.NODE_ENV === "production") {
    console.error("CORS_ORIGIN is not set; cross-origin requests will be rejected.");
  }
  app.use(cors({ origin: corsOrigin || (process.env.NODE_ENV === "production" ? false : "*") }));
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
  app.use("/api/corrections", correctionRoutes);

  app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || "Internal server error" });
  });

  return app;
}

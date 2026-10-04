import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

// Verifies the JWT, then re-checks the account so a deactivated/resigned employee or a
// role change takes effect immediately instead of when the 12h token expires.
async function verify(token) {
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
  const employee = await prisma.employee.findUnique({
    where: { id: payload.sub },
    select: { active: true, role: true },
  });
  if (!employee?.active) return null;
  return { ...payload, role: employee.role };
}

// Session auth: Authorization header only. Export-scoped tokens are rejected here so a
// short-lived token leaked through a download URL can't be replayed against the API.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing token" });
  }

  const user = await verify(token);
  if (!user || user.scope) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = user;
  next();
}

// For Excel download links (an <a href> can't set headers): accepts only an
// export-scoped token from ?token=, or a regular session token in the header.
export async function requireExportAuth(req, res, next) {
  if (req.headers.authorization) return requireAuth(req, res, next);

  const user = req.query.token ? await verify(String(req.query.token)) : null;
  if (!user || user.scope !== "export") {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
  req.user = user;
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

// Prisma `where` fragment on Employee limiting a SUPERVISOR to their direct reports.
// Admins (and anyone else allowed through requireRole) get no restriction.
export function employeeScope(user) {
  return user.role === "SUPERVISOR" ? { supervisorId: user.sub } : {};
}

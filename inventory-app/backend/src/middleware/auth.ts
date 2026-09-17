import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthPayload {
  userId: string;
  companyId: string;
  role: "ADMIN" | "EMPLOYEE" | "REVIEWER";
  warehouseScope: string[];
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Restricts a route to one or more roles.
export function requireRole(...roles: AuthPayload["role"][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

// Ensures the authenticated user is allowed to touch the given warehouseId
// (empty warehouseScope on the user means "all warehouses").
export function assertWarehouseScope(auth: AuthPayload, warehouseId: string) {
  if (auth.role === "ADMIN") return true;
  if (auth.warehouseScope.length === 0) return true;
  return auth.warehouseScope.includes(warehouseId);
}

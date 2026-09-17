import express from "express";
import "express-async-errors";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "./inventory-app/backend/src/prisma";

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

// Backend routers
import authRoutes from "./inventory-app/backend/src/routes/auth.routes";
import usersRoutes from "./inventory-app/backend/src/routes/users.routes";
import warehousesRoutes from "./inventory-app/backend/src/routes/warehouses.routes";
import itemsRoutes from "./inventory-app/backend/src/routes/items.routes";
import auditTasksRoutes from "./inventory-app/backend/src/routes/audit-tasks.routes";
import auditRecordsRoutes from "./inventory-app/backend/src/routes/audit-records.routes";
import reportsRoutes from "./inventory-app/backend/src/routes/reports.routes";
import importRoutes from "./inventory-app/backend/src/routes/import.routes";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Health check endpoints - must be first
  app.get("/health", (_req, res) => res.json({ ok: true, databaseConfigured: !!process.env.DATABASE_URL }));
  app.get("/api/health", (_req, res) => res.json({ ok: true, databaseConfigured: !!process.env.DATABASE_URL }));

  // Guard API requests for DATABASE_URL
  app.use("/api", (req, res, next) => {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        error: "DATABASE_URL is not set. Please configure DATABASE_URL in your Settings -> Secrets panel.",
      });
    }
    next();
  });

  // Safe router helper to support ESM transpiled module structure
  const getRouter = (m: any) => (m && typeof m === "object" && "default" in m ? m.default : m);

  // Mount API endpoints
  app.use("/api/auth", getRouter(authRoutes));
  app.use("/api/users", getRouter(usersRoutes));
  app.use("/api/warehouses", getRouter(warehousesRoutes));
  app.use("/api/items", getRouter(itemsRoutes));
  app.use("/api/audit-tasks", getRouter(auditTasksRoutes));
  app.use("/api/audit-records", getRouter(auditRecordsRoutes));
  app.use("/api", getRouter(reportsRoutes)); // exposes /pending-items, /tasks/:id/generate, /reports/:id/csv
  app.use("/api/import", getRouter(importRoutes));

  // Catch-all for undefined /api routes to prevent falling through to HTML index.html
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `الرابط المطلوب غير موجود: ${req.method} ${req.originalUrl}` });
  });

  // Global API error handler
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    let statusCode = 500;
    let message = err?.message || "حدث خطأ في خادم البيانات";

    if (err?.code && typeof err.code === "string" && err.code.startsWith("P")) {
      if (err.code === "P2002") {
        statusCode = 400;
        message = "هذا العنصر مكرر أو موجود مسبقاً في النظام";
      } else if (err.code === "P2025") {
        statusCode = 404;
        message = "العنصر المطلوب غير موجود أو تم حذفه مسبقاً";
      } else if (err.code === "P2003") {
        statusCode = 400;
        message = "لا يمكن إتمام العملية لرجوع بيانات مرتبطة بسجلات أخرى";
      } else if (err.code === "P2024") {
        statusCode = 503;
        message = "خادم قاعدة البيانات مشغول حالياً بسبب ضغط الطلبات، يرجى إعادة المحاولة";
      } else {
        statusCode = 400;
        message = `خطأ في قاعدة البيانات (${err.code})`;
      }
      console.error(`Prisma Error [${err.code}]:`, message);
    } else {
      console.error("Express API Error:", message);
    }

    res.status(statusCode).json({ error: message });
  });

  // Serve static files in production / Vite in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Automatically seed default ADMIN and Company if database is empty
  async function ensureDefaultAdmin() {
    if (!process.env.DATABASE_URL) return;
    try {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" }
      });
      if (adminCount === 0) {
        console.log("No ADMIN user found in database. Seeding default ADMIN user...");
        const passwordHash = await bcrypt.hash("admin123", 12);
        const company = await prisma.company.create({
          data: {
            name: "شركة التجارة العامة والخدمات",
            users: {
              create: {
                name: "المدير العام",
                username: "admin",
                passwordHash,
                role: "ADMIN"
              }
            }
          }
        });
        console.log("Default ADMIN seeded successfully! Username: admin, Password: admin123");
      }
    } catch (error) {
      console.error("Failed to seed default admin user on startup:", error);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Unified full-stack server running on http://localhost:${PORT}`);
    // Run seeding asynchronously so server startup is never blocked
    ensureDefaultAdmin().catch((err) => console.error("Admin seeding error:", err));
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

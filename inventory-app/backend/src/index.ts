import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import usersRoutes from "./routes/users.routes";
import warehousesRoutes from "./routes/warehouses.routes";
import itemsRoutes from "./routes/items.routes";
import auditTasksRoutes from "./routes/audit-tasks.routes";
import auditRecordsRoutes from "./routes/audit-records.routes";
import reportsRoutes from "./routes/reports.routes";
import importRoutes from "./routes/import.routes";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // generous limit for base64 photo payloads

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/warehouses", warehousesRoutes);
app.use("/items", itemsRoutes);
app.use("/audit-tasks", auditTasksRoutes);
app.use("/audit-records", auditRecordsRoutes);
app.use("/", reportsRoutes); // exposes /pending-items, /tasks/:id/generate, /reports/:id/csv
app.use("/import", importRoutes); // exposes /import/from-database

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Inventory audit API listening on :${port}`));

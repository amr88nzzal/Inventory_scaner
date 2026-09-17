import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// Admin provides a connection string, a SELECT-only query, and a column
// mapping (which column in the query result corresponds to barcode/name/etc).
// This lets a company point directly at its existing accounting/ERP database
// instead of exporting to CSV first — as requested.
const importFromDbSchema = z.object({
  dbType: z.enum(["postgres", "mysql"]),
  connectionString: z.string().min(5),
  query: z.string().min(5),
  warehouseId: z.string().optional(),
  columnMapping: z.object({
    barcode: z.string(),
    name: z.string(),
    price: z.string().optional(),
    supplier: z.string().optional(),
    category: z.string().optional(),
    systemQty: z.string().optional(),
    baseUnitName: z.string().optional(), // defaults to "قطعة" if not mapped
  }),
});

function assertReadOnlyQuery(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized.startsWith("select")) {
    throw new Error("Only SELECT queries are allowed for external DB import");
  }
  const forbidden = ["insert", "update", "delete", "drop", "alter", "truncate", ";--", "grant"];
  if (forbidden.some((kw) => normalized.includes(kw))) {
    throw new Error("Query contains disallowed keywords");
  }
}

// Runs the query against the external database and returns raw rows.
// Kept as a separate function so the driver-specific code stays isolated —
// swap in `mysql2` here for the mysql branch when that driver is installed.
async function runExternalQuery(dbType: "postgres" | "mysql", connectionString: string, query: string) {
  if (dbType === "postgres") {
    // Requires the `pg` package (add to package.json dependencies).
    const { Client } = require("pg");
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    try {
      const result = await client.query(query);
      return result.rows as Record<string, any>[];
    } finally {
      await client.end();
    }
  }
  // Requires the `mysql2` package (add to package.json dependencies).
  const mysql = require("mysql2/promise");
  const connection = await mysql.createConnection(connectionString);
  try {
    const [rows] = await connection.execute(query);
    return rows as Record<string, any>[];
  } finally {
    await connection.end();
  }
}

router.post("/from-database", requireRole("ADMIN"), async (req, res) => {
  const parsed = importFromDbSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { dbType, connectionString, query, columnMapping } = parsed.data;

  try {
    assertReadOnlyQuery(query);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }

  let rows: Record<string, any>[];
  try {
    rows = await runExternalQuery(dbType, connectionString, query);
  } catch (e: any) {
    return res.status(502).json({ error: `Failed to query external database: ${e.message}` });
  }

  const results: { barcode: string; status: "created" | "skipped"; reason?: string }[] = [];

  for (const row of rows) {
    const barcode = row[columnMapping.barcode];
    const name = row[columnMapping.name];
    if (!barcode || !name) {
      results.push({ barcode: String(barcode ?? "?"), status: "skipped", reason: "missing barcode/name" });
      continue;
    }

    const exists = await prisma.item.findUnique({
      where: { companyId_barcode: { companyId: req.auth!.companyId, barcode: String(barcode) } },
    });
    if (exists) {
      results.push({ barcode: String(barcode), status: "skipped", reason: "already exists" });
      continue;
    }

    await prisma.item.create({
      data: {
        companyId: req.auth!.companyId,
        barcode: String(barcode),
        name: String(name),
        price: columnMapping.price ? Number(row[columnMapping.price]) : undefined,
        supplier: columnMapping.supplier ? String(row[columnMapping.supplier]) : undefined,
        category: columnMapping.category ? String(row[columnMapping.category]) : undefined,
        systemQty: columnMapping.systemQty ? Number(row[columnMapping.systemQty]) : 0,
        units: {
          create: [{ unitName: columnMapping.baseUnitName ? String(row[columnMapping.baseUnitName]) : "قطعة", qtyPerUnit: 1, isBase: true }],
        },
      },
    });
    results.push({ barcode: String(barcode), status: "created" });
  }

  res.json({ imported: results.filter((r) => r.status === "created").length, results });
});

export default router;

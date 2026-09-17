import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);
const upload = multer({ dest: process.env.UPLOAD_DIR || "./uploads" });

router.get("/count", async (req, res) => {
  const count = await prisma.item.count({
    where: { companyId: req.auth!.companyId },
  });
  res.json({ count });
});

router.get("/", async (req, res) => {
  const items = await prisma.item.findMany({
    where: { companyId: req.auth!.companyId },
    include: { units: true },
  });
  res.json(items);
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json([]);
  const items = await prisma.item.findMany({
    where: {
      companyId: req.auth!.companyId,
      OR: [
        { barcode: { contains: q } },
        { name: { contains: q } },
        { itemCode: { contains: q } },
      ],
    },
    include: { units: true },
    take: 15,
  });
  res.json(items);
});

router.get("/barcode/:barcode", async (req, res) => {
  const item = await prisma.item.findUnique({
    where: { companyId_barcode: { companyId: req.auth!.companyId, barcode: req.params.barcode } },
    include: { units: true },
  });
  if (!item) return res.status(404).json({ error: "not found" });
  res.json(item);
});

const unitSchema = z.object({
  unitName: z.string(),
  qtyPerUnit: z.number().positive(), // mandatory: e.g. box -> 24
  isBase: z.boolean().default(false),
});

const createItemSchema = z.object({
  barcode: z.string().min(1),
  name: z.string().min(1),
  price: z.number().optional(),
  supplier: z.string().optional(),
  category: z.string().optional(),
  warehouseId: z.string().optional(),
  systemQty: z.number().default(0),
  recountTolerancePct: z.number().optional(), // per-item override
  units: z.array(unitSchema).min(1), // must include at least the base unit
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const item = await prisma.item.create({
    data: {
      companyId: req.auth!.companyId,
      barcode: data.barcode,
      name: data.name,
      price: data.price,
      supplier: data.supplier,
      category: data.category,
      systemQty: data.systemQty,
      recountTolerancePct: data.recountTolerancePct,
      units: { create: data.units },
    },
    include: { units: true },
  });

  res.status(201).json(item);
});

// Bulk import items from a CSV file. Supports auto delimiter detection and Windows-1256/CP1256 encoding.
router.post("/import/csv", requireRole("ADMIN"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "file is required" });

  try {
    const content = require("fs").readFileSync(req.file.path);
    
    // Automatic encoding detection (UTF-8 vs Windows-1256 Arabic)
    let text = "";
    const utf8Str = content.toString("utf8");
    const replacementCount = (utf8Str.match(/\uFFFD/g) || []).length;
    
    if (replacementCount > 10 || utf8Str.includes("")) {
      const iconv = require("iconv-lite");
      text = iconv.decode(content, "win1256");
    } else {
      text = utf8Str;
    }

    // Split text into lines
    const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
    if (lines.length === 0) {
      return res.status(400).json({ error: "The uploaded file is empty" });
    }

    // Delimiter detection (semicolon, comma, or tab)
    const firstLine = lines[0];
    let delimiter = ",";
    if (firstLine.includes(";")) delimiter = ";";
    else if (firstLine.includes("\t")) delimiter = "\t";

    const results: { barcode: string; status: "created" | "skipped"; reason?: string }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(delimiter).map(col => col.trim().replace(/^["']|["']$/g, ""));

      if (cols.length < 2) continue;

      // Detect header row: if the first column is non-numeric, it is likely headers
      const firstColIsNumeric = /^\d+$/.test(cols[0]);
      if (i === 0 && !firstColIsNumeric) {
        continue; // Skip the header row
      }

      // Map columns by position dynamically:
      // If we have 7 or more columns:
      // cols[0] = Barcode, cols[1] = Name, cols[2] = Supplier, cols[3] = Category (الفئة), cols[4] = SystemQty, cols[5] = BaseUnitName, cols[6] = ItemCode (رمز المادة)
      // If we have 6 columns:
      // cols[0] = Barcode, cols[1] = Name, cols[2] = Supplier, cols[3] = SystemQty, cols[4] = BaseUnitName, cols[5] = ItemCode (رمز المادة)
      const barcode = cols[0];
      const name = cols[1];
      let supplier = undefined;
      let category = undefined;
      let systemQty = 0;
      let baseUnitName = "قطعة";
      let itemCode = undefined;

      if (cols.length >= 7) {
        supplier = cols[2] || undefined;
        category = cols[3] || undefined;
        systemQty = cols[4] ? parseFloat(cols[4]) || 0 : 0;
        baseUnitName = cols[5] || "قطعة";
        itemCode = cols[6] || undefined;
      } else {
        supplier = cols[2] || undefined;
        systemQty = cols[3] ? parseFloat(cols[3]) || 0 : 0;
        baseUnitName = cols[4] || "قطعة";
        itemCode = cols[5] || undefined;
      }

      if (!barcode || !name) {
        results.push({ barcode: barcode || "?", status: "skipped", reason: "missing barcode or name" });
        continue;
      }

      // Check if item barcode already exists
      const exists = await prisma.item.findUnique({
        where: { companyId_barcode: { companyId: req.auth!.companyId, barcode } },
      });

      if (exists) {
        results.push({ barcode, status: "skipped", reason: "already exists" });
        continue;
      }

      const selectedWarehouseId = req.body?.warehouseId || req.query?.warehouseId || undefined;

      const units = [{ unitName: baseUnitName, qtyPerUnit: 1, isBase: true }];

      await prisma.item.create({
        data: {
          companyId: req.auth!.companyId,
          barcode,
          itemCode,
          name,
          supplier,
          category,
          systemQty,
          units: { create: units },
        },
      });

      results.push({ barcode, status: "created" });
    }

    res.json({
      imported: results.filter((r) => r.status === "created").length,
      results,
    });
  } catch (error: any) {
    console.error("CSV Import Error:", error);
    res.status(500).json({ error: `Internal server error during CSV import: ${error.message}` });
  }
});

const updateItemSchema = z.object({
  name: z.string().optional(),
  supplier: z.string().optional(),
  category: z.string().optional(),
  itemCode: z.string().optional(),
  barcode: z.string().optional(),
  warehouseId: z.string().nullable().optional(),
  systemQty: z.number().optional(),
});

router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  
  try {
    const updated = await prisma.item.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all items for the admin's company to allow resetting
router.delete("/clear", requireRole("ADMIN"), async (req, res) => {
  const companyId = req.auth!.companyId;
  try {
    await prisma.$transaction([
      prisma.itemUnit.deleteMany({
        where: { item: { companyId } },
      }),
      prisma.auditRecord.updateMany({
        where: { item: { companyId } },
        data: { itemId: null },
      }),
      prisma.item.deleteMany({
        where: { companyId },
      }),
    ]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a specific item by ID
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const id = req.params.id;
  try {
    await prisma.$transaction([
      prisma.itemUnit.deleteMany({
        where: { itemId: id },
      }),
      prisma.auditRecord.updateMany({
        where: { itemId: id },
        data: { itemId: null },
      }),
      prisma.item.delete({
        where: { id },
      }),
    ]);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

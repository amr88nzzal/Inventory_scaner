import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

const recordSchema = z.object({
  taskId: z.string(),
  itemId: z.string().nullable(), // null when barcode is not yet registered (see /pending-items)
  barcodeScanned: z.string(),
  locationLabel: z.string(),
  unitName: z.string(),
  qtyInUnit: z.number(),
  qtyPerUnit: z.number().positive(), // resolved client-side from the item's unit definition
  condition: z.enum(["NORMAL", "DAMAGED"]).default("NORMAL"),
  photoUrl: z.string().optional(),
  deviceTimestamp: z.string().datetime(),
});

// Bulk sync endpoint: the mobile app queues every scan locally while offline
// (each row already carries employeeId implicitly via the auth token, plus
// taskId, deviceTimestamp and the raw scan data) and POSTs the whole batch
// here once connectivity returns. Every record is inserted as a NEW row —
// nothing is ever updated in place — so two employees scanning the same
// item concurrently never overwrite each other; the report step aggregates
// afterward. deviceTimestamp (not serverTimestamp) is what orders events.
const bulkSyncSchema = z.object({
  records: z.array(recordSchema).min(1),
});

router.post("/sync", async (req, res) => {
  const parsed = bulkSyncSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const syncBatchId = uuidv4();
  const employeeId = req.auth!.userId;

  const created = await prisma.$transaction(
    parsed.data.records.map((r) =>
      prisma.auditRecord.create({
        data: {
          taskId: r.taskId,
          employeeId,
          itemId: r.itemId ?? undefined,
          barcodeScanned: r.barcodeScanned,
          locationLabel: r.locationLabel,
          unitName: r.unitName,
          qtyInUnit: r.qtyInUnit,
          qtyInBaseUnits: r.qtyInUnit * r.qtyPerUnit,
          condition: r.condition,
          photoUrl: r.photoUrl,
          deviceTimestamp: new Date(r.deviceTimestamp),
          syncBatchId,
        },
      })
    )
  );

  res.status(201).json({ syncBatchId, insertedCount: created.length });
});

// Live/online single-scan variant (same shape, used when the device has
// connectivity and wants immediate confirmation instead of queuing).
router.post("/", async (req, res) => {
  const parsed = recordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const r = parsed.data;

  const record = await prisma.auditRecord.create({
    data: {
      taskId: r.taskId,
      employeeId: req.auth!.userId,
      itemId: r.itemId ?? undefined,
      barcodeScanned: r.barcodeScanned,
      locationLabel: r.locationLabel,
      unitName: r.unitName,
      qtyInUnit: r.qtyInUnit,
      qtyInBaseUnits: r.qtyInUnit * r.qtyPerUnit,
      condition: r.condition,
      photoUrl: r.photoUrl,
      deviceTimestamp: new Date(r.deviceTimestamp),
    },
    include: { item: true },
  });
  res.status(201).json(record);
});

// Update an existing audit record (e.g. employee incrementing/decrementing or editing qty)
router.patch("/:id", async (req, res) => {
  const updateSchema = z.object({
    qtyInUnit: z.number().optional(),
    unitName: z.string().optional(),
    locationLabel: z.string().optional(),
    condition: z.enum(["NORMAL", "DAMAGED"]).optional(),
    photoUrl: z.string().optional(),
  });
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const record = await prisma.auditRecord.findUnique({ where: { id: req.params.id } });
  if (!record) return res.status(404).json({ error: "Record not found" });

  const qtyInUnit = parsed.data.qtyInUnit ?? record.qtyInUnit;
  const qtyPerUnit = record.qtyInBaseUnits && record.qtyInUnit ? (record.qtyInBaseUnits / record.qtyInUnit) : 1;

  const updated = await prisma.auditRecord.update({
    where: { id: req.params.id },
    data: {
      qtyInUnit,
      qtyInBaseUnits: qtyInUnit * qtyPerUnit,
      unitName: parsed.data.unitName ?? record.unitName,
      locationLabel: parsed.data.locationLabel ?? record.locationLabel,
      condition: parsed.data.condition ?? record.condition,
      photoUrl: parsed.data.photoUrl ?? record.photoUrl,
    },
    include: { item: true },
  });
  res.json(updated);
});

// Delete an audit record row
router.delete("/:id", async (req, res) => {
  try {
    await prisma.auditRecord.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// The last N scans for a task, for the "recent activity" list with +/- edit
// buttons on the mobile screen.
router.get("/task/:taskId/recent", async (req, res) => {
  const limit = Number(req.query.limit ?? 5);
  const records = await prisma.auditRecord.findMany({
    where: { taskId: req.params.taskId, employeeId: req.auth!.userId },
    orderBy: { deviceTimestamp: "desc" },
    take: limit,
    include: { item: true },
  });
  res.json(records);
});

const pendingItemSchema = z.object({
  taskId: z.string().optional(),
  barcode: z.string(),
  name: z.string().optional(),
  supplier: z.string().optional(),
  category: z.string().optional(),
  accountNo: z.string().optional(),
  unitName: z.string().optional(),
  location: z.string().optional(),
  price: z.number().optional(),
  quantity: z.number().optional(),
  photoProductUrl: z.string().optional(),
  photoBarcodeUrl: z.string().optional(),
});

// Reporting a scanned barcode that has no matching Item in the database.
// Creates a row the admin will later approve/reject from the pending queue.
router.post("/pending-items", async (req, res) => {
  const parsed = pendingItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const pending = await prisma.pendingItem.create({
    data: {
      companyId: req.auth!.companyId,
      barcode: data.barcode,
      name: data.name,
      supplier: data.supplier,
      category: data.category,
      accountNo: data.accountNo,
      unitName: data.unitName,
      location: data.location,
      price: data.price,
      quantity: data.quantity,
      photoProductUrl: data.photoProductUrl,
      photoBarcodeUrl: data.photoBarcodeUrl,
      reportedById: req.auth!.userId,
      taskId: data.taskId,
    },
  });
  res.status(201).json(pending);
});

export default router;

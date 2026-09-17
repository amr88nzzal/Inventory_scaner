import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeVariance } from "../utils/variance";
import { notifyUsers } from "../utils/notifications";

const router = Router();

// Admin queue of barcodes scanned during audits that had no matching Item.
router.get("/pending-items", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const items = await prisma.pendingItem.findMany({
    where: { companyId: req.auth!.companyId, status: "PENDING" },
    include: { reportedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(items);
});

// Update fields of a pending item before approving
router.patch("/pending-items/:id", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const { barcode, name, supplier, category, accountNo, unitName, location, price, quantity, systemQty, photoProductUrl } = req.body;
  const updated = await prisma.pendingItem.update({
    where: { id: req.params.id },
    data: {
      ...(barcode ? { barcode } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(supplier !== undefined ? { supplier } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(accountNo !== undefined ? { accountNo } : {}),
      ...(unitName !== undefined ? { unitName } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(price !== undefined ? { price: price ? Number(price) : null } : {}),
      ...(quantity !== undefined ? { quantity: quantity ? Number(quantity) : null } : {}),
      ...(photoProductUrl !== undefined ? { photoProductUrl } : {}),
    },
  });
  res.json(updated);
});

router.patch("/pending-items/:id/approve", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const body = req.body || {};
  
  // Find current pending item
  const existingPending = await prisma.pendingItem.findUnique({ where: { id: req.params.id } });
  if (!existingPending) return res.status(404).json({ error: "Pending item not found" });

  const barcode = body.barcode || existingPending.barcode;
  const name = body.name || existingPending.name || `منتج غير مسمى (${barcode})`;
  const supplier = body.supplier || existingPending.supplier || null;
  const category = body.category || existingPending.category || null;
  const accountNo = body.accountNo || existingPending.accountNo || null;
  const unitName = body.unitName || existingPending.unitName || "قطعة";
  const photoUrl = body.photoProductUrl || existingPending.photoProductUrl || null;
  const systemQty = body.systemQty !== undefined ? Number(body.systemQty) : 0;
  const price = body.price !== undefined ? Number(body.price) : (existingPending.price ? Number(existingPending.price) : undefined);

  // Mark pending item as approved
  const pending = await prisma.pendingItem.update({
    where: { id: req.params.id },
    data: {
      status: "APPROVED",
      barcode,
      name,
      supplier,
      category,
      accountNo,
      unitName,
      photoProductUrl: photoUrl,
    },
  });

  // Create as a real master Item in DB
  const item = await prisma.item.upsert({
    where: {
      companyId_barcode: {
        companyId: req.auth!.companyId,
        barcode,
      },
    },
    update: {
      name,
      supplier,
      category,
      accountNo,
      photoUrl,
      systemQty,
      price,
    },
    create: {
      companyId: req.auth!.companyId,
      barcode,
      name,
      supplier,
      category,
      accountNo,
      photoUrl,
      price,
      systemQty,
      units: { create: [{ unitName, qtyPerUnit: 1, isBase: true }] },
    },
  });

  // Link any pre-existing AuditRecords for this barcode to the new Item
  await prisma.auditRecord.updateMany({
    where: {
      barcodeScanned: barcode,
      itemId: null,
      task: { companyId: req.auth!.companyId },
    },
    data: {
      itemId: item.id,
    },
  });

  // If there's a taskId and reported quantity, ensure an AuditRecord exists
  if (pending.taskId && (pending.quantity || body.quantity)) {
    const qty = Number(body.quantity ?? pending.quantity ?? 1);
    const existingRecord = await prisma.auditRecord.findFirst({
      where: {
        taskId: pending.taskId,
        barcodeScanned: barcode,
      },
    });

    if (!existingRecord) {
      await prisma.auditRecord.create({
        data: {
          taskId: pending.taskId,
          employeeId: pending.reportedById,
          itemId: item.id,
          barcodeScanned: barcode,
          locationLabel: pending.location || "رف 1",
          unitName,
          qtyInUnit: qty,
          qtyInBaseUnits: qty,
          condition: "NORMAL",
          photoUrl: photoUrl || undefined,
          deviceTimestamp: new Date(),
        },
      });
    }
  }

  res.json({ pending, item });
});

router.patch("/pending-items/:id/reject", requireAuth, requireRole("ADMIN"), async (req, res) => {
  await prisma.pendingItem.update({ where: { id: req.params.id }, data: { status: "REJECTED" } });
  res.status(204).send();
});

// Generates the final consolidated report for a completed audit task:
// aggregates every AuditRecord by item, computes variance against the
// item's systemQty, and flags items that exceed the recount tolerance.
// Respects task.aggregateAcrossLocations and task.showVarianceAtEnd.
router.post("/tasks/:taskId/generate", requireAuth, requireRole("ADMIN", "REVIEWER"), async (req, res) => {
  const task = await prisma.auditTask.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ error: "task not found" });

  const records = await prisma.auditRecord.findMany({
    where: { taskId: task.id },
    include: { item: true },
  });

  // Group by item (or by item+location if the task keeps entries sequential).
  const groups = new Map<string, { itemId: string | null; barcode: string; qty: number; locations: Set<string> }>();
  for (const r of records) {
    const key = task.aggregateAcrossLocations ? r.itemId ?? r.barcodeScanned : `${r.itemId ?? r.barcodeScanned}::${r.locationLabel}`;
    const g = groups.get(key) ?? { itemId: r.itemId, barcode: r.barcodeScanned, qty: 0, locations: new Set<string>() };
    g.qty += r.qtyInBaseUnits;
    g.locations.add(r.locationLabel);
    groups.set(key, g);
  }

  const summary = Array.from(groups.values()).map((g) => {
    const item = records.find((r) => r.itemId === g.itemId)?.item;
    const variance = item
      ? computeVariance(
          item.systemQty,
          g.qty,
          item.recountTolerancePct ? Number(item.recountTolerancePct) : null,
          task.generalRecountTolerancePct ? Number(task.generalRecountTolerancePct) : null
        )
      : { systemQty: 0, countedQty: g.qty, varianceQty: g.qty, variancePct: 100, flaggedForRecount: true };

    return {
      itemId: g.itemId,
      barcode: g.barcode,
      name: item?.name ?? "(غير مسجل)",
      locations: Array.from(g.locations),
      ...(task.showVarianceAtEnd ? variance : { countedQty: g.qty }),
    };
  });

  // If any line is flagged, move the task to NEEDS_RECOUNT instead of approving it outright.
  const needsRecount = summary.some((s: any) => s.flaggedForRecount);

  const report = await prisma.auditReport.create({
    data: {
      taskId: task.id,
      generatedById: req.auth!.userId,
      summaryJson: summary as any,
    },
  });

  await prisma.auditTask.update({
    where: { id: task.id },
    data: { status: needsRecount ? "NEEDS_RECOUNT" : "PENDING_REVIEW" },
  });

  // Alert on critical shortages / recount needs immediately rather than
  // waiting for someone to open the dashboard, per the "نظام إشعارات ذكي
  // لضمان متابعة العمل بكفاءة عالية" requirement.
  if (needsRecount) {
    const admins = await prisma.user.findMany({
      where: { companyId: req.auth!.companyId, role: "ADMIN" },
      select: { id: true },
    });
    await notifyUsers(
      admins.map((a) => a.id),
      "طلب إعادة عد",
      `المهمة ${task.taskNumber} فيها فروقات تتجاوز الحد المسموح — تحتاج إعادة عد أو مراجعة`,
      { taskId: task.id }
    );
  }

  res.status(201).json({ report, needsRecount, summary });
});

// Exports a previously generated report as CSV, ready for accounting-software
// import or general download.
router.get("/reports/:reportId/csv", requireAuth, requireRole("ADMIN", "REVIEWER"), async (req, res) => {
  const report = await prisma.auditReport.findUnique({ where: { id: req.params.reportId } });
  if (!report) return res.status(404).json({ error: "not found" });

  const rows = report.summaryJson as any[];
  const header = "barcode,name,systemQty,countedQty,varianceQty,variancePct,flaggedForRecount,locations\n";
  const body = rows
    .map((r) =>
      [
        r.barcode,
        JSON.stringify(r.name ?? ""),
        r.systemQty ?? "",
        r.countedQty ?? "",
        r.varianceQty ?? "",
        r.variancePct ?? "",
        r.flaggedForRecount ?? "",
        JSON.stringify((r.locations ?? []).join("; ")),
      ].join(",")
    )
    .join("\n");

  const uploadDir = process.env.UPLOAD_DIR || "./uploads";
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const filePath = path.join(uploadDir, `report-${report.id}.csv`);
  fs.writeFileSync(filePath, header + body);

  res.download(filePath);
});

export default router;

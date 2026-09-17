import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole, assertWarehouseScope } from "../middleware/auth";
import { notifyUsers } from "../utils/notifications";

const router = Router();
router.use(requireAuth);

const createTaskSchema = z.object({
  warehouseId: z.string(),
  taskNumber: z.string(),
  assigneeUserIds: z.array(z.string()).min(1),
  scopeType: z.enum(["ALL", "CATEGORY", "SUPPLIER", "ITEM_LIST"]),
  scopeValue: z.string().optional(),
  locationScope: z.string().optional(),
  startTime: z.string().datetime(),
  blindCount: z.boolean().default(false),
  showVarianceAtEnd: z.boolean().default(true),
  generalRecountTolerancePct: z.number().optional(),
  aggregateAcrossLocations: z.boolean().default(true),
});

// Admin assigns an audit task to one or more employees, scoped to a
// warehouse and a set of items (all / category / supplier / explicit list).
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const task = await prisma.auditTask.create({
    data: {
      companyId: req.auth!.companyId,
      warehouseId: data.warehouseId,
      taskNumber: data.taskNumber,
      scopeType: data.scopeType,
      scopeValue: data.scopeValue,
      locationScope: data.locationScope,
      startTime: new Date(data.startTime),
      blindCount: data.blindCount,
      showVarianceAtEnd: data.showVarianceAtEnd,
      generalRecountTolerancePct: data.generalRecountTolerancePct,
      aggregateAcrossLocations: data.aggregateAcrossLocations,
      assignees: { create: data.assigneeUserIds.map((userId) => ({ userId })) },
    },
    include: { assignees: true },
  });

  // Notify every assigned employee immediately with the task details, as
  // specified: "يصل للموظف اشعار بهذه المهمة الجديدة مع كافة التفاصيل".
  const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
  await notifyUsers(
    data.assigneeUserIds,
    "مهمة جرد جديدة",
    `تم إسناد مهمة جرد جديدة لك: ${data.taskNumber} في ${warehouse?.name ?? "المستودع"}`,
    { taskId: task.id, taskNumber: data.taskNumber }
  );

  res.status(201).json(task);
});

// Admin: list every audit task in the company (for the dashboard).
router.get("/", requireRole("ADMIN"), async (req, res) => {
  const tasks = await prisma.auditTask.findMany({
    where: { companyId: req.auth!.companyId },
    include: { warehouse: true, assignees: { include: { user: { select: { name: true } } } } },
    orderBy: { startTime: "desc" },
  });
  res.json(tasks);
});

// Employee: list tasks assigned to me.
router.get("/mine", async (req, res) => {
  const tasks = await prisma.auditTask.findMany({
    where: { assignees: { some: { userId: req.auth!.userId } } },
    include: { warehouse: { include: { locations: true } } },
    orderBy: { startTime: "desc" },
  });
  res.json(tasks);
});

router.get("/:id", async (req, res) => {
  const task = await prisma.auditTask.findUnique({
    where: { id: req.params.id },
    include: { warehouse: { include: { locations: true } }, assignees: true },
  });
  if (!task) return res.status(404).json({ error: "not found" });
  if (!assertWarehouseScope(req.auth!, task.warehouseId)) {
    return res.status(403).json({ error: "out of scope" });
  }
  res.json(task);
});

// Update task status (e.g., IN_PROGRESS, PENDING_REVIEW, COMPLETED)
router.patch("/:id/status", async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: "Status required" });
  try {
    const updated = await prisma.auditTask.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

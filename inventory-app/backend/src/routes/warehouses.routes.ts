import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const warehouses = await prisma.warehouse.findMany({
    where: { companyId: req.auth!.companyId },
    include: { locations: true },
  });
  res.json(warehouses);
});

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  locations: z.array(z.string()).default([]), // e.g. ["الواجهة رقم 1", "صالة رقم 5"]
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createWarehouseSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, locations } = parsed.data;

  const warehouse = await prisma.warehouse.create({
    data: {
      companyId: req.auth!.companyId,
      name,
      locations: { create: locations.map((label) => ({ label })) },
    },
    include: { locations: true },
  });

  res.status(201).json(warehouse);
});

export default router;

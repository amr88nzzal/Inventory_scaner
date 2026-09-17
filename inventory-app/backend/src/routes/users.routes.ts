import { Router } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth, requireRole } from "../middleware/auth";

const router = Router();
router.use(requireAuth);

// List all users (employees/reviewers) in the admin's company.
router.get("/", requireRole("ADMIN"), async (req, res) => {
  const users = await prisma.user.findMany({
    where: { companyId: req.auth!.companyId },
    select: { id: true, name: true, username: true, role: true, warehouseScope: true, active: true },
  });
  res.json(users);
});

const createUserSchema = z.object({
  name: z.string().min(2),
  username: z.string().min(3),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "EMPLOYEE", "REVIEWER"]).default("EMPLOYEE"),
  warehouseScope: z.array(z.string()).default([]), // restrict user to specific warehouses; [] = all
});

// Admin adds an employee/reviewer and sets their warehouse-level permissions.
router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, username, password, role, warehouseScope } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return res.status(409).json({ error: "Username already taken" });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { companyId: req.auth!.companyId, name, username, passwordHash, role, warehouseScope },
  });

  res.status(201).json({ id: user.id });
});

router.patch("/:id/deactivate", requireRole("ADMIN"), async (req, res) => {
  await prisma.user.update({
    where: { id: req.params.id },
    data: { active: false },
  });
  res.status(204).send();
});

// Employee/admin registers or refreshes their device's FCM token so the
// server can push task-assignment and recount notifications to them.
router.post("/me/fcm-token", async (req, res) => {
  const { fcmToken } = req.body as { fcmToken?: string };
  if (!fcmToken) return res.status(400).json({ error: "fcmToken is required" });
  await prisma.user.update({ where: { id: req.auth!.userId }, data: { fcmToken } });
  res.status(204).send();
});

export default router;

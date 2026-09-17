import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../prisma";

const router = Router();

const signupSchema = z.object({
  companyName: z.string().min(2),
  adminName: z.string().min(2),
  adminUsername: z.string().min(3),
  adminPassword: z.string().min(6),
});

// Creates a new company account together with its first admin user.
router.post("/signup", async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { companyName, adminName, adminUsername, adminPassword } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (existing) return res.status(409).json({ error: "Username already taken" });

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const company = await prisma.company.create({
    data: {
      name: companyName,
      users: {
        create: {
          name: adminName,
          username: adminUsername,
          passwordHash,
          role: "ADMIN",
        },
      },
    },
    include: { users: true },
  });

  return res.status(201).json({ companyId: company.id, adminId: company.users[0].id });
});

const loginSchema = z.object({
  username: z.string(),
  password: z.string(),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    {
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      warehouseScope: user.warehouseScope,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: (process.env.JWT_EXPIRES_IN || "12h") as any }
  );

  return res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

export default router;

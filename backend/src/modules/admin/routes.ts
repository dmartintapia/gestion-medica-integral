import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/role.js";
import { validar } from "../../middlewares/validate.js";
import { prisma } from "../../lib/prisma.js";

export const adminRouter = Router();
adminRouter.use(authMiddleware, requireRole("admin"));

adminRouter.get("/usuarios", async (_req, res, next) => {
  try {
    const data = await prisma.usuario.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true, email: true, rol: true, activo: true, createdAt: true }
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

const estadoSchema = z.object({ activo: z.boolean() });
adminRouter.patch("/usuarios/:id/estado", validar(estadoSchema), async (req, res, next) => {
  try {
    const idUsuario = String(req.params.id);
    const updated = await prisma.usuario.update({ where: { id: idUsuario }, data: { activo: req.body.activo } });
    res.json({ id: updated.id, activo: updated.activo });
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/auditoria", async (_req, res, next) => {
  try {
    const eventos = await prisma.auditoriaEvento.findMany({ orderBy: { fecha: "desc" }, take: 200 });
    res.json(eventos);
  } catch (err) {
    next(err);
  }
});

adminRouter.get("/reportes/uso", async (_req, res, next) => {
  try {
    const totalTurnos = await prisma.turno.count();
    const completados = await prisma.turno.count({ where: { estado: "completado" } });
    const cancelados = await prisma.turno.count({ where: { estado: "cancelado" } });
    res.json({ totalTurnos, completados, cancelados, tasaCancelacion: totalTurnos ? cancelados / totalTurnos : 0 });
  } catch (err) {
    next(err);
  }
});

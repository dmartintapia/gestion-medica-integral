import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.js";
import { prisma } from "../../lib/prisma.js";

export const usuariosRouter = Router();
usuariosRouter.use(authMiddleware);

usuariosRouter.get("/me", async (req, res, next) => {
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: req.usuario!.id },
      select: { id: true, nombre: true, email: true, rol: true, telefono: true, activo: true }
    });
    res.json(user);
  } catch (err) {
    next(err);
  }
});
import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../../middlewares/auth.js";
import { requireRole } from "../../middlewares/role.js";
import { validar } from "../../middlewares/validate.js";
import { prisma } from "../../lib/prisma.js";
import { enviarNotificacion } from "./service.js";

export const notificacionesRouter = Router();

const configSchema = z.object({
  proveedorWhatsapp: z.string().default("simulado"),
  proveedorEmail: z.string().default("simulado"),
  pushActivo: z.boolean().default(false)
});

notificacionesRouter.post("/config", authMiddleware, requireRole("admin"), validar(configSchema), async (req, res) => {
  // En implementación real, persistir configuración cifrada en base/secret manager.
  res.json({ ok: true, ...req.body });
});

const webhookSchema = z.object({
  telefono: z.string(),
  texto: z.string()
});

notificacionesRouter.post("/webhook/whatsapp", validar(webhookSchema), async (req, res, next) => {
  try {
    const texto = req.body.texto.trim().toUpperCase();
    const usuario = await prisma.usuario.findFirst({ where: { telefono: req.body.telefono } });
    if (!usuario) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

    if (texto !== "CONFIRMAR" && texto !== "CANCELAR") {
      res.status(400).json({ message: "Comando inválido" });
      return;
    }

    const paciente = await prisma.paciente.findUnique({ where: { usuarioId: usuario.id } });
    if (!paciente) {
      res.status(404).json({ message: "Paciente no encontrado" });
      return;
    }

    const turno = await prisma.turno.findFirst({
      where: {
        pacienteId: paciente.id,
        estado: { in: ["pendiente", "confirmado"] },
        inicio: { gt: new Date() }
      },
      orderBy: { inicio: "asc" }
    });

    if (!turno) {
      res.status(404).json({ message: "No hay turnos próximos" });
      return;
    }

    const estado = texto === "CONFIRMAR" ? "confirmado" : "cancelado";
    await prisma.turno.update({ where: { id: turno.id }, data: { estado } });
    await enviarNotificacion("whatsapp", req.body.telefono, `Estado actualizado: ${estado}`);
    res.json({ ok: true, turnoId: turno.id, estado });
  } catch (err) {
    next(err);
  }
});

export function iniciarSchedulerRecordatorios(): void {
  setInterval(async () => {
    const ahora = new Date();
    const enDosHoras = new Date(Date.now() + 2 * 3600000);

    const turnos = await prisma.turno.findMany({
      where: {
        estado: "confirmado",
        inicio: { gte: ahora, lte: enDosHoras }
      },
      include: {
        paciente: { include: { usuario: true } },
        medico: { include: { usuario: true, especialidad: true } }
      }
    });

    for (const turno of turnos) {
      const mensaje = `Recordatorio: turno ${turno.inicio.toISOString()} con ${turno.medico.usuario.nombre}.`;
      await enviarNotificacion("email", turno.paciente.usuario.email, mensaje);
      if (turno.paciente.usuario.telefono) {
        await enviarNotificacion("whatsapp", turno.paciente.usuario.telefono, mensaje);
      }
    }
  }, 15 * 60 * 1000);
}
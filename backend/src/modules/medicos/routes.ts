import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.js";
import { descifrarTexto } from "../../lib/crypto.js";
import { requireRole } from "../../middlewares/role.js";
import { prisma } from "../../lib/prisma.js";

export const medicosRouter = Router();

medicosRouter.get("/", async (req, res, next) => {
  try {
    const especialidad = req.query.especialidad?.toString();
    const medicos = await prisma.medico.findMany({
      where: especialidad
        ? {
            especialidad: {
              nombre: { contains: especialidad, mode: "insensitive" }
            }
          }
        : undefined,
      include: {
        usuario: { select: { nombre: true } },
        especialidad: true,
        disponibilidades: true
      }
    });

    res.json(medicos.map((m: any) => ({
      id: m.id,
      nombre: m.usuario.nombre,
      especialidad: m.especialidad.nombre,
      cmp: m.cmp,
      consultorio: m.consultorio,
      disponibilidad: m.disponibilidades
    })));
  } catch (err) {
    next(err);
  }
});

medicosRouter.get("/agenda", authMiddleware, requireRole("medico"), async (req, res, next) => {
  try {
    const usuarioId = req.usuario!.id;
    const medico = await prisma.medico.findUnique({ where: { usuarioId } });
    if (!medico) {
      res.status(404).json({ message: "Médico no encontrado" });
      return;
    }

    const desde = new Date(req.query.desde?.toString() || new Date().toISOString());
    const hasta = new Date(req.query.hasta?.toString() || new Date(Date.now() + 7 * 86400000).toISOString());

    const turnos = await prisma.turno.findMany({
      where: { medicoId: medico.id, inicio: { gte: desde, lte: hasta } },
      include: {
        paciente: {
          include: {
            usuario: { select: { nombre: true, email: true, telefono: true } }
          }
        },
        documentosPrevios: {
          select: { id: true, nombreArchivo: true, mimeType: true, tamanoBytes: true, createdAt: true }
        },
        consulta: {
          select: { id: true, fecha: true }
        }
      },
      orderBy: { inicio: "asc" }
    });

    res.json(
      turnos.map((turno: any) => ({
        ...turno,
        paciente: {
          ...turno.paciente,
          edad: turno.paciente.fechaNacimiento
            ? Math.max(
                0,
                Math.floor(
                  (Date.now() - new Date(turno.paciente.fechaNacimiento).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
                )
              )
            : null,
          alergias: turno.paciente.alergiasEnc ? descifrarTexto(turno.paciente.alergiasEnc) : null,
          cronicas: turno.paciente.cronicasEnc ? descifrarTexto(turno.paciente.cronicasEnc) : null,
          medicacionHabitual: turno.paciente.medicacionHabitualEnc
            ? descifrarTexto(turno.paciente.medicacionHabitualEnc)
            : null,
          contactoEmergencia: turno.paciente.emergenciaEnc ? descifrarTexto(turno.paciente.emergenciaEnc) : null
        }
      }))
    );
  } catch (err) {
    next(err);
  }
});

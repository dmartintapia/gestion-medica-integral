import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { authMiddleware } from "../../middlewares/auth.js";
import { registrarAuditoria } from "../../middlewares/error.js";
import { requireRole } from "../../middlewares/role.js";
import { validar } from "../../middlewares/validate.js";
import { cifrarTexto, descifrarTexto } from "../../lib/crypto.js";
import { prisma } from "../../lib/prisma.js";

export const historialRouter = Router();

historialRouter.get("/mi", authMiddleware, requireRole("paciente"), async (req, res, next) => {
  try {
    const paciente = await prisma.paciente.findUnique({ where: { usuarioId: req.usuario!.id } });
    if (!paciente) {
      res.status(404).json({ message: "Paciente no encontrado" });
      return;
    }

    const consultas = await prisma.consulta.findMany({
      where: { turno: { pacienteId: paciente.id } },
      include: {
        turno: { include: { medico: { include: { usuario: true, especialidad: true } } } },
        recetas: true,
        adjuntos: true
      },
      orderBy: { fecha: "desc" }
    });

    const data = consultas.map((c: any) => ({
      ...c,
      diagnostico: c.diagnosticoEnc ? descifrarTexto(c.diagnosticoEnc) : null,
      notas: c.notasEnc ? descifrarTexto(c.notasEnc) : null,
      indicaciones: c.indicacionesEnc ? descifrarTexto(c.indicacionesEnc) : null
    }));

    await registrarAuditoria(req, "leer_historial", "paciente", paciente.id, "ok");
    res.json(data);
  } catch (err) {
    next(err);
  }
});

historialRouter.get("/paciente/:pacienteId", authMiddleware, requireRole("medico"), async (req, res, next) => {
  try {
    const pacienteId = String(req.params.pacienteId);
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario!.id } });
    if (!medico) {
      res.status(404).json({ message: "Médico no encontrado" });
      return;
    }

    const tieneRelacion = await prisma.turno.findFirst({
      where: {
        medicoId: medico.id,
        pacienteId
      }
    });

    if (!tieneRelacion) {
      res.status(403).json({ message: "Sin consentimiento/relación asistencial" });
      return;
    }

    const consultas = await prisma.consulta.findMany({
      where: { turno: { pacienteId } },
      include: { recetas: true, adjuntos: true, turno: true },
      orderBy: { fecha: "desc" }
    });

    res.json(consultas.map((c: any) => ({
      ...c,
      diagnostico: c.diagnosticoEnc ? descifrarTexto(c.diagnosticoEnc) : null,
      notas: c.notasEnc ? descifrarTexto(c.notasEnc) : null,
      indicaciones: c.indicacionesEnc ? descifrarTexto(c.indicacionesEnc) : null
    })));
  } catch (err) {
    next(err);
  }
});

const crearConsultaSchema = z.object({
  turnoId: z.string().min(3),
  motivo: z.string().min(3),
  diagnostico: z.string().max(4000).optional(),
  cie10: z.string().max(20).optional(),
  notas: z.string().max(8000).optional(),
  indicaciones: z.string().max(4000).optional(),
  recetas: z.array(z.object({
    medicamento: z.string(),
    dosis: z.string(),
    duracion: z.string(),
    instrucciones: z.string().optional()
  })).optional()
});

historialRouter.post("/consulta", authMiddleware, requireRole("medico"), validar(crearConsultaSchema), async (req, res, next) => {
  try {
    const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario!.id } });
    if (!medico) {
      res.status(404).json({ message: "Médico no encontrado" });
      return;
    }

    const turno = await prisma.turno.findUnique({ where: { id: req.body.turnoId } });
    if (!turno || turno.medicoId !== medico.id) {
      res.status(403).json({ message: "Turno no asociado al médico" });
      return;
    }

    const cleanedNotas = req.body.notas ? sanitizeHtml(req.body.notas, { allowedTags: [], allowedAttributes: {} }) : undefined;
    const consulta = await prisma.consulta.create({
      data: {
        turnoId: turno.id,
        motivo: req.body.motivo,
        diagnosticoEnc: req.body.diagnostico ? cifrarTexto(req.body.diagnostico) : undefined,
        cie10: req.body.cie10,
        notasEnc: cleanedNotas ? cifrarTexto(cleanedNotas) : undefined,
        indicacionesEnc: req.body.indicaciones ? cifrarTexto(req.body.indicaciones) : undefined,
        recetas: req.body.recetas
          ? {
              create: req.body.recetas.map((r: any) => ({
                medicamento: r.medicamento,
                dosis: r.dosis,
                duracion: r.duracion,
                instrucciones: r.instrucciones
              }))
            }
          : undefined
      },
      include: { recetas: true }
    });

    await prisma.turno.update({ where: { id: turno.id }, data: { estado: "completado" } });
    await registrarAuditoria(req, "crear_consulta", "consulta", consulta.id, "ok");
    res.status(201).json(consulta);
  } catch (err) {
    next(err);
  }
});

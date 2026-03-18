import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { Router } from "express";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { authMiddleware } from "../../middlewares/auth.js";
import { registrarAuditoria } from "../../middlewares/error.js";
import { requireRole } from "../../middlewares/role.js";
import { validar } from "../../middlewares/validate.js";
import { prisma } from "../../lib/prisma.js";
import { enviarNotificacion } from "../notificaciones/service.js";

export const turnosRouter = Router();
const uploadDir = path.resolve(process.cwd(), "uploads", "documentos-previos");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ext.match(/^\.[a-z0-9]+$/) ? ext : "";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${safeExt}`);
  }
});

const uploadDocumento = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const permitidos = ["application/pdf", "image/png", "image/jpeg"];
    if (!permitidos.includes(file.mimetype)) {
      cb(new Error("Tipo de archivo no permitido. Use PDF, PNG o JPG."));
      return;
    }
    cb(null, true);
  }
});

const crearTurnoSchema = z.object({
  medicoId: z.string().min(3),
  inicio: z.string().datetime(),
  modalidad: z.enum(["presencial", "online"]),
  motivo: z.string().min(3).max(300),
  timezone: z.string().min(3).max(120).default("America/Argentina/Buenos_Aires")
});

turnosRouter.post("/", authMiddleware, requireRole("paciente"), validar(crearTurnoSchema), async (req, res, next) => {
  try {
    const paciente = await prisma.paciente.findUnique({
      where: { usuarioId: req.usuario!.id },
      include: { usuario: true }
    });
    if (!paciente) {
      res.status(404).json({ message: "Paciente no encontrado" });
      return;
    }

    const medico = await prisma.medico.findUnique({
      where: { id: req.body.medicoId },
      include: { usuario: true, especialidad: true }
    });
    if (!medico) {
      res.status(404).json({ message: "Médico no encontrado" });
      return;
    }

    const inicio = new Date(req.body.inicio);
    const fin = new Date(inicio.getTime() + medico.slotMinutos * 60000);
    const ahora = Date.now();
    if (inicio.getTime() < ahora + 10 * 60000) {
      res.status(400).json({ message: "El turno debe agendarse con al menos 10 minutos de anticipación" });
      return;
    }

    const motivo = sanitizeHtml(req.body.motivo, { allowedTags: [], allowedAttributes: {} });

    const creado = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('${medico.id}'))`);

      const bloqueo = await tx.bloqueoAgenda.findFirst({
        where: {
          medicoId: medico.id,
          inicio: { lt: fin },
          fin: { gt: inicio }
        }
      });
      if (bloqueo) {
        throw new Error("Horario bloqueado por el médico");
      }

      const superpuesto = await tx.turno.findFirst({
        where: {
          medicoId: medico.id,
          estado: { not: "cancelado" },
          inicio: { lt: fin },
          fin: { gt: inicio }
        }
      });
      if (superpuesto) {
        throw new Error("Slot ya reservado");
      }

      return tx.turno.create({
        data: {
          medicoId: medico.id,
          pacienteId: paciente.id,
          inicio,
          fin,
          modalidad: req.body.modalidad,
          motivo,
          timezone: req.body.timezone,
          meetingLink: req.body.modalidad === "online" ? `https://meet.jit.si/gmi-${Date.now()}` : null,
          estado: "confirmado"
        }
      });
    });

    const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(inicio);
    const mensaje = `Hola ${paciente.usuario.nombre}, su turno fue confirmado para ${fecha} con ${medico.usuario.nombre} (${medico.especialidad.nombre}).`;
    await enviarNotificacion("email", paciente.usuario.email, mensaje);
    if (paciente.usuario.telefono) {
      await enviarNotificacion("whatsapp", paciente.usuario.telefono, mensaje);
    }

    await registrarAuditoria(req, "crear_turno", "turno", creado.id, "ok");
    res.status(201).json(creado);
  } catch (err) {
    if (err instanceof Error) {
      res.status(409).json({ message: err.message });
      return;
    }
    next(err);
  }
});

turnosRouter.get("/mis", authMiddleware, requireRole("paciente"), async (req, res, next) => {
  try {
    const paciente = await prisma.paciente.findUnique({ where: { usuarioId: req.usuario!.id } });
    if (!paciente) {
      res.status(404).json({ message: "Paciente no encontrado" });
      return;
    }

    const turnos = await prisma.turno.findMany({
      where: { pacienteId: paciente.id },
      include: {
        medico: { include: { usuario: true, especialidad: true } },
        documentosPrevios: {
          select: { id: true, nombreArchivo: true, mimeType: true, tamanoBytes: true, createdAt: true }
        }
      },
      orderBy: { inicio: "desc" }
    });

    res.json(turnos);
  } catch (err) {
    next(err);
  }
});

turnosRouter.post("/:id/documentos", authMiddleware, requireRole("paciente"), uploadDocumento.single("archivo"), async (req, res, next) => {
  try {
    const turnoId = String(req.params.id);
    const archivo = req.file;
    if (!archivo) {
      res.status(400).json({ message: "Debe adjuntar un archivo" });
      return;
    }

    const turno = await prisma.turno.findUnique({
      where: { id: turnoId },
      include: { paciente: true }
    });
    if (!turno) {
      fs.unlinkSync(archivo.path);
      res.status(404).json({ message: "Turno no encontrado" });
      return;
    }

    const paciente = await prisma.paciente.findUnique({ where: { usuarioId: req.usuario!.id } });
    if (!paciente || paciente.id !== turno.pacienteId) {
      fs.unlinkSync(archivo.path);
      res.status(403).json({ message: "No autorizado para adjuntar en este turno" });
      return;
    }

    const checksum = crypto.createHash("sha256").update(fs.readFileSync(archivo.path)).digest("hex");
    const doc = await prisma.documentoPrevio.create({
      data: {
        turnoId: turno.id,
        nombreArchivo: archivo.originalname,
        rutaStorage: archivo.path,
        mimeType: archivo.mimetype,
        tamanoBytes: archivo.size,
        checksum
      }
    });

    await registrarAuditoria(req, "subir_documento_previo", "turno", turno.id, "ok");
    res.status(201).json({
      id: doc.id,
      nombreArchivo: doc.nombreArchivo,
      mimeType: doc.mimeType,
      tamanoBytes: doc.tamanoBytes,
      createdAt: doc.createdAt
    });
  } catch (err) {
    next(err);
  }
});

turnosRouter.get("/:id/documentos", authMiddleware, async (req, res, next) => {
  try {
    const turnoId = String(req.params.id);
    const turno = await prisma.turno.findUnique({
      where: { id: turnoId },
      include: {
        paciente: true,
        medico: true,
        documentosPrevios: {
          select: { id: true, nombreArchivo: true, mimeType: true, tamanoBytes: true, createdAt: true }
        }
      }
    });
    if (!turno) {
      res.status(404).json({ message: "Turno no encontrado" });
      return;
    }

    if (req.usuario!.rol === "paciente") {
      const paciente = await prisma.paciente.findUnique({ where: { usuarioId: req.usuario!.id } });
      if (!paciente || paciente.id !== turno.pacienteId) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
    }

    if (req.usuario!.rol === "medico") {
      const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario!.id } });
      if (!medico || medico.id !== turno.medicoId) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
    }

    res.json(turno.documentosPrevios);
  } catch (err) {
    next(err);
  }
});

turnosRouter.get("/documentos/:docId/descargar", authMiddleware, async (req, res, next) => {
  try {
    const docId = String(req.params.docId);
    const doc = await prisma.documentoPrevio.findUnique({
      where: { id: docId },
      include: { turno: true }
    });
    if (!doc) {
      res.status(404).json({ message: "Documento no encontrado" });
      return;
    }

    if (req.usuario!.rol === "paciente") {
      const paciente = await prisma.paciente.findUnique({ where: { usuarioId: req.usuario!.id } });
      if (!paciente || paciente.id !== doc.turno.pacienteId) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
    }

    if (req.usuario!.rol === "medico") {
      const medico = await prisma.medico.findUnique({ where: { usuarioId: req.usuario!.id } });
      if (!medico || medico.id !== doc.turno.medicoId) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
    }

    res.download(doc.rutaStorage, doc.nombreArchivo);
  } catch (err) {
    next(err);
  }
});

turnosRouter.delete("/documentos/:docId", authMiddleware, requireRole("paciente", "admin"), async (req, res, next) => {
  try {
    const docId = String(req.params.docId);
    const doc = await prisma.documentoPrevio.findUnique({
      where: { id: docId },
      include: { turno: true }
    });

    if (!doc) {
      res.status(404).json({ message: "Documento no encontrado" });
      return;
    }

    if (req.usuario!.rol === "paciente") {
      const paciente = await prisma.paciente.findUnique({ where: { usuarioId: req.usuario!.id } });
      if (!paciente || paciente.id !== doc.turno.pacienteId) {
        res.status(403).json({ message: "No autorizado" });
        return;
      }
    }

    if (fs.existsSync(doc.rutaStorage)) {
      fs.unlinkSync(doc.rutaStorage);
    }

    await prisma.documentoPrevio.delete({ where: { id: doc.id } });
    await registrarAuditoria(req, "eliminar_documento_previo", "turno", doc.turnoId, "ok");

    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const actualizarSchema = z.object({
  inicio: z.string().datetime().optional(),
  motivoCancelacion: z.string().min(3).max(300).optional()
});

turnosRouter.patch("/:id/cancelar", authMiddleware, validar(actualizarSchema), async (req, res, next) => {
  try {
    const turnoId = String(req.params.id);
    const turno = await prisma.turno.findUnique({
      where: { id: turnoId },
      include: { paciente: { include: { usuario: true } } }
    });
    if (!turno) {
      res.status(404).json({ message: "Turno no encontrado" });
      return;
    }

    if (turno.paciente.usuarioId !== req.usuario!.id && req.usuario!.rol !== "admin") {
      res.status(403).json({ message: "No autorizado" });
      return;
    }

    if (turno.inicio.getTime() - Date.now() < 24 * 3600000) {
      res.status(400).json({ message: "Solo se puede cancelar con 24h de anticipación" });
      return;
    }

    const updated = await prisma.turno.update({
      where: { id: turno.id },
      data: {
        estado: "cancelado",
        motivoCancelacion: req.body.motivoCancelacion || "Cancelado por usuario"
      }
    });

    await registrarAuditoria(req, "cancelar_turno", "turno", updated.id, "ok");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

turnosRouter.patch("/:id/reprogramar", authMiddleware, requireRole("paciente"), validar(actualizarSchema), async (req, res, next) => {
  try {
    if (!req.body.inicio) {
      res.status(400).json({ message: "inicio es obligatorio" });
      return;
    }

    const turnoId = String(req.params.id);
    const turno = await prisma.turno.findUnique({
      where: { id: turnoId },
      include: { paciente: true, medico: true }
    });
    if (!turno) {
      res.status(404).json({ message: "Turno no encontrado" });
      return;
    }

    const paciente = await prisma.paciente.findUnique({ where: { usuarioId: req.usuario!.id } });
    if (!paciente || paciente.id !== turno.pacienteId) {
      res.status(403).json({ message: "No autorizado" });
      return;
    }

    const nuevoInicio = new Date(req.body.inicio);
    const nuevoFin = new Date(nuevoInicio.getTime() + turno.medico.slotMinutos * 60000);

    const superpuesto = await prisma.turno.findFirst({
      where: {
        id: { not: turno.id },
        medicoId: turno.medicoId,
        estado: { not: "cancelado" },
        inicio: { lt: nuevoFin },
        fin: { gt: nuevoInicio }
      }
    });

    if (superpuesto) {
      res.status(409).json({ message: "Nuevo horario no disponible" });
      return;
    }

    const updated = await prisma.turno.update({ where: { id: turno.id }, data: { inicio: nuevoInicio, fin: nuevoFin, version: { increment: 1 } } });
    await registrarAuditoria(req, "reprogramar_turno", "turno", updated.id, "ok");
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

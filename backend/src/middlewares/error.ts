import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export async function registrarAuditoria(req: Request, accion: string, recurso: string, recursoId: string | null, resultado: string): Promise<void> {
  await prisma.auditoriaEvento.create({
    data: {
      actorId: req.usuario?.id,
      accion,
      recurso,
      recursoId: recursoId || undefined,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
      requestId: req.requestId,
      resultado
    }
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof Error && (err.name === "MulterError" || err.message.includes("Tipo de archivo no permitido"))) {
    res.status(400).json({
      code: "UPLOAD_ERROR",
      message: err.message,
      request_id: req.requestId
    });
    return;
  }

  console.error("Error no controlado", err);
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "Error interno",
    request_id: req.requestId
  });
}

import { NextFunction, Request, Response } from "express";

type RolPermitido = "admin" | "medico" | "paciente";

export function requireRole(...roles: RolPermitido[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) {
      res.status(403).json({ message: "Permisos insuficientes" });
      return;
    }
    next();
  };
}

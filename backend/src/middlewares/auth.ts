import { NextFunction, Request, Response } from "express";
import { verificarToken } from "../lib/jwt.js";

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const bearer = req.headers.authorization;
  if (!bearer?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token ausente" });
    return;
  }

  try {
    const token = bearer.replace("Bearer ", "");
    const payload = verificarToken(token);
    req.usuario = { id: payload.sub, rol: payload.rol, email: payload.email };
    next();
  } catch {
    res.status(401).json({ message: "Token inválido" });
  }
}
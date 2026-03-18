import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export type JwtPayload = {
  sub: string;
  rol: "admin" | "medico" | "paciente";
  email: string;
};

export function crearAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${env.accessExpiresMin}m`
  });
}

export function crearRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: "HS256",
    expiresIn: `${env.refreshExpiresDays}d`
  });
}

export function verificarToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as JwtPayload;
}

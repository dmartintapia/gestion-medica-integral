import bcrypt from "bcryptjs";
import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { registrarAuditoria } from "../../middlewares/error.js";
import { validar } from "../../middlewares/validate.js";
import { hashSha256 } from "../../lib/crypto.js";
import { crearAccessToken, crearRefreshToken, verificarToken } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";

export const authRouter = Router();

const registroSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  telefono: z.string().min(6).max(30).optional(),
  password: z.string().min(8).max(120),
  rol: z.enum(["admin", "medico", "paciente"])
});

authRouter.post("/registro", validar(registroSchema), async (req, res, next) => {
  try {
    const { nombre, email, telefono, password, rol } = req.body;
    const existente = await prisma.usuario.findUnique({ where: { email } });
    if (existente) {
      res.status(409).json({ message: "Email ya registrado" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        telefono,
        passwordHash,
        rol,
        paciente: rol === "paciente" ? { create: {} } : undefined
      }
    });

    await registrarAuditoria(req, "registro", "usuario", usuario.id, "ok");
    res.status(201).json({ id: usuario.id, email: usuario.email, rol: usuario.rol });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(120),
  token2fa: z.string().optional()
});

authRouter.post("/login", validar(loginSchema), async (req, res, next) => {
  try {
    const { email, password, token2fa } = req.body;
    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) {
      await registrarAuditoria(req, "login", "usuario", usuario?.id || null, "denegado");
      res.status(401).json({ message: "Credenciales inválidas" });
      return;
    }

    const ok = await bcrypt.compare(password, usuario.passwordHash);
    if (!ok) {
      await registrarAuditoria(req, "login", "usuario", usuario.id, "denegado");
      res.status(401).json({ message: "Credenciales inválidas" });
      return;
    }

    if (usuario.dosFaHabilitado) {
      const { authenticator } = await import("otplib");
      if (!token2fa || !usuario.dosFaSecreto || !authenticator.verify({ token: token2fa, secret: usuario.dosFaSecreto })) {
        res.status(401).json({ message: "2FA inválido" });
        return;
      }
    }

    const payload = { sub: usuario.id, rol: usuario.rol, email: usuario.email };
    const accessToken = crearAccessToken(payload);
    const refreshToken = crearRefreshToken(payload);

    await prisma.tokenRefresh.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: hashSha256(refreshToken),
        expiraEn: new Date(Date.now() + env.refreshExpiresDays * 86400000)
      }
    });

    await registrarAuditoria(req, "login", "usuario", usuario.id, "ok");
    res.json({ accessToken, refreshToken, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

authRouter.post("/refresh", validar(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const payload = verificarToken(refreshToken);
    const tokenHash = hashSha256(refreshToken);

    const tokenDb = await prisma.tokenRefresh.findFirst({
      where: {
        usuarioId: payload.sub,
        tokenHash,
        revocado: false,
        expiraEn: { gt: new Date() }
      }
    });

    if (!tokenDb) {
      res.status(401).json({ message: "Refresh inválido" });
      return;
    }

    await prisma.tokenRefresh.update({ where: { id: tokenDb.id }, data: { revocado: true } });

    const nuevoPayload = { sub: payload.sub, rol: payload.rol, email: payload.email };
    const accessToken = crearAccessToken(nuevoPayload);
    const nuevoRefresh = crearRefreshToken(nuevoPayload);

    await prisma.tokenRefresh.create({
      data: {
        usuarioId: payload.sub,
        tokenHash: hashSha256(nuevoRefresh),
        expiraEn: new Date(Date.now() + env.refreshExpiresDays * 86400000)
      }
    });

    res.json({ accessToken, refreshToken: nuevoRefresh });
  } catch (err) {
    next(err);
  }
});

const logoutSchema = z.object({ refreshToken: z.string().min(20) });
authRouter.post("/logout", validar(logoutSchema), async (req, res, next) => {
  try {
    const tokenHash = hashSha256(req.body.refreshToken);
    await prisma.tokenRefresh.updateMany({ where: { tokenHash }, data: { revocado: true } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

const activar2FASchema = z.object({ usuarioId: z.string().min(3) });
authRouter.post("/2fa/activar", validar(activar2FASchema), async (req, res, next) => {
  try {
    const { authenticator } = await import("otplib");
    const secreto = authenticator.generateSecret();
    await prisma.usuario.update({ where: { id: req.body.usuarioId }, data: { dosFaSecreto: secreto, dosFaHabilitado: true } });
    res.json({ secreto, otpauth: authenticator.keyuri(req.body.usuarioId, "GMI", secreto) });
  } catch (err) {
    next(err);
  }
});

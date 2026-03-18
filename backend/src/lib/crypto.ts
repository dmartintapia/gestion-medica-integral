import crypto from "node:crypto";
import { env } from "../config/env.js";

const key = Buffer.from(env.encryptionKey, "utf-8");
if (key.length !== 32) {
  throw new Error("APP_ENCRYPTION_KEY debe tener 32 bytes para AES-256");
}

export function cifrarTexto(texto: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function descifrarTexto(payload: string): string {
  const [iv64, tag64, data64] = payload.split(":");
  const iv = Buffer.from(iv64, "base64");
  const tag = Buffer.from(tag64, "base64");
  const data = Buffer.from(data64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hashSha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
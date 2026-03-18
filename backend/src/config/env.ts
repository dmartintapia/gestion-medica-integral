import dotenv from "dotenv";

dotenv.config();

const required = [
  "PORT",
  "DATABASE_URL",
  "JWT_SECRET",
  "APP_ENCRYPTION_KEY"
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Falta variable de entorno: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  jwtSecret: process.env.JWT_SECRET!,
  accessExpiresMin: Number(process.env.JWT_ACCESS_EXPIRES_MIN || 15),
  refreshExpiresDays: Number(process.env.JWT_REFRESH_EXPIRES_DAYS || 7),
  corsAllowlist: (process.env.CORS_ALLOWLIST || "").split(",").filter(Boolean),
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  encryptionKey: process.env.APP_ENCRYPTION_KEY!
};

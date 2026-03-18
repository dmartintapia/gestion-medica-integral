import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middlewares/error.js";
import { requestIdMiddleware } from "./middlewares/request-id.js";
import { adminRouter } from "./modules/admin/routes.js";
import { authRouter } from "./modules/auth/routes.js";
import { historialRouter } from "./modules/historial/routes.js";
import { medicosRouter } from "./modules/medicos/routes.js";
import { notificacionesRouter } from "./modules/notificaciones/routes.js";
import { turnosRouter } from "./modules/turnos/routes.js";
import { usuariosRouter } from "./modules/usuarios/routes.js";

export const app = express();

app.use(requestIdMiddleware);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'"]
    }
  },
  hsts: env.nodeEnv === "production"
}));
app.use(cors({
  origin(origin, cb) {
    if (!origin || env.corsAllowlist.includes(origin)) {
      cb(null, true);
      return;
    }
    cb(new Error("Origen no permitido por CORS"));
  },
  credentials: true
}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("combined"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "gmi-backend", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/medicos", medicosRouter);
app.use("/api/turnos", turnosRouter);
app.use("/api/historial", historialRouter);
app.use("/api/notificaciones", notificacionesRouter);
app.use("/api/admin", adminRouter);

app.use(errorHandler);
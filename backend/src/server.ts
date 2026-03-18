import { app } from "./app.js";
import { env } from "./config/env.js";
import { iniciarSchedulerRecordatorios } from "./modules/notificaciones/routes.js";

app.listen(env.port, () => {
  console.log(`API GMI ejecutando en puerto ${env.port}`);
});

iniciarSchedulerRecordatorios();
# Guía de Despliegue Seguro

## 0. Plataforma recomendada

- GitHub como origen del monorepo
- Vercel para `frontend/`
- Render para `backend/` y PostgreSQL

### Vercel

- Root Directory: `frontend`
- Variable requerida: `VITE_API_URL=https://TU-BACKEND.onrender.com/api`

### Render

- Root Directory: `backend`
- Build Command: `npm install && npm run prisma:generate && npm run build`
- Pre-Deploy Command: `npm run prisma:deploy`
- Start Command: `npm start`
- Health Check Path: `/health`

### Variables manuales obligatorias en Render

- `JWT_PRIVATE_KEY`
- `JWT_PUBLIC_KEY`
- `CORS_ALLOWLIST`
- `APP_ENCRYPTION_KEY`
- `JWT_SECRET`

`REDIS_URL` hoy es opcional solo si no usas funcionalidades respaldadas por Redis en producción. Si vas a mantener cache/sesiones/colas, configura Render Key Value o un Redis externo.

## 1. Infraestructura

- Activar TLS 1.2+ en balanceador/reverse proxy
- Redireccionar HTTP a HTTPS
- Habilitar WAF y reglas anti-bot
- Segmentar red (DB y Redis en red privada)

## 2. Gestión de secretos

- Guardar claves en secret manager (no en archivos)
- Rotar `JWT_PRIVATE_KEY` cada 90 días
- Rotar `APP_ENCRYPTION_KEY` con estrategia de re-cifrado por versión

## 3. Hardening backend

- `NODE_ENV=production`
- CORS con dominios exactos
- Helmet con CSP estricta
- Rate limiting por IP y por usuario
- Logs estructurados sin datos sensibles

## 4. Datos y privacidad

- Cifrado en reposo (disco + campo)
- Backups diarios cifrados
- Prueba de restore semanal
- Política de retención 5 años y purga controlada

## 5. Operación

- Monitoreo (APM + métricas + alertas)
- SIEM para eventos de auditoría
- Playbook de incidentes de seguridad
- Escaneo SAST/SCA en CI

## 6. Integraciones externas

- Twilio WhatsApp con firma webhook verificada
- SendGrid/SES con dominio autenticado (SPF/DKIM/DMARC)
- Reintentos con cola y DLQ para notificaciones

## 7. Limitación actual de storage

- Los documentos previos se guardan hoy en disco local (`backend/uploads`)
- Para producción real, migrar a almacenamiento de objetos (`S3`, `R2` o equivalente)
- No asumir almacenamiento local efímero como persistente en servicios cloud

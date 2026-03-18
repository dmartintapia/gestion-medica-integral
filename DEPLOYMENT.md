# Guía de Despliegue Seguro

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
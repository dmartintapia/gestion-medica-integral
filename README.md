# Gestión Médica Integral

Plataforma médica con agendamiento, historial clínico, consultas híbridas y notificaciones multicanal, con enfoque en seguridad.

## Arquitectura

- Backend: Node.js + Express + TypeScript + Prisma
- Base de datos: PostgreSQL
- Cache/cola base: Redis
- Frontend: React + TypeScript + Tailwind
- Infra local: Docker Compose + Nginx

## Seguridad implementada

- JWT access/refresh (`15m` / `7d`) con rotación de refresh
- Contraseñas con `bcrypt` (12 rounds)
- Roles RBAC (`admin`, `medico`, `paciente`) + control ABAC en historial
- Validación de payloads con Zod
- Sanitización de inputs sensibles
- Cifrado AES-256-GCM para datos clínicos sensibles
- Helmet + CORS restringido + rate limiting
- Auditoría de accesos y acciones
- Soft delete disponible en usuarios (`deletedAt`)

## Requisitos

- Docker + Docker Compose

## Inicio rápido

1. Copiar variables:
```bash
cp backend/.env.example backend/.env
```

2. Levantar todo:
```bash
docker compose up --build
```

3. Acceso:
- Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- Nginx unificado: `http://localhost:8080`

## Usuarios de prueba

- Admin: `admin@gmi.local` / `Admin123*`
- Paciente: `juan.perez@gmi.local` / `Paciente123*`
- Médicos: password común `Medico123*`
  - `carolina.mendez@gmi.local`
  - `roberto.silva@gmi.local`
  - `laura.jimenez@gmi.local`

## Endpoints principales

- Auth: `/api/auth/registro`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- Paciente: `/api/turnos`, `/api/turnos/mis`, `/api/historial/mi`
- Médico: `/api/medicos/agenda`, `/api/historial/consulta`
- Admin: `/api/admin/usuarios`, `/api/admin/auditoria`, `/api/admin/reportes/uso`
- Notificaciones: `/api/notificaciones/webhook/whatsapp`

Colección Postman: `backend/postman/GMI.postman_collection.json`

## Notificaciones

En desarrollo se simulan por logs (`notificacion_simulada`).
Para producción:
- Reemplazar adaptador en `backend/src/modules/notificaciones/service.ts`
- Configurar Twilio WhatsApp y SendGrid/SES vía variables de entorno

## Producción segura (resumen)

Ver `DEPLOYMENT.md` para checklist completo.

## Checklist solicitado

### Backend
- [x] API REST documentada
- [x] JWT completa con roles
- [x] Validaciones de seguridad
- [x] Notificaciones simuladas
- [x] Auditoría básica

### Frontend
- [x] Flujo paciente login -> agendar -> ver turno -> historial
- [x] Panel médico agenda -> paciente -> editar historial
- [x] Diseño responsive base
- [x] Estados de error/carga básicos

### General
- [x] README instalación paso a paso
- [x] Docker Compose
- [x] Colección Postman
- [x] Guía de despliegue seguro
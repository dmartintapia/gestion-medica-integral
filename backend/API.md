# API REST - Gestión Médica Integral

## Auth

### POST /api/auth/registro
Request:
```json
{
  "nombre": "Ana Lopez",
  "email": "ana@example.com",
  "password": "Secret123*",
  "rol": "paciente"
}
```

### POST /api/auth/login
```json
{
  "email": "juan.perez@gmi.local",
  "password": "Paciente123*",
  "token2fa": "123456"
}
```

### POST /api/auth/refresh
```json
{ "refreshToken": "..." }
```

### POST /api/auth/logout
```json
{ "refreshToken": "..." }
```

## Turnos

### POST /api/turnos (paciente)
```json
{
  "medicoId": "cuid",
  "inicio": "2026-03-20T13:00:00.000Z",
  "modalidad": "presencial",
  "motivo": "Control",
  "timezone": "America/Argentina/Buenos_Aires"
}
```

### GET /api/turnos/mis (paciente)

### PATCH /api/turnos/:id/cancelar

### PATCH /api/turnos/:id/reprogramar

## Historial

### GET /api/historial/mi (paciente)

### GET /api/historial/paciente/:pacienteId (médico asignado)

### POST /api/historial/consulta (médico)

## Médicos

### GET /api/medicos

### GET /api/medicos/agenda (médico)

## Admin

### GET /api/admin/usuarios

### PATCH /api/admin/usuarios/:id/estado

### GET /api/admin/auditoria

### GET /api/admin/reportes/uso

## Notificaciones

### POST /api/notificaciones/config (admin)

### POST /api/notificaciones/webhook/whatsapp
```json
{ "telefono": "+5491112345678", "texto": "CONFIRMAR" }
```
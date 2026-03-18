import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { cifrarTexto } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

const pacientesDemo = [
  {
    nombre: "Maria Lopez",
    email: "maria.lopez.demo@gmi.local",
    telefono: "+5491111100001",
    fechaNacimiento: new Date("1988-04-12T00:00:00.000Z"),
    sexo: "F",
    grupoSanguineo: "A+",
    alergias: "Sin alergias conocidas",
    cronicas: "Hipertension arterial",
    medicacionHabitual: "Losartan 50 mg diarios",
    emergencia: "Carlos Lopez - +5491111109001"
  },
  {
    nombre: "Pedro Alvarez",
    email: "pedro.alvarez.demo@gmi.local",
    telefono: "+5491111100002",
    fechaNacimiento: new Date("1979-09-03T00:00:00.000Z"),
    sexo: "M",
    grupoSanguineo: "O+",
    alergias: "Alergia a penicilina",
    cronicas: "Diabetes tipo 2",
    medicacionHabitual: "Metformina 850 mg cada 12 horas",
    emergencia: "Lucia Alvarez - +5491111109002"
  },
  {
    nombre: "Sofia Ramirez",
    email: "sofia.ramirez.demo@gmi.local",
    telefono: "+5491111100003",
    fechaNacimiento: new Date("1994-01-21T00:00:00.000Z"),
    sexo: "F",
    grupoSanguineo: "B-",
    alergias: "Sin alergias conocidas",
    cronicas: "Sin antecedentes relevantes",
    medicacionHabitual: "Ninguna",
    emergencia: "Jorge Ramirez - +5491111109003"
  },
  {
    nombre: "Diego Fernandez",
    email: "diego.fernandez.demo@gmi.local",
    telefono: "+5491111100004",
    fechaNacimiento: new Date("1968-11-08T00:00:00.000Z"),
    sexo: "M",
    grupoSanguineo: "AB+",
    alergias: "Alergia a ibuprofeno",
    cronicas: "Dislipidemia",
    medicacionHabitual: "Atorvastatina 20 mg nocturna",
    emergencia: "Ana Fernandez - +5491111109004"
  },
  {
    nombre: "Valentina Castro",
    email: "valentina.castro.demo@gmi.local",
    telefono: "+5491111100005",
    fechaNacimiento: new Date("2000-06-17T00:00:00.000Z"),
    sexo: "F",
    grupoSanguineo: "O-",
    alergias: "Sin alergias conocidas",
    cronicas: "Ansiedad en seguimiento",
    medicacionHabitual: "Sertralina 50 mg diarios",
    emergencia: "Elena Castro - +5491111109005"
  }
];

function crearInicio(base: Date, dias: number, hora: number, minutos: number) {
  const fecha = new Date(base);
  fecha.setDate(base.getDate() + dias);
  fecha.setHours(hora, minutos, 0, 0);
  return fecha;
}

async function main() {
  const medico = await prisma.medico.findFirst({
    where: { usuario: { email: "carolina.mendez@gmi.local" } },
    include: { usuario: true }
  });

  if (!medico) {
    throw new Error("No se encontró a la Dra. Carolina Méndez.");
  }

  const passwordHash = await bcrypt.hash("Paciente123*", env.bcryptRounds);

  const pacientes = [];
  for (const data of pacientesDemo) {
    const usuario = await prisma.usuario.upsert({
      where: { email: data.email },
      update: {
        nombre: data.nombre,
        telefono: data.telefono,
        passwordHash,
        rol: "paciente",
        activo: true
      },
      create: {
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        passwordHash,
        rol: "paciente",
        activo: true
      }
    });

    const paciente = await prisma.paciente.upsert({
      where: { usuarioId: usuario.id },
      update: {
        fechaNacimiento: data.fechaNacimiento,
        sexo: data.sexo,
        grupoSanguineo: data.grupoSanguineo,
        alergiasEnc: cifrarTexto(data.alergias),
        cronicasEnc: cifrarTexto(data.cronicas),
        medicacionHabitualEnc: cifrarTexto(data.medicacionHabitual),
        emergenciaEnc: cifrarTexto(data.emergencia)
      },
      create: {
        usuarioId: usuario.id,
        fechaNacimiento: data.fechaNacimiento,
        sexo: data.sexo,
        grupoSanguineo: data.grupoSanguineo,
        alergiasEnc: cifrarTexto(data.alergias),
        cronicasEnc: cifrarTexto(data.cronicas),
        medicacionHabitualEnc: cifrarTexto(data.medicacionHabitual),
        emergenciaEnc: cifrarTexto(data.emergencia)
      }
    });

    pacientes.push(paciente);
  }

  const ahora = new Date();
  const plantillasTurno = [
    { dias: 1, hora: 9, minutos: 0, modalidad: "presencial", estado: "confirmado", motivo: "Control cardiológico anual" },
    { dias: 1, hora: 10, minutos: 0, modalidad: "online", estado: "pendiente", motivo: "Revisión de presión arterial" },
    { dias: 2, hora: 11, minutos: 0, modalidad: "presencial", estado: "confirmado", motivo: "Seguimiento de medicación" },
    { dias: 2, hora: 12, minutos: 0, modalidad: "online", estado: "confirmado", motivo: "Chequeo post estudios" },
    { dias: 3, hora: 9, minutos: 30, modalidad: "presencial", estado: "completado", motivo: "Dolor torácico en estudio" },
    { dias: 3, hora: 10, minutos: 30, modalidad: "online", estado: "pendiente", motivo: "Consulta inicial por palpitaciones" },
    { dias: 4, hora: 14, minutos: 0, modalidad: "presencial", estado: "confirmado", motivo: "Ajuste de tratamiento" },
    { dias: 4, hora: 15, minutos: 0, modalidad: "online", estado: "confirmado", motivo: "Control de colesterol" },
    { dias: 5, hora: 16, minutos: 0, modalidad: "presencial", estado: "pendiente", motivo: "Lectura de resultados de laboratorio" },
    { dias: 6, hora: 9, minutos: 0, modalidad: "online", estado: "confirmado", motivo: "Seguimiento de hipertensión" }
  ] as const;

  for (let i = 0; i < plantillasTurno.length; i += 1) {
    const plantilla = plantillasTurno[i];
    const inicio = crearInicio(ahora, plantilla.dias, plantilla.hora, plantilla.minutos);
    const fin = new Date(inicio.getTime() + 30 * 60 * 1000);
    const paciente = pacientes[i % pacientes.length];

    await prisma.turno.upsert({
      where: { id: `turno-carolina-demo-${i + 1}` },
      update: {
        pacienteId: paciente.id,
        medicoId: medico.id,
        inicio,
        fin,
        modalidad: plantilla.modalidad,
        estado: plantilla.estado,
        motivo: plantilla.motivo,
        meetingLink:
          plantilla.modalidad === "online"
            ? `https://meet.jit.si/gmi-carolina-demo-${i + 1}`
            : null,
        timezone: "America/Argentina/Buenos_Aires"
      },
      create: {
        id: `turno-carolina-demo-${i + 1}`,
        pacienteId: paciente.id,
        medicoId: medico.id,
        inicio,
        fin,
        modalidad: plantilla.modalidad,
        estado: plantilla.estado,
        motivo: plantilla.motivo,
        meetingLink:
          plantilla.modalidad === "online"
            ? `https://meet.jit.si/gmi-carolina-demo-${i + 1}`
            : null,
        timezone: "America/Argentina/Buenos_Aires"
      }
    });
  }

  console.log("Seed demo de Carolina completado: 5 pacientes y 10 turnos.");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

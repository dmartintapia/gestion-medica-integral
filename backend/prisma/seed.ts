import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { env } from "../src/config/env.js";
import { cifrarTexto } from "../src/lib/crypto.js";

const prisma = new PrismaClient();

async function upsertMedico(data: {
  nombre: string;
  email: string;
  cmp: string;
  especialidad: string;
}) {
  const esp = await prisma.especialidad.upsert({
    where: { nombre: data.especialidad },
    update: {},
    create: { nombre: data.especialidad }
  });

  const passwordHash = await bcrypt.hash("Medico123*", env.bcryptRounds);
  const user = await prisma.usuario.upsert({
    where: { email: data.email },
    update: { nombre: data.nombre, passwordHash, rol: "medico" },
    create: {
      nombre: data.nombre,
      email: data.email,
      telefono: "+5491100000000",
      passwordHash,
      rol: "medico"
    }
  });

  const medico = await prisma.medico.upsert({
    where: { usuarioId: user.id },
    update: { cmp: data.cmp, especialidadId: esp.id },
    create: {
      usuarioId: user.id,
      especialidadId: esp.id,
      cmp: data.cmp,
      consultorio: "Av. Salud 123"
    }
  });

  await prisma.disponibilidad.createMany({
    data: [
      { medicoId: medico.id, diaSemana: 1, horaInicio: "09:00", horaFin: "13:00" },
      { medicoId: medico.id, diaSemana: 3, horaInicio: "14:00", horaFin: "18:00" }
    ],
    skipDuplicates: true
  });

  return medico;
}

async function main() {
  const adminHash = await bcrypt.hash("Admin123*", env.bcryptRounds);
  await prisma.usuario.upsert({
    where: { email: "admin@gmi.local" },
    update: {
      nombre: "Administrador",
      passwordHash: adminHash,
      rol: "admin",
      activo: true,
      dosFaHabilitado: false,
      dosFaSecreto: null
    },
    create: {
      nombre: "Administrador",
      email: "admin@gmi.local",
      passwordHash: adminHash,
      rol: "admin"
    }
  });

  const medico1 = await upsertMedico({ nombre: "Dra. Carolina Mendez", email: "carolina.mendez@gmi.local", cmp: "45231", especialidad: "Cardiologia" });
  await upsertMedico({ nombre: "Dr. Roberto Silva", email: "roberto.silva@gmi.local", cmp: "38921", especialidad: "Medicina General" });
  await upsertMedico({ nombre: "Dra. Laura Jimenez", email: "laura.jimenez@gmi.local", cmp: "51234", especialidad: "Psicologia" });

  const pacienteHash = await bcrypt.hash("Paciente123*", env.bcryptRounds);
  const usuarioPaciente = await prisma.usuario.upsert({
    where: { email: "juan.perez@gmi.local" },
    update: {
      nombre: "Juan Perez Garcia",
      telefono: "+5491112345678",
      passwordHash: pacienteHash,
      rol: "paciente",
      activo: true,
      dosFaHabilitado: false,
      dosFaSecreto: null
    },
    create: {
      nombre: "Juan Perez Garcia",
      email: "juan.perez@gmi.local",
      telefono: "+5491112345678",
      passwordHash: pacienteHash,
      rol: "paciente"
    }
  });

  const paciente = await prisma.paciente.upsert({
    where: { usuarioId: usuarioPaciente.id },
    update: {},
    create: {
      usuarioId: usuarioPaciente.id,
      grupoSanguineo: "O+",
      alergiasEnc: cifrarTexto("Alergia a penicilina")
    }
  });

  const inicio = new Date(Date.now() + 2 * 86400000);
  inicio.setHours(10, 0, 0, 0);
  const fin = new Date(inicio.getTime() + 30 * 60000);

  await prisma.turno.upsert({
    where: { id: "turno-seed-1" },
    update: {},
    create: {
      id: "turno-seed-1",
      pacienteId: paciente.id,
      medicoId: medico1.id,
      inicio,
      fin,
      modalidad: "presencial",
      estado: "confirmado",
      motivo: "Control anual"
    }
  });

  console.log("Seed completado");
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

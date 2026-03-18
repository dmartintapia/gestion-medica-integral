import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";

type DocumentoPrevio = {
  id: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  createdAt: string;
};

type TurnoAgenda = {
  id: string;
  inicio: string;
  modalidad: "presencial" | "online";
  estado: string;
  motivo: string;
  consulta: { id: string; fecha: string } | null;
  documentosPrevios: DocumentoPrevio[];
  paciente: {
    id: string;
    fechaNacimiento: string | null;
    edad: number | null;
    sexo: string | null;
    grupoSanguineo: string | null;
    alergias: string | null;
    cronicas: string | null;
    medicacionHabitual: string | null;
    contactoEmergencia: string | null;
    usuario: { nombre: string; email: string; telefono: string | null };
  };
};

type ConsultaPaciente = {
  id: string;
  fecha: string;
  motivo: string;
  diagnostico: string | null;
  notas: string | null;
  indicaciones: string | null;
  recetas: Array<{ id: string; medicamento: string; dosis: string; duracion: string }>;
  turno: { modalidad: "presencial" | "online"; createdAt?: string };
};

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function etiquetaEstado(estado: string) {
  return {
    confirmado: "bg-emerald-100 text-emerald-700",
    pendiente: "bg-amber-100 text-amber-700",
    completado: "bg-cyan-100 text-cyan-700",
    cancelado: "bg-rose-100 text-rose-700",
    en_curso: "bg-violet-100 text-violet-700"
  }[estado] || "bg-slate-100 text-slate-700";
}

function resumenTexto(valor: string | null | undefined, fallback = "Sin dato cargado") {
  return valor?.trim() ? valor : fallback;
}

export function MedicoPage() {
  const logout = useAuthStore((s) => s.logout);
  const [agenda, setAgenda] = useState<TurnoAgenda[]>([]);
  const [historialPaciente, setHistorialPaciente] = useState<ConsultaPaciente[]>([]);
  const [turnoId, setTurnoId] = useState("");
  const [diaSeleccionado, setDiaSeleccionado] = useState("");
  const [diagnostico, setDiagnostico] = useState("Paciente estable");
  const [notas, setNotas] = useState("Evolución favorable. Continuar seguimiento.");
  const [cargandoHistorial, setCargandoHistorial] = useState(false);

  const cargarAgenda = async () => {
    const desde = new Date().toISOString();
    const hasta = new Date(Date.now() + 7 * 86400000).toISOString();
    const { data } = await api.get(`/medicos/agenda?desde=${encodeURIComponent(desde)}&hasta=${encodeURIComponent(hasta)}`);
    setAgenda(data);

    if (data.length) {
      const diaInicial = new Date(data[0].inicio).toDateString();
      setDiaSeleccionado((actual) => actual || diaInicial);
      setTurnoId((actual) => actual || data[0].id);
    }
  };

  const turnoSeleccionado = useMemo(
    () => agenda.find((turno) => turno.id === turnoId) ?? null,
    [agenda, turnoId]
  );

  const diasAgenda = useMemo(() => {
    const mapa = new Map<string, { clave: string; fecha: Date; total: number; pendientes: number }>();
    for (const turno of agenda) {
      const fecha = new Date(turno.inicio);
      const clave = fecha.toDateString();
      const item = mapa.get(clave);
      if (item) {
        item.total += 1;
        if (turno.estado !== "completado" && turno.estado !== "cancelado") item.pendientes += 1;
      } else {
        mapa.set(clave, {
          clave,
          fecha,
          total: 1,
          pendientes: turno.estado !== "completado" && turno.estado !== "cancelado" ? 1 : 0
        });
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [agenda]);

  const agendaDia = useMemo(() => {
    const diaActivo = diaSeleccionado || diasAgenda[0]?.clave;
    return agenda.filter((turno) => new Date(turno.inicio).toDateString() === diaActivo);
  }, [agenda, diaSeleccionado, diasAgenda]);

  useEffect(() => {
    cargarAgenda();
  }, []);

  useEffect(() => {
    if (!agendaDia.length) return;
    if (!agendaDia.some((turno) => turno.id === turnoId)) {
      setTurnoId(agendaDia[0].id);
    }
  }, [agendaDia, turnoId]);

  useEffect(() => {
    const pacienteId = turnoSeleccionado?.paciente.id;
    if (!pacienteId) {
      setHistorialPaciente([]);
      return;
    }

    setCargandoHistorial(true);
    api
      .get(`/historial/paciente/${pacienteId}`)
      .then(({ data }) => setHistorialPaciente(data))
      .finally(() => setCargandoHistorial(false));
  }, [turnoSeleccionado?.paciente.id]);

  const descargarDocumento = async (doc: DocumentoPrevio) => {
    const response = await api.get(`/turnos/documentos/${doc.id}/descargar`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: doc.mimeType }));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", doc.nombreArchivo);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-marca">Panel Médico</h1>
          <p className="mt-1 text-sm text-slate-500">Agenda clínica, contexto del paciente e historial en una sola vista.</p>
        </div>
        <button
          className="btn-lift inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.45)] hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
          onClick={() => logout()}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]">
            <path d="M10 17l-5-5 5-5" />
            <path d="M5 12h10" />
            <path d="M15 5h3a1 1 0 011 1v12a1 1 0 01-1 1h-3" />
          </svg>
          Salir
        </button>
      </header>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.3fr]">
        <section className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Agenda semanal</h2>
              <p className="mt-1 text-sm text-slate-500">Navega por día y prioriza lo pendiente.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {agenda.length} turnos en 7 días
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {diasAgenda.map((dia) => (
              <button
                key={dia.clave}
                type="button"
                className={[
                  "btn-lift min-w-[132px] rounded-2xl border px-3 py-3 text-left transition",
                  diaSeleccionado === dia.clave
                    ? "border-cyan-700 bg-cyan-50"
                    : "border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white"
                ].join(" ")}
                onClick={() => setDiaSeleccionado(dia.clave)}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {dia.fecha.toLocaleDateString("es-AR", { weekday: "short" })}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {dia.fecha.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}
                </p>
                <p className="mt-2 text-xs text-slate-500">{dia.total} turnos</p>
                <p className="text-xs text-cyan-700">{dia.pendientes} activos</p>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {agendaDia.map((turno) => (
              <button
                key={turno.id}
                type="button"
                className={[
                  "btn-lift w-full rounded-[24px] border p-4 text-left shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] transition",
                  turnoId === turno.id
                    ? "border-cyan-700 bg-cyan-50/80"
                    : "border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] hover:border-slate-300"
                ].join(" ")}
                onClick={() => setTurnoId(turno.id)}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-slate-900">{turno.paciente.usuario.nombre}</p>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${etiquetaEstado(turno.estado)}`}>
                        {turno.estado}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {turno.paciente.edad ? `${turno.paciente.edad} años` : "Edad no registrada"} · {turno.modalidad}
                    </p>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-base font-semibold text-slate-900">
                      {new Date(turno.inicio).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {new Date(turno.inicio).toLocaleDateString("es-AR", { day: "2-digit", month: "long" })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-[1.3fr_0.7fr]">
                  <p>
                    <span className="font-medium text-slate-900">Motivo:</span> {turno.motivo}
                  </p>
                  <p className="md:text-right">
                    <span className="font-medium text-slate-900">Documentos:</span> {turno.documentosPrevios.length}
                  </p>
                </div>
              </button>
            ))}

            {!agendaDia.length ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No hay turnos para el día seleccionado.
              </div>
            ) : null}
          </div>
        </section>

        <div className="space-y-4">
          {turnoSeleccionado ? (
            <>
              <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900">{turnoSeleccionado.paciente.usuario.nombre}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${etiquetaEstado(turnoSeleccionado.estado)}`}>
                        {turnoSeleccionado.estado}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {new Date(turnoSeleccionado.inicio).toLocaleDateString("es-AR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "long"
                      })}{" "}
                      ·{" "}
                      {new Date(turnoSeleccionado.inicio).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Modalidad</p>
                      <p className="mt-1 font-semibold capitalize text-slate-900">{turnoSeleccionado.modalidad}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-2">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Motivo</p>
                      <p className="mt-1 font-semibold text-slate-900">{turnoSeleccionado.motivo}</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Edad</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {turnoSeleccionado.paciente.edad ? `${turnoSeleccionado.paciente.edad} años` : "Sin dato"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Grupo sanguíneo</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {turnoSeleccionado.paciente.grupoSanguineo || "Sin dato"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Contacto</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {turnoSeleccionado.paciente.usuario.telefono || turnoSeleccionado.paciente.usuario.email}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-slate-200 bg-slate-50/70 p-4">
                    <p className="text-xs uppercase tracking-[0.14em] text-slate-400">Obra social</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">Sin dato cargado</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-rose-200/70 bg-rose-50/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">Alergias y riesgos</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{resumenTexto(turnoSeleccionado.paciente.alergias)}</p>
                  </div>
                  <div className="rounded-[24px] border border-amber-200/70 bg-amber-50/70 p-4">
                    <p className="text-sm font-semibold text-slate-900">Condiciones y medicación habitual</p>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      {resumenTexto(turnoSeleccionado.paciente.cronicas, "Sin condiciones crónicas cargadas")}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-medium text-slate-900">Medicación:</span>{" "}
                      {resumenTexto(turnoSeleccionado.paciente.medicacionHabitual)}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-cyan-200/70 bg-cyan-50/50 p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Documentos previos del paciente</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Material clínico cargado antes de la consulta.
                    </p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-cyan-800">
                    {turnoSeleccionado.documentosPrevios.length} archivo(s)
                  </div>
                </div>

                {turnoSeleccionado.documentosPrevios.length ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {turnoSeleccionado.documentosPrevios.map((doc) => (
                      <article key={doc.id} className="rounded-[22px] border border-white/80 bg-white p-4 shadow-[0_14px_36px_-34px_rgba(15,23,42,0.55)]">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{doc.nombreArchivo}</p>
                            <p className="mt-1 text-xs text-slate-500">
                              {doc.mimeType} · {formatearTamano(doc.tamanoBytes)}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              Subido el {new Date(doc.createdAt).toLocaleString("es-AR")}
                            </p>
                          </div>
                          <button
                            className="btn-lift rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700"
                            onClick={() => descargarDocumento(doc)}
                          >
                            Descargar
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[24px] border border-dashed border-cyan-300 bg-white/80 px-4 py-6">
                    <p className="text-sm font-semibold text-slate-900">Todavía no hay archivos adjuntos</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Si el paciente suma análisis o estudios, aparecerán aquí para revisión previa.
                    </p>
                  </div>
                )}
              </section>

              <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
                <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Cargar evolución</h2>
                    <p className="mt-1 text-sm text-slate-500">Selecciona el turno y documenta la consulta en formato clínico.</p>
                  </div>
                  <select
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 md:max-w-md"
                    value={turnoId}
                    onChange={(e) => setTurnoId(e.target.value)}
                  >
                    {agenda.map((turno) => (
                      <option key={turno.id} value={turno.id}>
                        {new Date(turno.inicio).toLocaleString("es-AR")} - {turno.paciente.usuario.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-1.5 block text-[13px] text-slate-500">Diagnóstico / impresión clínica</label>
                    <input
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700"
                      value={diagnostico}
                      onChange={(e) => setDiagnostico(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[13px] text-slate-500">Notas de evolución</label>
                    <textarea
                      rows={6}
                      className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700"
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Describe hallazgos, conducta, respuesta al tratamiento y próximos pasos."
                    />
                  </div>
                </div>

                <button
                  className="btn-lift mt-4 rounded-2xl bg-marca px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_-22px_rgba(8,145,178,0.85)] hover:bg-cyan-800"
                  onClick={async () => {
                    await api.post("/historial/consulta", {
                      turnoId,
                      motivo: turnoSeleccionado.motivo,
                      diagnostico,
                      notas,
                      indicaciones: "Control en 30 dias",
                      recetas: [{ medicamento: "Paracetamol", dosis: "500mg", duracion: "5 dias" }]
                    });
                    await cargarAgenda();
                  }}
                >
                  Guardar consulta
                </button>
              </section>

              <section className="rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Historia clínica del paciente</h2>
                    <p className="mt-1 text-sm text-slate-500">Consultas previas, diagnósticos y tratamientos registrados.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    {historialPaciente.length} registro(s)
                  </div>
                </div>

                {cargandoHistorial ? (
                  <p className="mt-4 text-sm text-slate-500">Cargando historial...</p>
                ) : historialPaciente.length ? (
                  <div className="mt-4 space-y-3">
                    {historialPaciente.map((consulta) => (
                      <article key={consulta.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {new Date(consulta.fecha).toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "long",
                                year: "numeric"
                              })}
                            </p>
                            <p className="mt-1 text-sm text-slate-600">{consulta.motivo}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">
                            {consulta.turno.modalidad}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2 text-sm text-slate-700">
                          <p><span className="font-medium text-slate-900">Diagnóstico:</span> {consulta.diagnostico || "Sin registrar"}</p>
                          <p><span className="font-medium text-slate-900">Notas:</span> {consulta.notas || "Sin notas adicionales"}</p>
                          <p><span className="font-medium text-slate-900">Indicaciones:</span> {consulta.indicaciones || "Sin indicaciones cargadas"}</p>
                          {consulta.recetas.length ? (
                            <p>
                              <span className="font-medium text-slate-900">Recetas:</span>{" "}
                              {consulta.recetas.map((receta) => `${receta.medicamento} ${receta.dosis} (${receta.duracion})`).join(", ")}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    Este paciente todavía no tiene consultas registradas en el historial.
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
              No hay turnos asignados en la ventana actual.
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

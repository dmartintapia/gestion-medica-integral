import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { UploadDropzone } from "../components/UploadDropzone";
import type { ArchivoSubido } from "../components/UploadDropzone";
import { useAuthStore } from "../store/auth";

type Medico = { id: string; nombre: string; especialidad: string; cmp: string; consultorio: string | null };

type Turno = {
  id: string;
  inicio: string;
  modalidad: "presencial" | "online";
  estado: string;
  motivo: string;
  meetingLink?: string | null;
  documentosPrevios: ArchivoSubido[];
  medico: { usuario: { nombre: string }; especialidad: { nombre: string } };
};

export function PacientePage() {
  const logout = useAuthStore((s) => s.logout);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [historial, setHistorial] = useState<any[]>([]);
  const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState("todas");
  const [medicoId, setMedicoId] = useState("");
  const [inicio, setInicio] = useState("");
  const [modalidad, setModalidad] = useState<"presencial" | "online">("presencial");
  const [motivo, setMotivo] = useState("");
  const [pasoAgenda, setPasoAgenda] = useState(1);

  const cargar = async () => {
    const [m, t, h] = await Promise.all([api.get("/medicos"), api.get("/turnos/mis"), api.get("/historial/mi")]);
    setMedicos(m.data);
    setTurnos(t.data);
    setHistorial(h.data);
  };

  useEffect(() => {
    cargar();
  }, []);

  const especialidades = useMemo(() => Array.from(new Set(medicos.map((m) => m.especialidad))).sort(), [medicos]);

  const medicosFiltrados = useMemo(() => {
    if (especialidadSeleccionada === "todas") return medicos;
    return medicos.filter((m) => m.especialidad === especialidadSeleccionada);
  }, [medicos, especialidadSeleccionada]);

  useEffect(() => {
    if (!medicosFiltrados.length) {
      setMedicoId("");
      return;
    }
    const existe = medicosFiltrados.some((m) => m.id === medicoId);
    if (!existe) {
      setMedicoId(medicosFiltrados[0].id);
    }
  }, [medicosFiltrados, medicoId]);

  const pasos = [
    { numero: 1, titulo: "Especialidad" },
    { numero: 2, titulo: "Fecha y tipo" },
    { numero: 3, titulo: "Confirmar" }
  ];

  const puedeAvanzarPaso1 = Boolean(medicoId);
  const puedeAvanzarPaso2 = Boolean(inicio && modalidad);
  const puedeConfirmar = Boolean(medicoId && inicio && motivo.trim());
  const medicoSeleccionado = medicos.find((m) => m.id === medicoId);

  return (
    <main className="p-4 max-w-6xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-marca">Panel Paciente</h1>
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

      <section className="bg-white p-4 rounded shadow">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Agendar turno</h2>
            <p className="mt-1 text-sm text-slate-500">Completa el proceso paso a paso para reservar tu consulta.</p>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-8 flex w-full items-center">
            {pasos.map((paso, index) => (
              <div key={paso.numero} className="flex flex-1 items-center">
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={() => setPasoAgenda(paso.numero)}
                >
                  <span
                    className={[
                      "flex h-7 w-7 items-center justify-center rounded-full border text-[12px] font-medium transition",
                      pasoAgenda === paso.numero && "border-emerald-600 bg-emerald-600 text-white",
                      pasoAgenda > paso.numero && "border-emerald-300 bg-emerald-200 text-emerald-900",
                      pasoAgenda < paso.numero && "border-slate-300 bg-white text-slate-500"
                    ].filter(Boolean).join(" ")}
                  >
                    {pasoAgenda > paso.numero ? "✓" : paso.numero}
                  </span>
                  <span
                    className={[
                      "text-[13px]",
                      pasoAgenda === paso.numero ? "font-medium text-emerald-800" : "text-slate-500"
                    ].join(" ")}
                  >
                    {paso.titulo}
                  </span>
                </button>
                {index < pasos.length - 1 ? (
                  <div className="mx-2 h-px flex-1 bg-slate-200">
                    <div
                      className={`h-px ${pasoAgenda > paso.numero ? "bg-emerald-400" : "bg-slate-200"}`}
                    />
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
          {pasoAgenda === 1 ? (
            <div className="space-y-4">
              <div>
                <p className="text-[15px] font-medium text-slate-900">¿Con qué especialista querés atenderte?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] text-slate-500">Especialidad</label>
                  <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700" value={especialidadSeleccionada} onChange={(e) => setEspecialidadSeleccionada(e.target.value)}>
                    <option value="todas">Todas las especialidades</option>
                    {especialidades.map((esp) => (
                      <option key={esp} value={esp}>{esp}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] text-slate-500">Médico/a</label>
                  <select className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700" value={medicoId} onChange={(e) => setMedicoId(e.target.value)} disabled={!medicosFiltrados.length}>
                    {medicosFiltrados.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre} - {m.especialidad}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] text-slate-500">Motivo de consulta</label>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 placeholder:text-slate-400"
                    value={motivo}
                    placeholder="Ej. control anual, dolor lumbar, consulta inicial"
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-lift rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!puedeAvanzarPaso1}
                  onClick={() => setPasoAgenda(2)}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          ) : null}

          {pasoAgenda === 2 ? (
            <div className="space-y-4">
              <div>
                <p className="text-[15px] font-medium text-slate-900">¿Cuándo y cómo preferís la consulta?</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-[13px] text-slate-500">Fecha y hora</label>
                  <input type="datetime-local" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] text-slate-500">Modalidad</label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      className={[
                        "btn-lift rounded-2xl border px-4 py-4 text-center transition",
                        modalidad === "presencial"
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      ].join(" ")}
                      onClick={() => setModalidad("presencial")}
                    >
                      <div className="mb-1 text-lg">🏥</div>
                      <div className={modalidad === "presencial" ? "text-[13px] font-medium text-emerald-800" : "text-[13px] text-slate-500"}>Presencial</div>
                    </button>

                    <button
                      type="button"
                      className={[
                        "btn-lift rounded-2xl border px-4 py-4 text-center transition",
                        modalidad === "online"
                          ? "border-emerald-600 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      ].join(" ")}
                      onClick={() => setModalidad("online")}
                    >
                      <div className="mb-1 text-lg">💻</div>
                      <div className={modalidad === "online" ? "text-[13px] font-medium text-emerald-800" : "text-[13px] text-slate-500"}>Online</div>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-lift rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setPasoAgenda(1)}>
                  ← Volver
                </button>
                <button
                  type="button"
                  className="btn-lift rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!puedeAvanzarPaso2}
                  onClick={() => setPasoAgenda(3)}
                >
                  Siguiente →
                </button>
              </div>
            </div>
          ) : null}

          {pasoAgenda === 3 ? (
            <div className="space-y-4">
              <div>
                <p className="text-[15px] font-medium text-slate-900">Revisá tu turno antes de confirmar</p>
              </div>

              <div className="rounded-[22px] border border-slate-200 bg-white px-4">
                <div className="flex items-center justify-between border-b border-slate-200 py-3 text-sm">
                  <span className="text-slate-500">Médico/a</span>
                  <span className="text-right font-medium text-slate-900">{medicoSeleccionado ? `${medicoSeleccionado.nombre} - ${medicoSeleccionado.especialidad}` : "—"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 py-3 text-sm">
                  <span className="text-slate-500">Fecha y hora</span>
                  <span className="font-medium text-slate-900">{inicio ? new Date(inicio).toLocaleString() : "—"}</span>
                </div>
                <div className="flex items-center justify-between border-b border-slate-200 py-3 text-sm">
                  <span className="text-slate-500">Modalidad</span>
                  <span className="font-medium capitalize text-slate-900">{modalidad}</span>
                </div>
                <div className="flex items-center justify-between py-3 text-sm">
                  <span className="text-slate-500">Motivo</span>
                  <span className="max-w-[60%] text-right font-medium text-slate-900">{motivo.trim() || "—"}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="btn-lift rounded-2xl border border-slate-200 bg-white px-6 py-2.5 text-sm text-slate-600 hover:bg-slate-50" onClick={() => setPasoAgenda(2)}>
                  ← Volver
                </button>
                <button
                  className="btn-lift rounded-2xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  disabled={!puedeConfirmar}
                  onClick={async () => {
                    const iso = new Date(inicio).toISOString();
                    await api.post("/turnos", { medicoId, inicio: iso, modalidad, motivo, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
                    setMotivo("");
                    setInicio("");
                    setModalidad("presencial");
                    setPasoAgenda(1);
                    await cargar();
                  }}
                >
                  Confirmar turno
                </button>
              </div>
            </div>
          ) : null}
        </div>
        </div>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Mis turnos</h2>
        <ul className="mt-3 space-y-3">
          {turnos.map((t) => (
            <li key={t.id} className="space-y-4 rounded-[28px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.45)]">
              <div className="flex flex-col justify-between gap-4 md:flex-row">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{t.medico.usuario.nombre}</p>
                  <p className="mt-1 text-sm font-medium text-slate-500">{t.medico.especialidad.nombre}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="font-medium text-slate-900">{new Date(t.inicio).toLocaleDateString()}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="font-medium text-slate-900">{new Date(t.inicio).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="capitalize">{t.modalidad}</span>
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                        t.estado === "confirmado" && "bg-emerald-100 text-emerald-700",
                        t.estado === "pendiente" && "bg-amber-100 text-amber-700",
                        t.estado === "cancelado" && "bg-rose-100 text-rose-700",
                        t.estado !== "confirmado" && t.estado !== "pendiente" && t.estado !== "cancelado" && "bg-slate-100 text-slate-600"
                      ].filter(Boolean).join(" ")}
                    >
                      {t.estado}
                    </span>
                  </div>
                  <p className="mt-3 max-w-2xl text-sm text-slate-600">
                    <span className="font-medium text-slate-900">Motivo:</span> {t.motivo}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {t.meetingLink ? (
                    <a
                      className="btn-lift inline-flex items-center gap-2 rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white shadow-[0_16px_30px_-18px_rgba(8,145,178,0.9)] hover:bg-cyan-800"
                      href={t.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]">
                        <rect x="3" y="7" width="12" height="10" rx="2" />
                        <path d="M15 10l5-3v10l-5-3" />
                      </svg>
                      Unirse online
                    </a>
                  ) : null}

                  <button
                    className="btn-lift inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_16px_30px_-22px_rgba(15,23,42,0.35)] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    onClick={async () => {
                      await api.patch(`/turnos/${t.id}/cancelar`, { motivoCancelacion: "Paciente no podrá asistir" });
                      await cargar();
                    }}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]">
                      <path d="M6 6l12 12" />
                      <path d="M18 6L6 18" />
                    </svg>
                    Cancelar
                  </button>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200/70 bg-white/80 p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-900">Documentacion previa para la consulta</p>
                  <p className="text-sm text-slate-500">Comparte estudios, controles o imagenes para que el medico los revise antes del turno.</p>
                </div>
                <UploadDropzone
                  turnoId={t.id}
                  archivosSubidos={t.documentosPrevios ?? []}
                  onUpload={async (file, onProgress) => {
                    const form = new FormData();
                    form.append("archivo", file);
                    await api.post(`/turnos/${t.id}/documentos`, form, {
                      headers: { "Content-Type": "multipart/form-data" },
                      onUploadProgress: (event) => {
                        if (!event.total) return;
                        onProgress(Math.round((event.loaded * 100) / event.total));
                      }
                    });
                  }}
                  onDeleteUploaded={async (archivoId) => {
                    await api.delete(`/turnos/documentos/${archivoId}`);
                  }}
                  onPreviewUploaded={async (archivo) => {
                    const response = await api.get(`/turnos/documentos/${archivo.id}/descargar`, { responseType: "blob" });
                    return response.data;
                  }}
                  onUploaded={cargar}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Mi historial clínico</h2>
        <ul className="mt-3 space-y-2">
          {historial.map((c) => (
            <li key={c.id} className="border rounded p-3">
              <p className="font-medium">{new Date(c.fecha).toLocaleDateString()} - {c.turno.medico.usuario.nombre}</p>
              <p className="text-sm">Motivo: {c.motivo}</p>
              <p className="text-sm">Diagnóstico: {c.diagnostico || "-"}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

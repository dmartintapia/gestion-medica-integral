import axios from "axios";
import { ChangeEvent, DragEvent, useEffect, useId, useRef, useState } from "react";

export type ArchivoSubido = {
  id: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes: number;
  createdAt: string;
};

type EstadoCarga = "pendiente" | "subiendo" | "subido" | "error";

type ArchivoLocal = {
  id: string;
  file: File;
  previewUrl: string | null;
  estado: EstadoCarga;
  progreso: number;
  error: string | null;
};

type Props = {
  turnoId: string;
  archivosSubidos: ArchivoSubido[];
  onUpload: (file: File, onProgress: (progress: number) => void) => Promise<void>;
  onUploaded: () => Promise<void>;
  onDeleteUploaded: (archivoId: string) => Promise<void>;
  onPreviewUploaded: (archivo: ArchivoSubido) => Promise<Blob>;
  maxTamanoMb?: number;
};

const tiposPermitidos = ["application/pdf", "image/png", "image/jpeg"];
const extensionesPermitidas = ".pdf, .png, .jpg, .jpeg";

function formatearTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function etiquetaTipo(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType === "image/png") return "PNG";
  if (mimeType === "image/jpeg") return "JPG";
  return mimeType;
}

export function UploadDropzone({
  turnoId,
  archivosSubidos,
  onUpload,
  onUploaded,
  onDeleteUploaded,
  onPreviewUploaded,
  maxTamanoMb = 8
}: Props) {
  const [archivosLocales, setArchivosLocales] = useState<ArchivoLocal[]>([]);
  const [dragActivo, setDragActivo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [previewAbierto, setPreviewAbierto] = useState<{ url: string; nombre: string; mimeType: string } | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const archivosLocalesRef = useRef<ArchivoLocal[]>([]);

  useEffect(() => {
    archivosLocalesRef.current = archivosLocales;
  }, [archivosLocales]);

  useEffect(() => {
    return () => {
      for (const archivo of archivosLocalesRef.current) {
        if (archivo.previewUrl) {
          URL.revokeObjectURL(archivo.previewUrl);
        }
      }
      if (previewAbierto?.url) {
        URL.revokeObjectURL(previewAbierto.url);
      }
    };
  }, [previewAbierto]);

  const agregarArchivos = (lista: FileList | null) => {
    if (!lista?.length) return;

    const nuevos: ArchivoLocal[] = [];
    const errores: string[] = [];

    for (const file of Array.from(lista)) {
      if (!tiposPermitidos.includes(file.type)) {
        errores.push(`${file.name}: tipo no permitido.`);
        continue;
      }

      if (file.size > maxTamanoMb * 1024 * 1024) {
        errores.push(`${file.name}: supera ${maxTamanoMb} MB.`);
        continue;
      }

      nuevos.push({
        id: `${turnoId}-${crypto.randomUUID()}`,
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        estado: "pendiente",
        progreso: 0,
        error: null
      });
    }

    if (errores.length) {
      setMensaje(`Algunos archivos no se agregaron. ${errores.join(" ")}`);
    } else {
      setMensaje(null);
    }

    setArchivosLocales((prev) => [...prev, ...nuevos]);
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    agregarArchivos(event.target.files);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActivo(false);
    agregarArchivos(event.dataTransfer.files);
  };

  const eliminarArchivo = (archivoId: string) => {
    setArchivosLocales((prev) => {
      const target = prev.find((item) => item.id === archivoId);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== archivoId);
    });
  };

  const subirPendientes = async () => {
    const pendientes = archivosLocales.filter((archivo) => archivo.estado === "pendiente" || archivo.estado === "error");
    if (!pendientes.length) {
      setMensaje("Selecciona al menos un archivo antes de subir.");
      return;
    }

    setSubiendo(true);
    setMensaje(null);

    for (const archivo of pendientes) {
      setArchivosLocales((prev) =>
        prev.map((item) =>
          item.id === archivo.id ? { ...item, estado: "subiendo", progreso: 0, error: null } : item
        )
      );

      try {
        await onUpload(archivo.file, (progress) => {
          setArchivosLocales((prev) =>
            prev.map((item) => (item.id === archivo.id ? { ...item, progreso: progress } : item))
          );
        });

        setArchivosLocales((prev) =>
          prev.map((item) =>
            item.id === archivo.id ? { ...item, estado: "subido", progreso: 100, error: null } : item
          )
        );
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.message || "No se pudo subir el archivo."
          : "No se pudo subir el archivo.";

        setArchivosLocales((prev) =>
          prev.map((item) =>
            item.id === archivo.id ? { ...item, estado: "error", error: message, progreso: 0 } : item
          )
        );
      }
    }

    setSubiendo(false);
    await onUploaded();

    setArchivosLocales((prev) => {
      prev
        .filter((archivo) => archivo.estado === "subido" && archivo.previewUrl)
        .forEach((archivo) => URL.revokeObjectURL(archivo.previewUrl as string));

      return prev.filter((archivo) => archivo.estado !== "subido");
    });

    setMensaje("Archivos procesados. Los que ves en la lista inferior ya quedaron asociados al turno.");
  };

  const previsualizarArchivo = async (archivo: ArchivoSubido) => {
    const blob = await onPreviewUploaded(archivo);
    const url = URL.createObjectURL(blob);

    setPreviewAbierto((actual) => {
      if (actual?.url) {
        URL.revokeObjectURL(actual.url);
      }
      return { url, nombre: archivo.nombreArchivo, mimeType: archivo.mimeType };
    });
  };

  const cerrarPreview = () => {
    setPreviewAbierto((actual) => {
      if (actual?.url) {
        URL.revokeObjectURL(actual.url);
      }
      return null;
    });
  };

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-sm">
        <label
          htmlFor={inputId}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActivo(true);
          }}
          onDragLeave={() => setDragActivo(false)}
          onDrop={onDrop}
          className={[
            "group relative flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-[20px] border border-dashed px-4 py-3 text-center transition",
            dragActivo
              ? "border-marca bg-cyan-50 shadow-[0_18px_40px_-28px_rgba(8,145,178,0.55)]"
              : "border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,252,0.98))] hover:border-marca hover:bg-cyan-50/60"
          ].join(" ")}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={extensionesPermitidas}
            multiple
            className="sr-only"
            onChange={onFileInput}
          />

          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-marca text-white shadow-lg shadow-cyan-900/20">
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-[1.8]">
              <path d="M12 16V5" />
              <path d="M8 9l4-4 4 4" />
              <path d="M5 19h14" />
            </svg>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-900">Subir documentos</p>
            <p className="max-w-xl text-xs text-slate-500">
              Arrastra o selecciona archivos. PDF, PNG o JPG hasta {maxTamanoMb} MB.
            </p>
          </div>

          <button
            type="button"
            className="btn-lift mt-2 rounded-full bg-marca px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-cyan-900/20 hover:bg-cyan-800"
            onClick={(event) => {
              event.preventDefault();
              inputRef.current?.click();
            }}
          >
            Seleccionar archivos
          </button>
        </label>
      </div>

      {mensaje ? (
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm text-sky-900">{mensaje}</div>
      ) : null}

      {archivosLocales.length ? (
        <div className="space-y-3 rounded-[24px] border border-amber-200/70 bg-amber-50/70 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-sm font-semibold text-slate-900">Pendientes de subir</h4>
              <p className="text-sm text-slate-600">Aun estan solo en este dispositivo.</p>
            </div>

            <button
              type="button"
              disabled={subiendo}
              className="btn-lift rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={subirPendientes}
            >
              {subiendo ? "Subiendo archivos..." : "Subir seleccionados"}
            </button>
          </div>

          <div className="grid justify-items-center gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {archivosLocales.map((archivo) => (
              <article
                key={archivo.id}
                className="w-full max-w-xs overflow-hidden rounded-[22px] border border-white/80 bg-white shadow-[0_16px_40px_-32px_rgba(15,23,42,0.4)]"
              >
                <div className="flex items-start justify-between gap-3 p-4 pb-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{archivo.file.name}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {etiquetaTipo(archivo.file.type)} · {formatearTamano(archivo.file.size)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-lift rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                    onClick={() => eliminarArchivo(archivo.id)}
                    disabled={archivo.estado === "subiendo"}
                    aria-label={`Eliminar ${archivo.file.name}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-2">
                      <path d="M6 6l12 12" />
                      <path d="M18 6L6 18" />
                    </svg>
                  </button>
                </div>

                {archivo.previewUrl ? (
                  <div className="px-4">
                    <img
                      src={archivo.previewUrl}
                      alt={`Preview de ${archivo.file.name}`}
                      className="h-20 w-full rounded-2xl object-cover"
                    />
                  </div>
                ) : (
                  <div className="px-4">
                    <div className="flex h-20 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                      <svg viewBox="0 0 24 24" className="h-8 w-8 fill-none stroke-current stroke-[1.8]">
                        <path d="M7 3h7l5 5v13H7z" />
                        <path d="M14 3v5h5" />
                      </svg>
                    </div>
                  </div>
                )}

                <div className="space-y-3 p-4 pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={[
                        "rounded-full px-2.5 py-1 font-semibold uppercase tracking-[0.14em]",
                        archivo.estado === "pendiente" && "bg-amber-100 text-amber-700",
                        archivo.estado === "subiendo" && "bg-sky-100 text-sky-700",
                        archivo.estado === "subido" && "bg-emerald-100 text-emerald-700",
                        archivo.estado === "error" && "bg-rose-100 text-rose-700"
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      {archivo.estado}
                    </span>
                    <span className="text-slate-500">{archivo.progreso}%</span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={[
                        "h-full rounded-full transition-all",
                        archivo.estado === "error" ? "bg-rose-500" : "bg-marca"
                      ].join(" ")}
                      style={{ width: `${archivo.progreso}%` }}
                    />
                  </div>

                  <p className="min-h-10 text-sm text-slate-600">
                    {archivo.estado === "pendiente" && "Listo para enviar."}
                    {archivo.estado === "subiendo" && "Cargando al historial del turno."}
                    {archivo.estado === "subido" && "Carga completada."}
                    {archivo.estado === "error" && (archivo.error || "La subida fallo. Puedes reintentar.")}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {archivosSubidos.length ? (
        <div className="space-y-3 rounded-[24px] border border-emerald-200/60 bg-emerald-50/60 p-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Documentos cargados</h4>
            <p className="text-sm text-slate-600">Estos archivos ya quedaron asociados al turno y disponibles para el medico.</p>
          </div>

          <div className="grid justify-items-center gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {archivosSubidos.map((archivo) => (
              <article key={archivo.id} className="w-full max-w-xs rounded-[22px] border border-white/80 bg-white p-4 shadow-[0_14px_36px_-34px_rgba(15,23,42,0.55)]">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current stroke-[1.8]">
                      <path d="M7 3h7l5 5v13H7z" />
                      <path d="M14 3v5h5" />
                      <path d="M9 13l2 2 4-4" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{archivo.nombreArchivo}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {etiquetaTipo(archivo.mimeType)} · {formatearTamano(archivo.tamanoBytes)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Subido el {new Date(archivo.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="btn-lift inline-flex min-w-0 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
                    onClick={() => previsualizarArchivo(archivo)}
                  >
                    Previsualizar
                  </button>
                  <button
                    type="button"
                    className="btn-lift inline-flex min-w-0 items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                    disabled={eliminandoId === archivo.id}
                    onClick={async () => {
                      setEliminandoId(archivo.id);
                      try {
                        await onDeleteUploaded(archivo.id);
                        await onUploaded();
                      } finally {
                        setEliminandoId(null);
                      }
                    }}
                  >
                    {eliminandoId === archivo.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {previewAbierto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-[28px] bg-white p-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-900">{previewAbierto.nombre}</p>
                <p className="text-sm text-slate-500">{etiquetaTipo(previewAbierto.mimeType)}</p>
              </div>
              <button
                type="button"
                className="btn-lift rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={cerrarPreview}
              >
                Cerrar
              </button>
            </div>

            {previewAbierto.mimeType.startsWith("image/") ? (
              <img src={previewAbierto.url} alt={previewAbierto.nombre} className="max-h-[70vh] w-full rounded-[22px] object-contain bg-slate-50" />
            ) : (
              <iframe title={previewAbierto.nombre} src={previewAbierto.url} className="h-[70vh] w-full rounded-[22px] border border-slate-200" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

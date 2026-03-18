import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuthStore } from "../store/auth";

export function AdminPage() {
  const logout = useAuthStore((s) => s.logout);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [auditoria, setAuditoria] = useState<any[]>([]);

  const cargar = async () => {
    const [u, a] = await Promise.all([api.get("/admin/usuarios"), api.get("/admin/auditoria")]);
    setUsuarios(u.data);
    setAuditoria(a.data);
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <main className="p-4 max-w-6xl mx-auto space-y-6">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-marca">Panel Admin</h1>
        <button className="btn-lift text-sm underline" onClick={() => logout()}>Salir</button>
      </header>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold">Usuarios</h2>
        <ul className="mt-3 space-y-2">
          {usuarios.map((u) => (
            <li key={u.id} className="border rounded p-3 flex justify-between">
              <span>{u.nombre} ({u.rol}) - {u.email}</span>
              <button className="btn-lift text-sm underline" onClick={async () => {
                await api.patch(`/admin/usuarios/${u.id}/estado`, { activo: !u.activo });
                await cargar();
              }}>
                {u.activo ? "Suspender" : "Activar"}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white p-4 rounded shadow overflow-auto">
        <h2 className="font-semibold">Auditoría</h2>
        <table className="w-full text-sm mt-3">
          <thead>
            <tr className="text-left border-b">
              <th>Fecha</th>
              <th>Acción</th>
              <th>Recurso</th>
              <th>Resultado</th>
            </tr>
          </thead>
          <tbody>
            {auditoria.map((e) => (
              <tr key={e.id} className="border-b">
                <td>{new Date(e.fecha).toLocaleString()}</td>
                <td>{e.accion}</td>
                <td>{e.recurso}</td>
                <td>{e.resultado}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

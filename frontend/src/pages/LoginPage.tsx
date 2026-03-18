import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const usuario = useAuthStore((s) => s.usuario);
  const navigate = useNavigate();
  const [email, setEmail] = useState("juan.perez@gmi.local");
  const [password, setPassword] = useState("Paciente123*");
  const [token2fa, setToken2fa] = useState("");
  const [error, setError] = useState("");

  if (usuario) {
    navigate(`/${usuario.rol}`);
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form
        className="w-full max-w-md bg-white p-6 rounded-xl shadow"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            setError("");
            await login(email, password, token2fa || undefined);
            const rol = useAuthStore.getState().usuario?.rol;
            if (rol) navigate(`/${rol}`);
          } catch (err) {
            if (axios.isAxiosError(err)) {
              setError(err.response?.data?.message || "No se pudo iniciar sesión");
              return;
            }
            setError("No se pudo iniciar sesión");
          }
        }}
      >
        <h1 className="text-2xl font-bold text-marca">Gestion Medica Integral</h1>
        <p className="text-sm text-slate-500 mt-1">Acceso seguro para pacientes y profesionales</p>

        <label className="block mt-4 text-sm">Email</label>
        <input className="w-full border rounded p-2" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label className="block mt-3 text-sm">Password</label>
        <input type="password" className="w-full border rounded p-2" value={password} onChange={(e) => setPassword(e.target.value)} />

        <label className="block mt-3 text-sm">Token 2FA (opcional)</label>
        <input className="w-full border rounded p-2" value={token2fa} onChange={(e) => setToken2fa(e.target.value)} />

        {error ? <p className="text-red-600 text-sm mt-3">{error}</p> : null}

        <button className="btn-lift w-full mt-5 bg-marca text-white py-2 rounded">Ingresar</button>
      </form>
    </main>
  );
}

import { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import { AdminPage } from "./pages/AdminPage";
import { LoginPage } from "./pages/LoginPage";
import { MedicoPage } from "./pages/MedicoPage";
import { PacientePage } from "./pages/PacientePage";

function Protegida({ rol, children }: { rol: "admin" | "medico" | "paciente"; children: ReactElement }) {
  const usuario = useAuthStore((s) => s.usuario);
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.rol !== rol) return <Navigate to="/" replace />;
  return children;
}

export function App() {
  const usuario = useAuthStore((s) => s.usuario);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/paciente"
        element={
          <Protegida rol="paciente">
            <PacientePage />
          </Protegida>
        }
      />
      <Route
        path="/medico"
        element={
          <Protegida rol="medico">
            <MedicoPage />
          </Protegida>
        }
      />
      <Route
        path="/admin"
        element={
          <Protegida rol="admin">
            <AdminPage />
          </Protegida>
        }
      />
      <Route path="/" element={<Navigate to={usuario ? `/${usuario.rol}` : "/login"} replace />} />
    </Routes>
  );
}

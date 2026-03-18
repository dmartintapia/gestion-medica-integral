import { create } from "zustand";
import { api } from "../api/client";

type Usuario = {
  id: string;
  nombre: string;
  rol: "admin" | "medico" | "paciente";
};

type AuthState = {
  usuario: Usuario | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (email: string, password: string, token2fa?: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  usuario: null,
  accessToken: null,
  refreshToken: null,
  login: async (email, password, token2fa) => {
    const { data } = await api.post("/auth/login", { email, password, token2fa });
    set({ usuario: data.usuario, accessToken: data.accessToken, refreshToken: data.refreshToken });
  },
  logout: async () => {
    const token = get().refreshToken;
    if (token) {
      await api.post("/auth/logout", { refreshToken: token });
    }
    set({ usuario: null, accessToken: null, refreshToken: null });
  },
  refresh: async () => {
    const token = get().refreshToken;
    if (!token) return false;
    try {
      const { data } = await api.post("/auth/refresh", { refreshToken: token });
      set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      set({ usuario: null, accessToken: null, refreshToken: null });
      return false;
    }
  }
}));
import { create } from "zustand";
import type { User } from "@vybe/shared";
import * as authService from "../services/auth";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem("vybe_token"),
  isLoading: true,
  isAuthenticated: false,

  login: async (email, password) => {
    const result = await authService.login(email, password);
    localStorage.setItem("vybe_token", result.token);
    set({ user: result.user, token: result.token, isAuthenticated: true });
  },

  register: async (email, username, password) => {
    const result = await authService.register(email, username, password);
    localStorage.setItem("vybe_token", result.token);
    set({ user: result.user, token: result.token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem("vybe_token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem("vybe_token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await authService.getProfile();
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("vybe_token");
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

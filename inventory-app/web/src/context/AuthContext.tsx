import React, { createContext, useContext, useState } from "react";
import { api, clearToken, getToken, setToken } from "../lib/api";

interface AuthUser {
  id: string;
  name: string;
  role: "ADMIN" | "EMPLOYEE" | "REVIEWER";
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const raw = localStorage.getItem("inventory_admin_user");
      if (!raw || raw === "undefined" || raw === "null" || raw === "[object Object]") {
        localStorage.removeItem("inventory_admin_user");
        return null;
      }
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem("inventory_admin_user");
      return null;
    }
  });

  async function login(username: string, password: string) {
    const res = await api.login(username, password);
    if (!res || !res.token) {
      throw new Error("بيانات الدخول غير صحيحة");
    }
    setToken(res.token);
    const authUser = res.user && typeof res.user === "object" ? res.user : null;
    if (authUser) {
      localStorage.setItem("inventory_admin_user", JSON.stringify(authUser));
    } else {
      localStorage.removeItem("inventory_admin_user");
    }
    setUser(authUser);
  }

  function logout() {
    clearToken();
    localStorage.removeItem("inventory_admin_user");
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function isAuthenticated() {
  return !!getToken();
}

import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "لوحة القيادة", end: true },
  { to: "/tasks", label: "مهام الجرد" },
  { to: "/items", label: "الأصناف" },
  { to: "/warehouses", label: "المستودعات" },
  { to: "/employees", label: "الموظفون" },
  { to: "/pending-items", label: "مواد قيد المراجعة" },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex" dir="rtl">
      <aside className="w-64 shrink-0 bg-ink text-paper flex flex-col">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="font-display text-lg font-semibold tracking-tight">نظام الجرد</div>
          <div className="text-xs text-white/50 mt-1 font-mono">v0.1 · Phase 1+2</div>
        </div>
        <nav className="flex-1 py-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-6 py-3 text-sm border-r-2 transition-colors ${
                  isActive
                    ? "border-signal bg-white/5 text-white"
                    : "border-transparent text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-sm">
          <div className="text-white/80">{user?.name}</div>
          <button onClick={logout} className="text-white/40 hover:text-signal text-xs mt-1">
            تسجيل الخروج
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-paper min-h-screen">
        <div className="max-w-5xl mx-auto px-8 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

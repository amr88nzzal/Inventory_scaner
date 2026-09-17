import React, { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems =
    user?.role === "EMPLOYEE"
      ? [
          { to: "/tasks", label: "📋 مهام الجرد المسندة" },
          { to: "/items", label: "📦 الأصناف والمنتجات" },
        ]
      : [
          { to: "/", label: "📊 لوحة القيادة", end: true },
          { to: "/tasks", label: "📋 إدارة مهام الجرد" },
          { to: "/items", label: "📦 الأصناف" },
          { to: "/warehouses", label: "🏢 المستودعات" },
          { to: "/employees", label: "👥 الموظفون" },
          { to: "/pending-items", label: "⚠️ مواد قيد المراجعة" },
        ];

  // Find active label for mobile header title
  const activeNavItem = navItems.find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-paper" dir="rtl">
      {/* Mobile Top Navbar (Visible on Mobile only) */}
      <header className="md:hidden bg-ink text-paper border-b border-white/10 sticky top-0 z-40 shadow-md">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-1.5 rounded bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
              aria-label="القائمة"
            >
              <span className="text-base">{mobileMenuOpen ? "✕" : "☰"}</span>
            </button>
            <div>
              <div className="font-display text-sm font-bold leading-none">نظام الجرد المخزني</div>
              <div className="text-[10px] text-signal font-semibold mt-0.5">
                {activeNavItem?.label || "القائمة الرئيسية"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-white/80 font-medium max-w-[100px] truncate">
              {user?.name}
            </span>
            <button
              onClick={logout}
              className="text-[11px] bg-white/10 hover:bg-warn text-white px-2 py-1 rounded transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              خروج 🚪
            </button>
          </div>
        </div>

        {/* Mobile Dropdown / Horizontal Nav Drawer */}
        {mobileMenuOpen && (
          <nav className="bg-ink/95 border-t border-white/10 px-2 py-2 grid grid-cols-2 gap-1 animate-fade-in shadow-xl">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `px-3 py-2 text-xs rounded transition-colors flex items-center font-medium ${
                    isActive
                      ? "bg-signal text-paper font-bold"
                      : "text-white/80 hover:text-white hover:bg-white/10"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Desktop Sidebar (Hidden on Mobile) */}
      <aside className="hidden md:flex w-64 shrink-0 bg-ink text-paper flex-col min-h-screen">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="font-display text-lg font-semibold tracking-tight">نظام الجرد المخزني</div>
          <div className="text-xs text-white/50 mt-1 font-mono">الإصدار 1.0</div>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `block px-6 py-3 text-sm border-r-2 transition-colors ${
                  isActive
                    ? "border-signal bg-white/5 text-white font-semibold"
                    : "border-transparent text-white/60 hover:text-white hover:bg-white/5"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-6 py-4 border-t border-white/10 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-white font-medium truncate">{user?.name}</span>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-signal font-mono">
              {user?.role === "ADMIN" ? "مسؤول" : "موظف"}
            </span>
          </div>
          <button
            onClick={logout}
            className="text-white/40 hover:text-signal text-xs mt-2 inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            🚪 تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-paper min-h-screen overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}


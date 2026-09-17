import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, isAuthenticated, useAuth } from "./context/AuthContext";
import DashboardLayout from "./components/DashboardLayout";
import Login from "./pages/Login";
import DashboardHome from "./pages/DashboardHome";
import Employees from "./pages/Employees";
import Warehouses from "./pages/Warehouses";
import Items from "./pages/Items";
import Tasks from "./pages/Tasks";
import PendingItems from "./pages/PendingItems";

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/tasks" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardHome />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="items" element={<Items />} />
          <Route
            path="warehouses"
            element={
              <RequireAdmin>
                <Warehouses />
              </RequireAdmin>
            }
          />
          <Route
            path="employees"
            element={
              <RequireAdmin>
                <Employees />
              </RequireAdmin>
            }
          />
          <Route
            path="pending-items"
            element={
              <RequireAdmin>
                <PendingItems />
              </RequireAdmin>
            }
          />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

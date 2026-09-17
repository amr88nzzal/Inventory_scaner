import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, isAuthenticated } from "./context/AuthContext";
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
          <Route path="warehouses" element={<Warehouses />} />
          <Route path="employees" element={<Employees />} />
          <Route path="pending-items" element={<PendingItems />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}

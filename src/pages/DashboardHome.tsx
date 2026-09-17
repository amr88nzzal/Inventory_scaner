import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function DashboardHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ items: 0, warehouses: 0, employees: 0, pending: 0, tasksNeedingRecount: 0 });
  const [tasks, setTasks] = useState<any[]>([]);

  if (user?.role === "EMPLOYEE") {
    return <Navigate to="/tasks" replace />;
  }

  useEffect(() => {
    (async () => {
      const [itemsCountRes, warehousesRes, usersRes, pendingRes, taskListRes] = await Promise.all([
        api.countItems().catch(() => ({ count: 0 })),
        api.listWarehouses().catch(() => []),
        api.listUsers().catch(() => []),
        api.listPendingItems().catch(() => []),
        api.listTasks().catch(() => []),
      ]);

      const itemsCount = typeof itemsCountRes?.count === "number" ? itemsCountRes.count : 0;
      const warehouses = Array.isArray(warehousesRes) ? warehousesRes : [];
      const users = Array.isArray(usersRes) ? usersRes : [];
      const pending = Array.isArray(pendingRes) ? pendingRes : [];
      const taskList = Array.isArray(taskListRes) ? taskListRes : [];

      setTasks(taskList);
      setStats({
        items: itemsCount,
        warehouses: warehouses.length,
        employees: users.filter((u: any) => u && u.role === "EMPLOYEE").length,
        pending: pending.length,
        tasksNeedingRecount: taskList.filter((t: any) => t && t.status === "NEEDS_RECOUNT").length,
      });
    })();
  }, []);

  const cards = [
    { label: "الأصناف المسجّلة", value: stats.items },
    { label: "المستودعات", value: stats.warehouses },
    { label: "الموظفون", value: stats.employees },
    { label: "مواد قيد المراجعة", value: stats.pending, alert: stats.pending > 0 },
    { label: "مهام تحتاج إعادة عد", value: stats.tasksNeedingRecount, alert: stats.tasksNeedingRecount > 0 },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-8">لوحة القيادة</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
        {cards.map((c) => (
          <div key={c.label} className={`border rounded-sm p-4 ${c.alert ? "border-warn/40 bg-warn/5" : "border-graphite/15 bg-white"}`}>
            <div className={`font-mono text-3xl font-medium ${c.alert ? "text-warn" : "text-ink"}`}>{c.value}</div>
            <div className="text-xs text-graphite/70 mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      <h2 className="font-display text-lg font-semibold mb-4">آخر مهام الجرد</h2>
      <div className="border border-graphite/15 rounded-sm bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-graphite/5 text-graphite/70 text-right">
            <tr>
              <th className="px-4 py-2 font-medium">رقم المهمة</th>
              <th className="px-4 py-2 font-medium">المستودع</th>
              <th className="px-4 py-2 font-medium">الموظفون</th>
              <th className="px-4 py-2 font-medium">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(tasks) ? tasks : []).slice(0, 8).map((t) => (
              <tr key={t.id} className="border-t border-graphite/10">
                <td className="px-4 py-2 font-mono">{t.taskNumber}</td>
                <td className="px-4 py-2">{t.warehouse?.name}</td>
                <td className="px-4 py-2">{t.assignees?.map((a: any) => a.user?.name).join("، ")}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={t.status} />
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-graphite/50">
                  لا توجد مهام جرد بعد
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ASSIGNED: { label: "مسندة", cls: "bg-graphite/10 text-graphite" },
    IN_PROGRESS: { label: "قيد التنفيذ", cls: "bg-signal/10 text-signal" },
    PENDING_REVIEW: { label: "بانتظار الاعتماد", cls: "bg-good/10 text-good" },
    NEEDS_RECOUNT: { label: "تحتاج إعادة عد", cls: "bg-warn/10 text-warn" },
    APPROVED: { label: "معتمدة", cls: "bg-good/15 text-good" },
  };
  const s = map[status] || { label: status, cls: "bg-graphite/10 text-graphite" };
  return <span className={`px-2 py-1 rounded-sm text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

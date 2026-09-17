import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "./DashboardHome";

export default function Tasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [reportSummaries, setReportSummaries] = useState<Record<string, any>>({});

  async function load() {
    const [taskList, warehouseList, userList] = await Promise.all([
      api.listTasks(),
      api.listWarehouses(),
      api.listUsers(),
    ]);
    setTasks(taskList);
    setWarehouses(warehouseList);
    setEmployees(userList.filter((u: any) => u.role !== "ADMIN"));
  }
  useEffect(() => {
    load();
  }, []);

  async function handleGenerate(taskId: string) {
    setGenerating(taskId);
    try {
      const res = await api.generateReport(taskId);
      setReportSummaries((s) => ({ ...s, [taskId]: res }));
      load();
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold">مهام الجرد</h1>
        <button onClick={() => setShowForm((v) => !v)} className="bg-ink text-paper px-4 py-2 rounded-sm text-sm hover:bg-signal transition-colors">
          {showForm ? "إلغاء" : "إسناد مهمة جديدة"}
        </button>
      </div>

      {showForm && (
        <TaskForm
          warehouses={warehouses}
          employees={employees}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="space-y-4">
        {tasks.map((t) => {
          const summary = reportSummaries[t.id];
          return (
            <div key={t.id} className="border border-graphite/15 rounded-sm bg-white p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono font-medium">{t.taskNumber}</div>
                  <div className="text-sm text-graphite/60 mt-1">
                    {t.warehouse?.name} · {t.assignees?.map((a: any) => a.user?.name).join("، ")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={t.status} />
                  {t.status !== "APPROVED" && (
                    <button
                      onClick={() => handleGenerate(t.id)}
                      disabled={generating === t.id}
                      className="text-xs border border-graphite/30 px-3 py-1.5 rounded-sm hover:border-signal transition-colors"
                    >
                      {generating === t.id ? "جارٍ التوليد..." : "توليد التقرير النهائي"}
                    </button>
                  )}
                </div>
              </div>

              {summary && (
                <div className="mt-4 border-t border-graphite/10 pt-3">
                  <table className="w-full text-xs">
                    <thead className="text-graphite/60">
                      <tr>
                        <th className="text-right py-1">الباركود</th>
                        <th className="text-right py-1">الاسم</th>
                        {t.showVarianceAtEnd && <th className="text-right py-1">الفرق</th>}
                        <th className="text-right py-1">إعادة عد؟</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.summary.map((row: any, i: number) => (
                        <tr key={i} className="border-t border-graphite/5">
                          <td className="py-1 font-mono">{row.barcode}</td>
                          <td className="py-1">{row.name}</td>
                          {t.showVarianceAtEnd && (
                            <td className={`py-1 font-mono ${row.flaggedForRecount ? "text-warn" : ""}`}>
                              {row.varianceQty} ({row.variancePct?.toFixed?.(1)}%)
                            </td>
                          )}
                          <td className="py-1">{row.flaggedForRecount ? "نعم" : "لا"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.report?.id && (
                    <a href={api.reportCsvUrl(summary.report.id)} className="text-signal text-xs mt-2 inline-block hover:underline">
                      تنزيل CSV ↓
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {tasks.length === 0 && <div className="text-graphite/50 text-sm">لا توجد مهام جرد بعد</div>}
      </div>
    </div>
  );
}

function TaskForm({ warehouses, employees, onCreated }: { warehouses: any[]; employees: any[]; onCreated: () => void }) {
  const [form, setForm] = useState({
    warehouseId: "",
    taskNumber: "",
    assigneeUserIds: [] as string[],
    scopeType: "ALL" as "ALL" | "CATEGORY" | "SUPPLIER" | "ITEM_LIST",
    scopeValue: "",
    startTime: "",
    blindCount: false,
    showVarianceAtEnd: true,
    generalRecountTolerancePct: 10,
    aggregateAcrossLocations: true,
  });
  const [saving, setSaving] = useState(false);

  function toggleAssignee(id: string) {
    setForm((f) => ({
      ...f,
      assigneeUserIds: f.assigneeUserIds.includes(id) ? f.assigneeUserIds.filter((a) => a !== id) : [...f.assigneeUserIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createTask({ ...form, startTime: new Date(form.startTime).toISOString() });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-graphite/15 rounded-sm bg-white p-5 mb-8">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-graphite/60 mb-1">رقم المهمة</label>
          <input
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm font-mono mb-3"
            value={form.taskNumber}
            onChange={(e) => setForm({ ...form, taskNumber: e.target.value })}
            required
          />

          <label className="block text-xs text-graphite/60 mb-1">المستودع</label>
          <select
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3"
            value={form.warehouseId}
            onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
            required
          >
            <option value="">اختر مستودعاً</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <label className="block text-xs text-graphite/60 mb-1">وقت البدء</label>
          <input
            type="datetime-local"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            required
          />

          <label className="block text-xs text-graphite/60 mb-1">الموظفون المسندون</label>
          <div className="space-y-1 mb-3">
            {employees.map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.assigneeUserIds.includes(emp.id)} onChange={() => toggleAssignee(emp.id)} />
                {emp.name}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs text-graphite/60 mb-1">نطاق الأصناف</label>
          <select
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3"
            value={form.scopeType}
            onChange={(e) => setForm({ ...form, scopeType: e.target.value as any })}
          >
            <option value="ALL">كل الأصناف</option>
            <option value="CATEGORY">فئة محددة</option>
            <option value="SUPPLIER">مورّد محدد</option>
            <option value="ITEM_LIST">قائمة أصناف محددة</option>
          </select>
          {form.scopeType !== "ALL" && (
            <input
              placeholder={form.scopeType === "SUPPLIER" ? "اسم المورّد" : form.scopeType === "CATEGORY" ? "اسم الفئة" : "معرّفات الأصناف مفصولة بفاصلة"}
              className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3"
              value={form.scopeValue}
              onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
            />
          )}

          <label className="block text-xs text-graphite/60 mb-1">نسبة تفاوت إعادة العد العامة (%)</label>
          <input
            type="number"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3 font-mono"
            value={form.generalRecountTolerancePct}
            onChange={(e) => setForm({ ...form, generalRecountTolerancePct: Number(e.target.value) })}
          />

          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={form.blindCount} onChange={(e) => setForm({ ...form, blindCount: e.target.checked })} />
            جرد أعمى (إخفاء الرصيد النظري عن الموظف)
          </label>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input type="checkbox" checked={form.showVarianceAtEnd} onChange={(e) => setForm({ ...form, showVarianceAtEnd: e.target.checked })} />
            إظهار الفوارق عند نهاية الجرد
          </label>
          <label className="flex items-center gap-2 text-sm mb-2">
            <input
              type="checkbox"
              checked={form.aggregateAcrossLocations}
              onChange={(e) => setForm({ ...form, aggregateAcrossLocations: e.target.checked })}
            />
            تجميع الكميات تلقائياً عبر المواقع (بدلاً من إبقائها متسلسلة)
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || form.assigneeUserIds.length === 0 || !form.warehouseId}
        className="mt-4 bg-ink text-paper px-5 py-2 rounded-sm text-sm hover:bg-signal transition-colors disabled:opacity-40"
      >
        {saving ? "جارٍ الإسناد..." : "إسناد المهمة"}
      </button>
    </form>
  );
}

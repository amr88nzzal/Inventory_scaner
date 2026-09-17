import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Employees() {
  const [users, setUsers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "EMPLOYEE", warehouseScope: [] as string[] });
  const [saving, setSaving] = useState(false);

  async function load() {
    setUsers(await api.listUsers());
    setWarehouses(await api.listWarehouses());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createUser(form);
      setForm({ name: "", username: "", password: "", role: "EMPLOYEE", warehouseScope: [] });
      load();
    } finally {
      setSaving(false);
    }
  }

  function toggleScope(id: string) {
    setForm((f) => ({
      ...f,
      warehouseScope: f.warehouseScope.includes(id) ? f.warehouseScope.filter((w) => w !== id) : [...f.warehouseScope, id],
    }));
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-8">الموظفون</h1>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 border border-graphite/15 rounded-sm bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-graphite/5 text-graphite/70 text-right">
              <tr>
                <th className="px-4 py-2 font-medium">الاسم</th>
                <th className="px-4 py-2 font-medium">اسم المستخدم</th>
                <th className="px-4 py-2 font-medium">الدور</th>
                <th className="px-4 py-2 font-medium">نطاق الوصول</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-graphite/10">
                  <td className="px-4 py-2">{u.name}</td>
                  <td className="px-4 py-2 font-mono">{u.username}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2 text-graphite/60">
                    {u.warehouseScope?.length ? `${u.warehouseScope.length} مستودع` : "الكل"}
                  </td>
                  <td className="px-4 py-2">
                    {u.active && (
                      <button onClick={() => api.deactivateUser(u.id).then(load)} className="text-warn text-xs">
                        تعطيل
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form onSubmit={handleCreate} className="border border-graphite/15 rounded-sm bg-white p-5 h-fit">
          <div className="font-medium mb-4">إضافة موظف</div>
          <input
            placeholder="الاسم الكامل"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-3 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="اسم المستخدم"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-3 text-sm font-mono"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
          />
          <input
            type="password"
            placeholder="كلمة المرور"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-3 text-sm"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <select
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-3 text-sm"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="EMPLOYEE">موظف</option>
            <option value="REVIEWER">مراجع</option>
            <option value="ADMIN">أدمن</option>
          </select>

          <div className="text-xs text-graphite/60 mb-1">نطاق الوصول (اتركه فارغاً للسماح بكل المستودعات)</div>
          <div className="mb-4 space-y-1">
            {warehouses.map((w) => (
              <label key={w.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.warehouseScope.includes(w.id)} onChange={() => toggleScope(w.id)} />
                {w.name}
              </label>
            ))}
          </div>

          <button type="submit" disabled={saving} className="w-full bg-ink text-paper py-2 rounded-sm text-sm hover:bg-signal transition-colors">
            {saving ? "جارٍ الحفظ..." : "إضافة"}
          </button>
        </form>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [locationsInput, setLocationsInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setWarehouses(await api.listWarehouses());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const locations = locationsInput
        .split(",")
        .map((l) => l.trim())
        .filter(Boolean);
      await api.createWarehouse({ name, locations });
      setName("");
      setLocationsInput("");
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-8">المستودعات</h1>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-4">
          {warehouses.map((w) => (
            <div key={w.id} className="border border-graphite/15 rounded-sm bg-white p-4">
              <div className="font-medium">{w.name}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {w.locations.map((l: any) => (
                  <span key={l.id} className="text-xs bg-graphite/10 text-graphite px-2 py-1 rounded-sm font-mono">
                    {l.label}
                  </span>
                ))}
                {w.locations.length === 0 && <span className="text-xs text-graphite/40">لا توجد مواقع محددة</span>}
              </div>
            </div>
          ))}
          {warehouses.length === 0 && <div className="text-graphite/50 text-sm">لا توجد مستودعات بعد</div>}
        </div>

        <form onSubmit={handleCreate} className="border border-graphite/15 rounded-sm bg-white p-5 h-fit">
          <div className="font-medium mb-4">إضافة مستودع</div>
          <input
            placeholder="اسم المستودع"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-3 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <label className="block text-xs text-graphite/60 mb-1">
            المواقع/الأقسام (افصل بينها بفاصلة)
          </label>
          <textarea
            placeholder="الواجهة رقم 1, صالة رقم 5"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 mb-4 text-sm h-20"
            value={locationsInput}
            onChange={(e) => setLocationsInput(e.target.value)}
          />
          <button type="submit" disabled={saving} className="w-full bg-ink text-paper py-2 rounded-sm text-sm hover:bg-signal transition-colors">
            {saving ? "جارٍ الحفظ..." : "إضافة"}
          </button>
        </form>
      </div>
    </div>
  );
}

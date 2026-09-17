import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";

export default function Items() {
  const [items, setItems] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showDbImport, setShowDbImport] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setItems(await api.listItems());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.importItemsCsv(file);
      setImportResult(`تم استيراد ${result.imported} صنف من أصل ${result.results.length}`);
      load();
    } catch (err: any) {
      setImportResult(`فشل الاستيراد: ${err.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold">الأصناف</h1>
        <div className="flex gap-2">
          <label className="bg-ink text-paper px-4 py-2 rounded-sm text-sm cursor-pointer hover:bg-signal transition-colors">
            استيراد CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvChange} />
          </label>
          <button
            onClick={() => setShowDbImport((v) => !v)}
            className="border border-graphite/30 px-4 py-2 rounded-sm text-sm hover:border-signal transition-colors"
          >
            استيراد من قاعدة بيانات
          </button>
        </div>
      </div>

      {importResult && <div className="mb-4 text-sm text-good bg-good/5 border border-good/20 rounded-sm px-3 py-2">{importResult}</div>}

      {showDbImport && <DbImportPanel onDone={() => { setShowDbImport(false); load(); }} />}

      <div className="border border-graphite/15 rounded-sm bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-graphite/5 text-graphite/70 text-right">
            <tr>
              <th className="px-4 py-2 font-medium">الباركود</th>
              <th className="px-4 py-2 font-medium">الاسم</th>
              <th className="px-4 py-2 font-medium">المورد</th>
              <th className="px-4 py-2 font-medium">الرصيد النظري</th>
              <th className="px-4 py-2 font-medium">الوحدات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t border-graphite/10">
                <td className="px-4 py-2 font-mono">{it.barcode}</td>
                <td className="px-4 py-2">{it.name}</td>
                <td className="px-4 py-2 text-graphite/60">{it.supplier || "—"}</td>
                <td className="px-4 py-2 font-mono">{it.systemQty}</td>
                <td className="px-4 py-2 text-xs text-graphite/60">
                  {it.units?.map((u: any) => `${u.unitName} (${u.qtyPerUnit})`).join("، ")}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-graphite/50">
                  لا توجد أصناف بعد — ابدأ باستيراد ملف CSV
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DbImportPanel({ onDone }: { onDone: () => void }) {
  const [dbType, setDbType] = useState<"postgres" | "mysql">("postgres");
  const [connectionString, setConnectionString] = useState("");
  const [query, setQuery] = useState("SELECT barcode, name, price, qty FROM products");
  const [mapping, setMapping] = useState({ barcode: "barcode", name: "name", price: "price", systemQty: "qty" });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.importItemsFromDatabase({
        dbType,
        connectionString,
        query,
        columnMapping: mapping,
      });
      setResult(`تم استيراد ${res.imported} صنف من أصل ${res.results.length}`);
      onDone();
    } catch (err: any) {
      setResult(`فشل: ${err.message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="border border-graphite/15 rounded-sm bg-white p-5 mb-6">
      <div className="font-medium mb-1">استيراد مباشر من قاعدة بيانات خارجية</div>
      <div className="text-xs text-graphite/60 mb-4">يُسمح فقط باستعلامات SELECT — لن يتم قبول أي استعلام تعديل أو حذف.</div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-graphite/60 mb-1">نوع القاعدة</label>
          <select className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3" value={dbType} onChange={(e) => setDbType(e.target.value as any)}>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>

          <label className="block text-xs text-graphite/60 mb-1">رابط الاتصال (Connection String)</label>
          <input
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm font-mono mb-3"
            placeholder="postgresql://user:pass@host:5432/db"
            value={connectionString}
            onChange={(e) => setConnectionString(e.target.value)}
          />

          <label className="block text-xs text-graphite/60 mb-1">الاستعلام (SELECT فقط)</label>
          <textarea
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm font-mono h-24"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs text-graphite/60 mb-1">تعيين الأعمدة</label>
          {(["barcode", "name", "price", "supplier", "category", "systemQty", "baseUnitName"] as const).map((field) => (
            <div key={field} className="flex items-center gap-2 mb-2">
              <span className="text-xs w-24 text-graphite/60">{field}</span>
              <input
                className="flex-1 border border-graphite/20 rounded-sm px-2 py-1 text-sm font-mono"
                value={(mapping as any)[field] || ""}
                onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
              />
            </div>
          ))}
        </div>
      </div>

      {result && <div className="text-sm mt-3 text-graphite">{result}</div>}

      <button
        onClick={handleRun}
        disabled={running || !connectionString || !query}
        className="mt-4 bg-ink text-paper px-5 py-2 rounded-sm text-sm hover:bg-signal transition-colors disabled:opacity-40"
      >
        {running ? "جارٍ التنفيذ..." : "تشغيل الاستيراد"}
      </button>
    </div>
  );
}

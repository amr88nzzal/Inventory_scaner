import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function Items() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("");
  const [importResult, setImportResult] = useState<string | null>(null);
  const [showDbImport, setShowDbImport] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const [itemList, whList] = await Promise.all([
        api.listItems().catch(() => []),
        api.listWarehouses().catch(() => []),
      ]);
      setItems(Array.isArray(itemList) ? itemList : []);
      setWarehouses(Array.isArray(whList) ? whList : []);
    } catch (err: any) {
      console.error(err);
      setItems([]);
      setWarehouses([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function downloadSampleCsv() {
    const csvContent = 
      "الباركود;الاسم;المورد;المجموعة/الفئة;الرصيد النظري;الوحدة الأساسية;رمز المادة\n" +
      "6253005320152;بسكويت شوكولاتة 200 غرام;شركة الغذاء العربي;البسكويت والحلويات;32;كرتونة;1011\n" +
      "6253005320169;بسكويت مالح 200 غرام;شركة الغذاء العربي;البسكويت والحلويات;0;كرتونة;1011\n" +
      "6281034904807;مياه معدنية طبيعية 330 مل;مصنع مياه الهناء;المشروبات والعصائر;150;صندوق;2055\n" +
      "6281034911522;عصير برتقال طبيعي 1 لتر;مصنع مياه الهناء;المشروبات والعصائر;32;صندوق;2055";

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "sample_items.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleClearAll() {
    if (!isAdmin) return;
    if (confirm("🚨 تحذير هام جداً:\n\nهل أنت متأكد من رغبتك في حذف جميع الأصناف والوحدات من النظام بشكل كامل ونهائي؟\n\nهذا الإجراء سيقوم بتفريغ جدول الأصناف لتتمكن من إعادة الاستيراد وتفادي أي تعارض بالباركود والرمز المحاسبي القديم.\n\nلا يمكن التراجع عن هذا القرار!")) {
      try {
        await api.clearItems();
        setImportResult("تم حذف جميع الأصناف والوحدات من النظام بنجاح. يمكنك الآن استيراد ملف جديد بالكامل.");
        load();
      } catch (err: any) {
        alert("حدث خطأ أثناء حذف الأصناف: " + err.message);
      }
    }
  }

  async function handleDeleteItem(id: string) {
    if (!isAdmin) return;
    if (confirm("هل أنت متأكد من رغبتك في حذف هذا الصنف المحدد نهائياً من النظام؟")) {
      try {
        await api.deleteItem(id);
        load();
      } catch (err: any) {
        alert("حدث خطأ أثناء حذف الصنف: " + err.message);
      }
    }
  }

  async function handleCsvChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.importItemsCsv(file, selectedWarehouseId || undefined);
      setImportResult(`تم استيراد ${result.imported} صنف بنجاح من أصل ${result.results.length} سجل في الملف.`);
      load();
    } catch (err: any) {
      setImportResult(`فشل الاستيراد: ${err.message}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Top Header & Action Controls Bar */}
      <div className="shrink-0 mb-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold">الأصناف والمنتجات</h1>
            <p className="text-xs text-graphite/60 mt-0.5">
              {isAdmin ? "استعراض وتحديث قاعدة بيانات أصناف ومواد الجرد" : "استعراض دليل أصناف ومواد النظام (عرض فقط للموظف)"}
            </p>
            {isAdmin && (
              <button
                onClick={downloadSampleCsv}
                className="text-signal hover:underline text-xs font-semibold mt-1 inline-flex items-center gap-1 cursor-pointer"
              >
                📥 تحميل ملف مثال CSV المعتمد للأصناف
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Admin-only Import Controls */}
            {isAdmin ? (
              <>
                {/* Warehouse Import Filter Selector */}
                {warehouses.length > 0 && (
                  <div className="flex items-center gap-1.5 bg-white border border-graphite/20 rounded-sm px-2 py-1 text-xs">
                    <span className="text-graphite/60 font-semibold whitespace-nowrap">المستودع المستهدف:</span>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="bg-transparent text-ink font-semibold focus:outline-none cursor-pointer"
                    >
                      <option value="">عام / ترك الخيار للمشرف</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <label className="bg-ink text-paper px-4 py-2 rounded-sm text-sm cursor-pointer hover:bg-signal transition-colors font-semibold shadow-xs">
                  استيراد CSV
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvChange} />
                </label>

                <button
                  onClick={() => setShowDbImport((v) => !v)}
                  className="border border-graphite/30 bg-white px-4 py-2 rounded-sm text-sm hover:border-signal transition-colors font-semibold shadow-xs"
                >
                  استيراد من قاعدة بيانات
                </button>

                {items.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="bg-warn/10 text-warn border border-warn/20 hover:bg-warn hover:text-paper px-4 py-2 rounded-sm text-sm transition-colors font-semibold"
                  >
                    🗑️ حذف جميع الأصناف
                  </button>
                )}
              </>
            ) : (
              <div className="bg-graphite/10 text-graphite/70 text-xs px-3 py-1.5 rounded border border-graphite/20 font-semibold">
                🔒 صلاحيات الاستيراد والتعديل مقتصرة على المشرف الإداري
              </div>
            )}
          </div>
        </div>

        {importResult && (
          <div className="mt-3 text-xs text-good bg-good/5 border border-good/20 rounded-sm px-3 py-2 flex items-center justify-between">
            <span>{importResult}</span>
            <button onClick={() => setImportResult(null)} className="text-graphite/50 hover:text-ink font-bold">×</button>
          </div>
        )}

        {isAdmin && showDbImport && (
          <DbImportPanel
            warehouses={warehouses}
            selectedWarehouseId={selectedWarehouseId}
            onDone={() => {
              setShowDbImport(false);
              load();
            }}
          />
        )}
      </div>

      {/* Internal Scrollable Table Container */}
      <div className="flex-1 overflow-y-auto border border-graphite/15 rounded-sm bg-white shadow-xs relative">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-graphite/10 text-graphite/80 text-right sticky top-0 z-10 backdrop-blur-xs border-b border-graphite/20">
            <tr>
              <th className="px-4 py-2.5 font-semibold">رمز المادة</th>
              <th className="px-4 py-2.5 font-semibold">الباركود</th>
              <th className="px-4 py-2.5 font-semibold">اسم الصنف</th>
              <th className="px-4 py-2.5 font-semibold">المستودع</th>
              <th className="px-4 py-2.5 font-semibold">المورد</th>
              <th className="px-4 py-2.5 font-semibold">المجموعة / الفئة</th>
              <th className="px-4 py-2.5 font-semibold">الرصيد النظري</th>
              <th className="px-4 py-2.5 font-semibold">الوحدات</th>
              {isAdmin && <th className="px-4 py-2.5 font-semibold text-center">الإجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-graphite/10">
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-graphite/5 transition-colors">
                <td className="px-4 py-2 font-mono font-bold text-signal">{it.itemCode || "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{it.barcode}</td>
                <td className="px-4 py-2 font-medium">{it.name}</td>
                <td className="px-4 py-2 text-xs">
                  {it.warehouse?.name ? (
                    <span className="bg-signal/10 text-signal font-medium px-2 py-0.5 rounded">
                      {it.warehouse.name}
                    </span>
                  ) : (
                    <span className="text-graphite/40">عام / غير محدد</span>
                  )}
                </td>
                <td className="px-4 py-2 text-graphite/70 text-xs">{it.supplier || "—"}</td>
                <td className="px-4 py-2 text-graphite/70 text-xs">
                  {it.category ? (
                    <span className="bg-graphite/10 px-2 py-0.5 rounded-sm text-xs text-ink">{it.category}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-2 font-mono font-bold text-ink">{it.systemQty}</td>
                <td className="px-4 py-2 text-xs text-graphite/60">
                  {it.units?.map((u: any) => `${u.unitName} (${u.qtyPerUnit})`).join("، ")}
                </td>
                {isAdmin && (
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditingItem(it)}
                        className="text-signal hover:underline text-xs font-semibold px-2 py-1 cursor-pointer"
                      >
                        تعديل
                      </button>
                      <span className="text-graphite/20">|</span>
                      <button
                        onClick={() => handleDeleteItem(it.id)}
                        className="text-warn hover:underline text-xs font-semibold px-2 py-1 cursor-pointer"
                      >
                        حذف
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="px-4 py-12 text-center text-graphite/50">
                  لا توجد أصناف مسجلة بعد.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isAdmin && editingItem && (
        <EditItemModal
          item={editingItem}
          warehouses={warehouses}
          onClose={() => setEditingItem(null)}
          onSaved={() => {
            setEditingItem(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function EditItemModal({
  item,
  warehouses,
  onClose,
  onSaved,
}: {
  item: any;
  warehouses: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: item.name || "",
    supplier: item.supplier || "",
    category: item.category || "",
    itemCode: item.itemCode || "",
    barcode: item.barcode || "",
    systemQty: item.systemQty !== undefined ? item.systemQty : 0,
    warehouseId: item.warehouseId || "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.updateItem(item.id, {
        ...form,
        systemQty: Number(form.systemQty),
        warehouseId: form.warehouseId || null,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message || "حدث خطأ أثناء حفظ التعديلات");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-sm border border-graphite/20 shadow-xl max-w-lg w-full p-6 animate-fade-in">
        <h3 className="font-display text-lg font-semibold mb-4 text-ink">تعديل بيانات الصنف والكمية</h3>
        {error && <div className="mb-4 text-xs text-warn bg-warn/5 border border-warn/20 rounded-sm px-3 py-2">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-graphite/70 mb-1">اسم الصنف</label>
            <input
              type="text"
              required
              className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm focus:border-signal"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-graphite/70 mb-1">الرصيد النظري (الكمية)</label>
              <input
                type="number"
                step="any"
                required
                className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm font-mono font-bold text-signal focus:border-signal"
                value={form.systemQty}
                onChange={(e) => setForm({ ...form, systemQty: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-graphite/70 mb-1">المستودع</label>
              <select
                className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm focus:border-signal"
                value={form.warehouseId}
                onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}
              >
                <option value="">عام / غير محدد</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-graphite/70 mb-1">رمز المادة المستودعي</label>
              <input
                type="text"
                className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm font-mono focus:border-signal"
                value={form.itemCode}
                onChange={(e) => setForm({ ...form, itemCode: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-graphite/70 mb-1">الباركود</label>
              <input
                type="text"
                required
                className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm font-mono focus:border-signal"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-graphite/70 mb-1">المورد</label>
              <input
                type="text"
                className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm focus:border-signal"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-graphite/70 mb-1">المجموعة / الفئة</label>
              <input
                type="text"
                className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm focus:border-signal"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4 border-t border-graphite/10 mt-6 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-graphite/20 rounded-sm text-sm text-graphite/70 hover:bg-graphite/5 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-ink text-paper rounded-sm text-sm hover:bg-signal transition-colors disabled:opacity-50 cursor-pointer font-semibold"
            >
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DbImportPanel({
  warehouses,
  selectedWarehouseId,
  onDone,
}: {
  warehouses: any[];
  selectedWarehouseId?: string;
  onDone: () => void;
}) {
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
        warehouseId: selectedWarehouseId || undefined,
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

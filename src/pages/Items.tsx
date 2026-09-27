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
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
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
    setClearingAll(true);
    try {
      await api.clearItems();
      setImportResult("تم تفريغ وحذف جميع الأصناف والوحدات من النظام بنجاح. يمكنك الآن استيراد ملف جديد بالكامل.");
      setShowClearConfirm(false);
      load();
    } catch (err: any) {
      setImportResult("حدث خطأ أثناء حذف الأصناف: " + (err.message || "خطأ غير معروف"));
    } finally {
      setClearingAll(false);
    }
  }

  async function handleDeleteItemConfirm() {
    if (!isAdmin || !itemToDelete) return;
    setDeletingItem(true);
    try {
      await api.deleteItem(itemToDelete.id);
      setImportResult(`تم حذف الصنف (${itemToDelete.name}) نهائياً من النظام.`);
      setItemToDelete(null);
      load();
    } catch (err: any) {
      setImportResult("حدث خطأ أثناء حذف الصنف: " + (err.message || "خطأ غير معروف"));
    } finally {
      setDeletingItem(false);
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
                    onClick={() => setShowClearConfirm(true)}
                    className="bg-warn/10 text-warn border border-warn/20 hover:bg-warn hover:text-paper px-4 py-2 rounded-sm text-sm transition-colors font-semibold cursor-pointer"
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
                        onClick={() => setItemToDelete(it)}
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

      {/* In-App Delete Item Modal */}
      {isAdmin && itemToDelete && (
        <div className="fixed inset-0 bg-ink/75 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-lg border border-warn/30 shadow-2xl max-w-sm w-full p-5 space-y-4">
            <div className="flex items-center gap-3 text-warn">
              <div className="w-10 h-10 rounded-full bg-warn/15 flex items-center justify-center text-xl shrink-0">
                🗑️
              </div>
              <div>
                <h3 className="font-bold text-sm text-ink">تأكيد حذف الصنف</h3>
                <p className="text-[11px] text-graphite/60">حذف نهائي للصنف وبياناته من النظام</p>
              </div>
            </div>

            <div className="bg-paper p-3 rounded border border-graphite/15 text-xs space-y-1">
              <div className="font-bold text-ink text-sm truncate">{itemToDelete.name}</div>
              <div className="text-graphite/70 font-mono text-[11px]">الباركود: {itemToDelete.barcode}</div>
              <div className="text-graphite/60 text-[11px]">الرصيد النظري: {itemToDelete.systemQty}</div>
            </div>

            <p className="text-xs text-graphite/80 font-medium">
              هل أنت متأكد من رغبتك في حذف هذا الصنف نهائياً؟
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-graphite/15">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                disabled={deletingItem}
                className="px-4 py-2 text-xs font-bold border border-graphite/30 rounded hover:bg-graphite/10 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteItemConfirm}
                disabled={deletingItem}
                className="bg-warn hover:bg-ink text-paper px-4 py-2 rounded text-xs font-bold transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <span>{deletingItem ? "جارٍ الحذف..." : "نعم، حذف الصنف"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Clear All Items Modal */}
      {isAdmin && showClearConfirm && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-lg border-2 border-warn shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-warn">
              <div className="w-12 h-12 rounded-full bg-warn/15 flex items-center justify-center text-2xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="font-bold text-base text-ink">تحذير: تفريغ وحذف جميع الأصناف</h3>
                <p className="text-xs text-graphite/60">هذا الإجراء سيقوم بحذف جميع الأصناف والوحدات من النظام</p>
              </div>
            </div>

            <div className="bg-warn/10 p-3.5 rounded border border-warn/30 text-xs text-warn font-semibold space-y-1 leading-relaxed">
              <p>🚨 سيتم مسح جدول الأصناف بالكامل لتتمكن من إعادة الاستيراد النظيف من ملف Excel/CSV وتفادي أي تعارض بالباركود والرمز المحاسبي القديم.</p>
              <p>⚠️ لا يمكن التراجع عن هذا القرار بعد تنفيذه!</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-graphite/15">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={clearingAll}
                className="px-4 py-2 text-xs font-bold border border-graphite/30 rounded hover:bg-graphite/10 cursor-pointer"
              >
                تراجع وإلغاء
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                disabled={clearingAll}
                className="bg-warn hover:bg-ink text-paper px-5 py-2 rounded text-xs font-bold transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <span>{clearingAll ? "جارٍ التفريغ والحذف..." : "تأكيد حذف جميع الأصناف"}</span>
              </button>
            </div>
          </div>
        </div>
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

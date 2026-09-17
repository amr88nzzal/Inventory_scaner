import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function PendingItems() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowStates, setRowStates] = useState<Record<string, any>>({});
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const pendingList = await api.listPendingItems();
      const validList = Array.isArray(pendingList) ? pendingList : [];
      setItems(validList);

      // Initialize row edit states
      const initialStates: Record<string, any> = {};
      validList.forEach((p: any) => {
        initialStates[p.id] = {
          barcode: p.barcode || "",
          name: p.name || "",
          supplier: p.supplier || "",
          category: p.category || "",
          accountNo: p.accountNo || "",
          unitName: p.unitName || "قطعة",
          quantity: p.quantity || 1,
          systemQty: 0,
          price: p.price ? Number(p.price) : "",
          photoProductUrl: p.photoProductUrl || p.photoBarcodeUrl || "",
        };
      });
      setRowStates(initialStates);
    } catch (err: any) {
      setItems([]);
      setStatusMessage({ type: "error", text: "فشل تحميل المواد قيد المراجعة: " + (err.message || "") });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handleFieldChange(id: string, field: string, value: any) {
    setRowStates((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  async function handleApprove(id: string) {
    setBusyId(id);
    setStatusMessage(null);
    const row = rowStates[id] || {};
    try {
      await api.approvePendingItem(id, {
        barcode: row.barcode,
        name: row.name,
        supplier: row.supplier,
        category: row.category,
        accountNo: row.accountNo,
        unitName: row.unitName,
        systemQty: Number(row.systemQty || 0),
        quantity: Number(row.quantity || 1),
        price: row.price ? Number(row.price) : undefined,
        photoProductUrl: row.photoProductUrl,
      });

      setStatusMessage({
        type: "success",
        text: `✅ تم اعتماد المادة (${row.name || row.barcode}) ونقلها إلى سجل المواد والسيستم بنجاح!`,
      });
      load();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "فشل الاعتماد: " + (err.message || "") });
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id: string) {
    if (!confirm("هل أنت متأكد من رفض هذه المادة؟")) return;
    setBusyId(id);
    setStatusMessage(null);
    try {
      await api.rejectPendingItem(id);
      setStatusMessage({ type: "success", text: "تم رفض المادة بنجاح." });
      load();
    } catch (err: any) {
      setStatusMessage({ type: "error", text: "فشل الرفض: " + (err.message || "") });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Banner */}
      <div className="bg-white border border-graphite/15 p-5 rounded-sm shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl md:text-2xl font-bold text-ink flex items-center gap-2">
            <span>📦 مواد قيد المراجعة والاعتماد</span>
            <span className="bg-warn/15 text-warn text-xs px-2.5 py-0.5 rounded-full font-mono font-bold">
              {items.length} صنف معلق
            </span>
          </h1>
          <p className="text-xs md:text-sm text-graphite/70 mt-1">
            الأصناف والمواد التي مسحها الموظفون أثناء الجرد ولم تكن مسجلة بقاعدة البيانات. يمكنك تعديل الحقول، تحديد الكمية الدفترية حسب السيستم، ثم الاعتماد أو الرفض.
          </p>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="bg-paper hover:bg-graphite/10 text-ink border border-graphite/20 px-3.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <span>🔄</span>
          <span>{loading ? "جارٍ التحديث..." : "تحديث القائمة"}</span>
        </button>
      </div>

      {/* Notifications Banner */}
      {statusMessage && (
        <div
          className={`p-3 rounded text-xs font-bold flex items-center justify-between border ${
            statusMessage.type === "success"
              ? "bg-good/10 text-good border-good/20"
              : "bg-warn/10 text-warn border-warn/20"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-graphite/60 hover:text-ink font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Main Table for Admin Reviewing Pending Items */}
      <div className="bg-white border border-graphite/20 rounded-sm shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-graphite/10 text-ink text-xs font-bold border-b border-graphite/20">
                <th className="p-2.5 text-center w-12">#</th>
                <th className="p-2.5 w-16 text-center">الصورة</th>
                <th className="p-2.5 min-w-[140px]">رقم الباركود *</th>
                <th className="p-2.5 min-w-[170px]">اسم المادة *</th>
                <th className="p-2.5 min-w-[120px]">المورد</th>
                <th className="p-2.5 min-w-[120px]">المجموعة</th>
                <th className="p-2.5 min-w-[110px]">الرقم المحاسبي</th>
                <th className="p-2.5 w-24">الوحدة</th>
                <th className="p-2.5 w-24 text-center">كمية الجرد</th>
                <th className="p-2.5 w-28 text-center bg-signal/10 text-signal">الكمية (السيستم)</th>
                <th className="p-2.5 w-24 text-center">السعر</th>
                <th className="p-2.5 min-w-[120px]">المُبلِغ / المكان</th>
                <th className="p-2.5 w-36 text-center sticky left-0 bg-graphite/10 shadow-xs">الإجراء (اعتماد / رفض)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-graphite/15 text-xs">
              {(Array.isArray(items) ? items : []).map((p, idx) => {
                const row = rowStates[p.id] || {};
                const photo = row.photoProductUrl || p.photoProductUrl || p.photoBarcodeUrl;

                return (
                  <tr key={p.id} className="hover:bg-signal/5 transition-colors">
                    {/* Index */}
                    <td className="p-2 text-center font-mono font-bold text-graphite/60">{idx + 1}</td>

                    {/* Photo Thumbnail */}
                    <td className="p-2 text-center">
                      {photo ? (
                        <button
                          type="button"
                          onClick={() => setSelectedPhoto(photo)}
                          className="w-11 h-11 rounded border border-graphite/20 overflow-hidden bg-graphite/5 cursor-pointer hover:opacity-80 transition-opacity mx-auto block"
                          title="انقر لتكبير الصورة"
                        >
                          <img src={photo} alt="صورة المادة" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-graphite/40 italic block text-center">لا توجد</span>
                      )}
                    </td>

                    {/* Barcode Input */}
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border border-graphite/30 rounded px-2 py-1 font-mono font-bold text-xs bg-white focus:border-signal"
                        value={row.barcode ?? ""}
                        onChange={(e) => handleFieldChange(p.id, "barcode", e.target.value)}
                      />
                    </td>

                    {/* Item Name Input */}
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border border-graphite/30 rounded px-2 py-1 font-bold text-xs bg-white text-ink focus:border-signal"
                        value={row.name ?? ""}
                        placeholder="اسم المادة..."
                        onChange={(e) => handleFieldChange(p.id, "name", e.target.value)}
                      />
                    </td>

                    {/* Supplier Input */}
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border border-graphite/30 rounded px-2 py-1 text-xs bg-white focus:border-signal"
                        value={row.supplier ?? ""}
                        placeholder="المورد..."
                        onChange={(e) => handleFieldChange(p.id, "supplier", e.target.value)}
                      />
                    </td>

                    {/* Category Input */}
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border border-graphite/30 rounded px-2 py-1 text-xs bg-white focus:border-signal"
                        value={row.category ?? ""}
                        placeholder="المجموعة..."
                        onChange={(e) => handleFieldChange(p.id, "category", e.target.value)}
                      />
                    </td>

                    {/* Account No / SKU Input */}
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full border border-graphite/30 rounded px-2 py-1 font-mono text-xs bg-white focus:border-signal"
                        value={row.accountNo ?? ""}
                        placeholder="كود الحسابات..."
                        onChange={(e) => handleFieldChange(p.id, "accountNo", e.target.value)}
                      />
                    </td>

                    {/* Unit Name Select */}
                    <td className="p-2">
                      <select
                        className="w-full border border-graphite/30 rounded px-1.5 py-1 text-xs font-bold bg-white"
                        value={row.unitName ?? "قطعة"}
                        onChange={(e) => handleFieldChange(p.id, "unitName", e.target.value)}
                      >
                        <option value="قطعة">قطعة</option>
                        <option value="صندوق">صندوق</option>
                        <option value="كرتونة">كرتونة</option>
                        <option value="طرد">طرد</option>
                        <option value="كيلو">كيلو</option>
                        <option value="جرام">جرام</option>
                        <option value="لتر">لتر</option>
                        <option value="متر">متر</option>
                      </select>
                    </td>

                    {/* Counted Quantity (Reported by Employee) */}
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        step="any"
                        className="w-full border border-graphite/30 rounded px-1.5 py-1 text-xs font-mono font-bold text-center bg-graphite/5 text-ink"
                        value={row.quantity ?? 1}
                        onChange={(e) => handleFieldChange(p.id, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* System Quantity Input (Set by Admin) */}
                    <td className="p-2 text-center bg-signal/5">
                      <input
                        type="number"
                        step="any"
                        className="w-full border-2 border-signal/40 rounded px-1.5 py-1 text-xs font-mono font-bold text-center bg-white text-signal focus:border-signal"
                        value={row.systemQty ?? 0}
                        placeholder="0"
                        onChange={(e) => handleFieldChange(p.id, "systemQty", parseFloat(e.target.value) || 0)}
                      />
                    </td>

                    {/* Price Input */}
                    <td className="p-2 text-center">
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border border-graphite/30 rounded px-1.5 py-1 text-xs font-mono text-center bg-white"
                        value={row.price ?? ""}
                        placeholder="0.00"
                        onChange={(e) => handleFieldChange(p.id, "price", e.target.value)}
                      />
                    </td>

                    {/* Reporter & Location */}
                    <td className="p-2 text-[11px] leading-tight">
                      <div className="font-bold text-ink">{p.reportedBy?.name || "موظف الجرد"}</div>
                      <div className="text-graphite/60 font-mono text-[10px]">{p.location || "رف غير محدد"}</div>
                    </td>

                    {/* End of Row Action Buttons (الاعتماد والرفض بنهاية السطر) */}
                    <td className="p-2 text-center sticky left-0 bg-white/95 backdrop-blur-xs border-r border-graphite/15">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Approve Button */}
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleApprove(p.id)}
                          className="bg-good hover:bg-ink text-white px-3 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer shadow-xs flex items-center gap-1"
                          title="اعتماد المادة وإضافتها للسيستم"
                        >
                          <span>✓</span>
                          <span>{busyId === p.id ? "جارٍ..." : "اعتماد"}</span>
                        </button>

                        {/* Reject Button */}
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleReject(p.id)}
                          className="bg-white hover:bg-warn/10 text-warn border border-warn/40 px-2.5 py-1.5 rounded text-xs font-bold transition-colors cursor-pointer"
                          title="رفض المادة"
                        >
                          <span>✕</span>
                          <span>رفض</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-8 text-center text-graphite/50 text-sm">
                    🎉 لا توجد مواد معلقة قيد المراجعة حالياً. كافة قراءات الجرد متطابقة ومسجلة مع قاعدة البيانات!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Photo Modal Preview */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-xs z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-md p-3 shadow-2xl max-w-lg w-full space-y-3 relative text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-graphite/15 pb-2">
              <h3 className="font-bold text-xs md:text-sm text-ink flex items-center gap-1.5">
                <span>📸 معاينة صورة المادة والباركود المرفقة</span>
              </h3>
              <button
                onClick={() => setSelectedPhoto(null)}
                className="text-graphite/50 hover:text-ink font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[75vh] overflow-hidden rounded border border-graphite/20 bg-graphite/5 flex items-center justify-center">
              <img src={selectedPhoto} alt="صورة مكبرة" className="max-h-[70vh] w-auto object-contain" />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="bg-ink text-paper px-4 py-1.5 rounded text-xs font-bold cursor-pointer"
              >
                إغلاق ✕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

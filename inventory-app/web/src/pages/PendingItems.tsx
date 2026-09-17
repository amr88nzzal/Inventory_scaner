import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function PendingItems() {
  const [items, setItems] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setItems(await api.listPendingItems());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.approvePendingItem(id);
      load();
    } finally {
      setBusyId(null);
    }
  }
  async function handleReject(id: string) {
    setBusyId(id);
    try {
      await api.rejectPendingItem(id);
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold mb-2">مواد قيد المراجعة</h1>
      <p className="text-sm text-graphite/60 mb-8">
        باركودات مُسحت أثناء الجرد ولم تُطابق أي صنف مسجّل في قاعدة البيانات.
      </p>

      <div className="space-y-4">
        {items.map((p) => (
          <div key={p.id} className="border border-graphite/15 rounded-sm bg-white p-4 flex items-center gap-4">
            <div className="flex gap-2">
              {p.photoProductUrl && (
                <img src={p.photoProductUrl} alt="صورة المنتج" className="w-16 h-16 object-cover rounded-sm border border-graphite/10" />
              )}
              {p.photoBarcodeUrl && (
                <img src={p.photoBarcodeUrl} alt="صورة الباركود" className="w-16 h-16 object-cover rounded-sm border border-graphite/10" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-mono text-sm">{p.barcode}</div>
              <div className="text-sm">{p.name || "بدون اسم"}</div>
              <div className="text-xs text-graphite/60 mt-1">
                أبلغ عنها: {p.reportedBy?.name} {p.price ? `· السعر: ${p.price}` : ""} {p.quantity ? `· الكمية: ${p.quantity}` : ""}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleApprove(p.id)}
                disabled={busyId === p.id}
                className="text-xs bg-good text-white px-3 py-1.5 rounded-sm hover:opacity-90 transition-opacity"
              >
                اعتماد
              </button>
              <button
                onClick={() => handleReject(p.id)}
                disabled={busyId === p.id}
                className="text-xs border border-warn text-warn px-3 py-1.5 rounded-sm hover:bg-warn/5 transition-colors"
              >
                رفض
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && <div className="text-graphite/50 text-sm">لا توجد مواد قيد المراجعة حالياً</div>}
      </div>
    </div>
  );
}

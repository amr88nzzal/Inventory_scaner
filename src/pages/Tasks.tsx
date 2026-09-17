import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { StatusBadge } from "./DashboardHome";
import { useAuth } from "../context/AuthContext";
import CameraScanner from "../components/CameraScanner";
import { playSuccessBeep, playErrorBeep } from "../lib/audio";

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [reportSummaries, setReportSummaries] = useState<Record<string, any>>({});
  const [activeCountTask, setActiveCountTask] = useState<any | null>(null);

  async function load() {
    try {
      if (user?.role === "EMPLOYEE") {
        const myTasks = await api.listMyTasks();
        setTasks(Array.isArray(myTasks) ? myTasks : []);
      } else {
        const [taskList, warehouseList, userList, itemList] = await Promise.all([
          api.listTasks().catch(() => []),
          api.listWarehouses().catch(() => []),
          api.listUsers().catch(() => []),
          api.listItems().catch(() => []),
        ]);
        setTasks(Array.isArray(taskList) ? taskList : []);
        setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
        setEmployees(Array.isArray(userList) ? userList.filter((u: any) => u && u.role !== "ADMIN") : []);
        setItems(Array.isArray(itemList) ? itemList : []);
      }
    } catch (err: any) {
      console.error(err);
      setTasks([]);
    }
  }
  useEffect(() => {
    load();
  }, [user]);

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
        <div>
          <h1 className="font-display text-2xl font-semibold">
            {user?.role === "EMPLOYEE" ? "📋 مهام الجرد المسندة لي" : "إدارة مهام الجرد"}
          </h1>
          {user?.role === "EMPLOYEE" && (
            <p className="text-xs text-graphite/60 mt-1">
              اختر المهمة المسندة إليك للبدء في مسح وتجميع فئات الجرد للرفوف والأقسام المحددة.
            </p>
          )}
        </div>
        {user?.role === "ADMIN" && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-ink text-paper px-4 py-2 rounded-sm text-sm hover:bg-signal transition-colors font-semibold shadow-xs cursor-pointer"
          >
            {showForm ? "إلغاء" : "➕ إسناد مهمة جديدة"}
          </button>
        )}
      </div>

      {showForm && user?.role === "ADMIN" && (
        <TaskForm
          warehouses={warehouses}
          employees={employees}
          items={items}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="space-y-4">
        {(Array.isArray(tasks) ? tasks : []).map((t) => {
          const summary = reportSummaries[t.id];
          return (
            <div key={t.id} className="border border-graphite/15 rounded-sm bg-white p-5 shadow-xs">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-lg text-ink">{t.taskNumber}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="text-sm text-graphite/70 mt-2 space-y-1">
                    <div>
                      <span className="text-xs text-graphite/50">المستودع: </span>
                      <span className="font-bold text-ink">{t.warehouse?.name}</span>
                      {t.locationScope && (
                        <span className="bg-signal/15 text-signal text-xs font-semibold px-2 py-0.5 rounded-sm mr-2 inline-block">
                          🎯 موقع/رفوف الجرد: {t.locationScope}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-xs text-graphite/50">الموظفون المسندون: </span>
                      <span className="font-medium text-ink">
                        {t.assignees?.map((a: any) => a.user?.name).join("، ") || "لم يعين أحد"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Employee Count Trigger */}
                  <button
                    onClick={() => setActiveCountTask(t)}
                    className="bg-signal text-paper px-4 py-2 rounded-sm text-sm font-bold hover:bg-ink transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>🔍</span>
                    <span>بدء / تنفيذ عملية الجرد</span>
                  </button>

                  {user?.role === "ADMIN" && t.status !== "APPROVED" && (
                    <button
                      onClick={() => handleGenerate(t.id)}
                      disabled={generating === t.id}
                      className="text-xs border border-graphite/30 px-3 py-2 rounded-sm hover:border-signal transition-colors font-semibold cursor-pointer"
                    >
                      {generating === t.id ? "جارٍ التوليد..." : "توليد التقرير النهائي"}
                    </button>
                  )}
                </div>
              </div>

              {summary && (
                <div className="mt-4 border-t border-graphite/10 pt-3">
                  <table className="w-full text-xs">
                    <thead className="text-graphite/60 bg-graphite/5">
                      <tr>
                        <th className="text-right py-1.5 px-2">الباركود</th>
                        <th className="text-right py-1.5 px-2">اسم الصنف</th>
                        {t.showVarianceAtEnd && <th className="text-right py-1.5 px-2">الفرق</th>}
                        <th className="text-right py-1.5 px-2">إعادة عد؟</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.summary.map((row: any, i: number) => (
                        <tr key={i} className="border-t border-graphite/5">
                          <td className="py-1.5 px-2 font-mono">{row.barcode}</td>
                          <td className="py-1.5 px-2">{row.name}</td>
                          {t.showVarianceAtEnd && (
                            <td className={`py-1.5 px-2 font-mono font-bold ${row.flaggedForRecount ? "text-warn" : "text-good"}`}>
                              {row.varianceQty} ({row.variancePct?.toFixed?.(1)}%)
                            </td>
                          )}
                          <td className="py-1.5 px-2">{row.flaggedForRecount ? "⚠️ نعم" : "لا"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {summary.report?.id && (
                    <a href={api.reportCsvUrl(summary.report.id)} className="text-signal text-xs mt-2 inline-block hover:underline font-bold">
                      📥 تنزيل تقرير الفروقات CSV
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="text-graphite/50 text-sm bg-white border border-graphite/15 p-8 text-center rounded-sm">
            {user?.role === "EMPLOYEE"
              ? "لا توجد مهام جرد مسندة لك حالياً. يُرجى مراجعة مسؤول النظام."
              : "لا توجد مهام جرد مضافة بعد."}
          </div>
        )}
      </div>

      {activeCountTask && (
        <AuditCounterModal
          task={activeCountTask}
          onClose={() => setActiveCountTask(null)}
          onScanDone={() => load()}
        />
      )}
    </div>
  );
}

function TaskForm({
  warehouses,
  employees,
  items,
  onCreated,
}: {
  warehouses: any[];
  employees: any[];
  items: any[];
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    warehouseId: "",
    taskNumber: "",
    assigneeUserIds: [] as string[],
    scopeType: "ALL" as "ALL" | "CATEGORY" | "SUPPLIER" | "ITEM_LIST",
    scopeValue: "",
    locationScope: "",
    startTime: "",
    blindCount: false,
    showVarianceAtEnd: true,
    generalRecountTolerancePct: 10,
    aggregateAcrossLocations: true,
  });
  const [saving, setSaving] = useState(false);
  const [showLocationsDropdown, setShowLocationsDropdown] = useState(false);

  // Compute unique suppliers and categories loaded from items
  const uniqueSuppliers = Array.from(new Set(items.map((it) => it.supplier).filter(Boolean))) as string[];
  const uniqueCategories = Array.from(new Set(items.map((it) => it.category).filter(Boolean))) as string[];

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
          <label className="block text-xs text-graphite/60 mb-1 font-bold">رقم المهمة</label>
          <input
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm font-mono mb-3"
            value={form.taskNumber}
            onChange={(e) => setForm({ ...form, taskNumber: e.target.value })}
            required
          />

          <label className="block text-xs text-graphite/60 mb-1 font-bold">المستودع</label>
          <select
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3"
            value={form.warehouseId}
            onChange={(e) => setForm({ ...form, warehouseId: e.target.value, locationScope: "" })}
            required
          >
            <option value="">اختر مستودعاً</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <label className="block text-xs text-graphite/60 mb-1 font-bold">موقع الجرد المحدد (الرفوف/الأقسام المحددة)</label>
          {(() => {
            const selectedWarehouse = warehouses.find((w) => w.id === form.warehouseId);
            const warehouseLocations = selectedWarehouse?.locations || [];
            if (warehouseLocations.length > 0) {
              return (
                <div className="relative mb-3">
                  <button
                    type="button"
                    onClick={() => setShowLocationsDropdown(!showLocationsDropdown)}
                    className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm bg-white text-right flex items-center justify-between focus:border-signal"
                  >
                    <span className="truncate">
                      {form.locationScope || "اختر الأقسام/الرفوف المسجلة..."}
                    </span>
                    <span className="text-graphite/40 text-xs">▼</span>
                  </button>

                  {showLocationsDropdown && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowLocationsDropdown(false)} />
                      <div className="absolute right-0 left-0 mt-1 border border-graphite/15 bg-white rounded-sm shadow-lg max-h-[160px] overflow-y-auto z-20 p-2 space-y-1">
                        {warehouseLocations.map((loc: any) => {
                          const selectedLabels = form.locationScope ? form.locationScope.split(" + ") : [];
                          const isChecked = selectedLabels.includes(loc.label);
                          return (
                            <label
                              key={loc.id}
                              className="flex items-center gap-2 text-xs p-1.5 hover:bg-graphite/5 rounded-xs cursor-pointer select-none font-medium text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                className="rounded-xs text-signal focus:ring-signal"
                                onChange={() => {
                                  let newList = [...selectedLabels];
                                  if (isChecked) {
                                    newList = newList.filter((l) => l !== loc.label);
                                  } else {
                                    newList = [...newList, loc.label];
                                  }
                                  setForm({ ...form, locationScope: newList.join(" + ") });
                                }}
                              />
                              <span>{loc.label}</span>
                              {isChecked && <span className="text-signal mr-auto font-bold">✓</span>}
                            </label>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            } else {
              return (
                <input
                  type="text"
                  placeholder={form.warehouseId ? "لا توجد أقسام مسجلة لهذا المستودع — اكتبها يدوياً هنا" : "يرجى اختيار المستودع أولاً"}
                  disabled={!form.warehouseId}
                  className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3 focus:border-signal disabled:bg-graphite/5"
                  value={form.locationScope}
                  onChange={(e) => setForm({ ...form, locationScope: e.target.value })}
                />
              );
            }
          })()}

          <label className="block text-xs text-graphite/60 mb-1 font-bold">وقت البدء</label>
          <input
            type="datetime-local"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-xs text-graphite/60 mb-1 font-bold">الموظفون المسندون</label>
          <div className="space-y-1 mb-3 border border-graphite/10 p-3 rounded-sm max-h-[140px] overflow-y-auto">
            {employees.map((emp) => (
              <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input type="checkbox" checked={form.assigneeUserIds.includes(emp.id)} onChange={() => toggleAssignee(emp.id)} />
                {emp.name}
              </label>
            ))}
            {employees.length === 0 && (
              <div className="text-xs text-warn bg-warn/5 border border-warn/15 rounded-sm p-2 font-medium">
                ⚠️ لا يوجد موظفو جرد مضافون حالياً في قاعدة البيانات. 
                <p className="mt-1">يرجى إضافة موظفين أولاً من قسم "الموظفون" في القائمة الجانبية لتتمكن من إسناد المهمة إليهم.</p>
              </div>
            )}
          </div>

          <label className="block text-xs text-graphite/60 mb-1 font-bold">نطاق الأصناف</label>
          <select
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3"
            value={form.scopeType}
            onChange={(e) => setForm({ ...form, scopeType: e.target.value as any, scopeValue: "" })}
          >
            <option value="ALL">كل الأصناف</option>
            <option value="CATEGORY">مجموعة أو فئة محددة</option>
            <option value="SUPPLIER">مورّد محدد</option>
            <option value="ITEM_LIST">قائمة أصناف محددة</option>
          </select>

          {form.scopeType === "SUPPLIER" && (
            <div>
              <label className="block text-xs text-graphite/60 mb-1">اختر المورّد من القائمة</label>
              {uniqueSuppliers.length > 0 ? (
                <select
                  className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3 focus:border-signal"
                  value={form.scopeValue}
                  onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
                  required
                >
                  <option value="">اختر المورّد...</option>
                  {uniqueSuppliers.map((sup) => (
                    <option key={sup} value={sup}>{sup}</option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-warn mb-3">⚠️ لم يتم استيراد أي موردين بعد. يرجى رفع ملف الأصناف أولاً.</div>
              )}
            </div>
          )}

          {form.scopeType === "CATEGORY" && (
            <div>
              <label className="block text-xs text-graphite/60 mb-1">اختر المجموعة / الفئة</label>
              {uniqueCategories.length > 0 ? (
                <select
                  className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3 focus:border-signal"
                  value={form.scopeValue}
                  onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
                  required
                >
                  <option value="">اختر الفئة / المجموعة...</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-warn mb-3">⚠️ لم يتم استيراد أي مجموعات بعد. يرجى رفع ملف الأصناف أولاً.</div>
              )}
            </div>
          )}

          {form.scopeType === "ITEM_LIST" && (
            <input
              placeholder="معرّفات الأصناف مفصولة بفاصلة"
              className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3 font-mono"
              value={form.scopeValue}
              onChange={(e) => setForm({ ...form, scopeValue: e.target.value })}
              required
            />
          )}

          <label className="block text-xs text-graphite/60 mb-1 font-bold">نسبة تفاوت إعادة العد العامة (%)</label>
          <input
            type="number"
            className="w-full border border-graphite/20 rounded-sm px-3 py-2 text-sm mb-3 font-mono"
            value={form.generalRecountTolerancePct}
            onChange={(e) => setForm({ ...form, generalRecountTolerancePct: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={form.blindCount} onChange={(e) => setForm({ ...form, blindCount: e.target.checked })} />
            جرد أعمى (إخفاء الرصيد النظري عن الموظف)
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input type="checkbox" checked={form.showVarianceAtEnd} onChange={(e) => setForm({ ...form, showVarianceAtEnd: e.target.checked })} />
            إظهار الفوارق عند نهاية الجرد
          </label>
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
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
        className="mt-6 bg-ink text-paper px-6 py-2 rounded-sm text-sm hover:bg-signal transition-colors disabled:opacity-40 font-bold cursor-pointer"
      >
        {saving ? "جارٍ الإسناد..." : "إسناد المهمة"}
      </button>
    </form>
  );
}

function AuditCounterModal({
  task,
  onClose,
  onScanDone,
}: {
  task: any;
  onClose: () => void;
  onScanDone: () => void;
}) {
  // Assigned warehouse strictly locked to task
  const assignedWarehouseId = task.warehouseId;
  const assignedWarehouseName = task.warehouse?.name || "المستودع المخصص بالمهمة";

  // Derive assigned shelves strictly from the task scope and warehouse locations
  const assignedTaskShelves = React.useMemo(() => {
    const list: string[] = [];

    if (task.locationScope) {
      const parts = task.locationScope
        .split(/[\+\,\n]/)
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0 && s !== "جميع الرفوف");
      list.push(...parts);
    }

    if (task.warehouse?.locations?.length > 0) {
      task.warehouse.locations.forEach((l: any) => {
        if (l.name && !list.includes(l.name)) {
          list.push(l.name);
        }
      });
    }

    if (list.length === 0) {
      if (task.locationScope && task.locationScope !== "جميع الرفوف") {
        list.push(task.locationScope);
      } else {
        list.push("رف 1", "رف 2", "رف 3");
      }
    }

    return Array.from(new Set(list));
  }, [task]);

  const [activeLocation, setActiveLocation] = useState<string>(
    assignedTaskShelves[0] || "رف 1"
  );

  // Camera Barcode Scanner State
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  // Search & input state
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [selectedUnitName, setSelectedUnitName] = useState<string>("قطعة");
  const [selectedQtyPerUnit, setSelectedQtyPerUnit] = useState<number>(1);
  const [entryQty, setEntryQty] = useState<number>(1);
  const [condition, setCondition] = useState<"NORMAL" | "DAMAGED">("NORMAL");
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Comprehensive Edit Modal State
  const [editingScan, setEditingScan] = useState<any | null>(null);
  const [editLocation, setEditLocation] = useState<string>("");
  const [editQty, setEditQty] = useState<number>(1);
  const [editCondition, setEditCondition] = useState<"NORMAL" | "DAMAGED">("NORMAL");
  const [editPhotoUrl, setEditPhotoUrl] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Status & notifications
  const [savingScan, setSavingScan] = useState(false);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [showFinalSubmitConfirmModal, setShowFinalSubmitConfirmModal] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [recentScans, setRecentScans] = useState<any[]>([]);

  // Unknown item reporting state
  const [showPendingForm, setShowPendingForm] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [pendingSupplier, setPendingSupplier] = useState("");
  const [pendingCategory, setPendingCategory] = useState("");
  const [pendingAccountNo, setPendingAccountNo] = useState("");
  const [pendingUnitName, setPendingUnitName] = useState("قطعة");
  const [pendingQty, setPendingQty] = useState(1);
  const [pendingPhotoUrl, setPendingPhotoUrl] = useState("");

  const inputRef = React.useRef<HTMLInputElement>(null);

  async function loadRecent() {
    try {
      const scans = await api.getRecentScans(task.id);
      setRecentScans(scans);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadRecent();
  }, [task.id]);

  // Search by query (barcode or name)
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSelectedItem(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.searchItems(query.trim());
        setSearchResults(results);
        if (results.length === 1 && results[0].barcode === query.trim()) {
          setSelectedItem(results[0]);
          const baseUnit = results[0].units?.[0];
          setSelectedUnitName(baseUnit?.unitName || "قطعة");
          setSelectedQtyPerUnit(baseUnit?.qtyPerUnit || 1);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle Enter key for fast scanning or name entry
  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setMessage(null);
    setSavingScan(true);

    try {
      let targetItem = selectedItem;

      if (!targetItem) {
        if (searchResults.length > 0) {
          targetItem = searchResults[0];
        } else {
          try {
            targetItem = await api.getBarcodeItem(query.trim());
          } catch {
            targetItem = null;
          }
        }
      }

      if (!targetItem) {
        playErrorBeep();
        setPendingBarcode(query.trim());
        setPendingName(query.trim());
        setPendingQty(entryQty || 1);
        setShowPendingForm(true);
        setSavingScan(false);
        return;
      }

      const unitName = selectedUnitName || targetItem.units?.[0]?.unitName || "قطعة";
      const qtyPerUnit = selectedQtyPerUnit || targetItem.units?.[0]?.qtyPerUnit || 1;

      await api.recordScan({
        taskId: task.id,
        itemId: targetItem.id,
        barcodeScanned: targetItem.barcode,
        locationLabel: activeLocation || assignedTaskShelves[0] || "رف 1",
        unitName,
        qtyInUnit: Number(entryQty || 1),
        qtyPerUnit: Number(qtyPerUnit),
        condition,
        photoUrl: photoUrl.trim() || undefined,
        deviceTimestamp: new Date().toISOString(),
      });

      playSuccessBeep();

      setMessage({
        type: "success",
        text: `✅ تم إضافة: ${targetItem.name} (${entryQty} ${unitName}) في [${activeLocation}]`,
      });

      setQuery("");
      setSearchResults([]);
      setSelectedItem(null);
      setEntryQty(1);
      setPhotoUrl("");
      setNotes("");
      loadRecent();
      onScanDone();

      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      setMessage({ type: "error", text: "فشل حفظ قراءة الجرد: " + (err.message || "") });
    } finally {
      setSavingScan(false);
    }
  }

  function handlePendingPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPendingPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Submit pending unknown item with all details
  async function handleSavePending(e: React.FormEvent) {
    e.preventDefault();
    setSavingScan(true);
    try {
      await api.reportPendingItem({
        taskId: task.id,
        barcode: pendingBarcode.trim(),
        name: pendingName.trim(),
        supplier: pendingSupplier.trim() || undefined,
        category: pendingCategory.trim() || undefined,
        accountNo: pendingAccountNo.trim() || undefined,
        unitName: pendingUnitName.trim() || "قطعة",
        quantity: pendingQty || 1,
        location: activeLocation,
        photoProductUrl: pendingPhotoUrl || undefined,
      });

      setMessage({
        type: "success",
        text: `📤 تم إرسال الصنف غير المعرّف (${pendingName}) بكافة بياناته وصورته للإدارة للمراجعة والاعتماد!`,
      });

      setShowPendingForm(false);
      setQuery("");
      setPendingBarcode("");
      setPendingName("");
      setPendingSupplier("");
      setPendingCategory("");
      setPendingAccountNo("");
      setPendingUnitName("قطعة");
      setPendingQty(1);
      setPendingPhotoUrl("");
      loadRecent();
      onScanDone();
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      setMessage({ type: "error", text: "فشل الإرسال: " + (err.message || "") });
    } finally {
      setSavingScan(false);
    }
  }

  // Quick increment / decrement quantity
  async function handleAdjustQty(sc: any, delta: number) {
    const newQty = sc.qtyInUnit + delta;
    if (newQty <= 0) {
      handleDeleteScan(sc.id);
      return;
    }
    try {
      await api.updateScanRecord(sc.id, { qtyInUnit: newQty });
      loadRecent();
      onScanDone();
    } catch (err: any) {
      setMessage({ type: "error", text: "فشل التحديث: " + (err.message || "") });
    }
  }

  // Delete scan
  async function handleDeleteScan(id: string) {
    if (!confirm("هل أنت تأكد من إزالة هذه القراءة من الجرد؟")) return;
    try {
      await api.deleteScanRecord(id);
      loadRecent();
      onScanDone();
    } catch (err: any) {
      setMessage({ type: "error", text: "فشل الحذف: " + (err.message || "") });
    }
  }

  // Open full edit modal
  function openEditModal(sc: any) {
    setEditingScan(sc);
    setEditLocation(sc.locationLabel || sc.location || assignedTaskShelves[0] || "رف 1");
    setEditQty(sc.qtyInUnit);
    setEditCondition(sc.condition || "NORMAL");
    setEditPhotoUrl(sc.photoUrl || "");
    setEditNotes(sc.notes || "");
  }

  // Save full edit modal
  async function handleSaveFullEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingScan) return;
    setSavingEdit(true);
    try {
      await api.updateScanRecord(editingScan.id, {
        qtyInUnit: Number(editQty),
        locationLabel: editLocation,
        condition: editCondition,
        photoUrl: editPhotoUrl.trim() || undefined,
        notes: editNotes.trim() || undefined,
      });

      setMessage({ type: "success", text: `✅ تم تعديل بيانات قراءة الصنف (${editingScan.item?.name || "الصنف"}) بنجاح!` });
      setEditingScan(null);
      loadRecent();
      onScanDone();
      setTimeout(() => inputRef.current?.focus(), 100);
    } catch (err: any) {
      setMessage({ type: "error", text: "فشل التعديل: " + (err.message || "") });
    } finally {
      setSavingEdit(false);
    }
  }

  // Handle Finish Audit Temporarily
  async function handleFinishTemporarily() {
    setSubmittingTask(true);
    try {
      await api.updateTaskStatus(task.id, "IN_PROGRESS");
      onScanDone();
      onClose();
    } catch (err: any) {
      setMessage({ type: "error", text: "فشل الحفظ المؤقت: " + (err.message || "") });
    } finally {
      setSubmittingTask(false);
    }
  }

  // Handle Confirm Final Audit Submission to Management
  async function handleConfirmSubmitFinalAudit() {
    setSubmittingTask(true);
    try {
      await api.updateTaskStatus(task.id, "PENDING_REVIEW");
      setShowFinalSubmitConfirmModal(false);
      onScanDone();
      onClose();
    } catch (err: any) {
      setMessage({ type: "error", text: "فشل رفع الجرد للإدارة: " + (err.message || "") });
    } finally {
      setSubmittingTask(false);
    }
  }

  // Main Photo Upload Handler
  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // Edit Modal Photo Upload Handler
  function handleEditPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setEditPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  // State for collapsible warehouse/shelf bar on mobile
  const [showLocationDetails, setShowLocationDetails] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-paper flex flex-col h-screen w-screen overflow-hidden text-right" dir="rtl">
      {/* Top Header: Task info & Collapsible Warehouse/Shelf display */}
      <div className="bg-ink text-paper px-4 md:px-6 py-2.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 shadow-md shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-signal text-paper px-2.5 py-0.5 rounded-sm text-xs font-mono font-bold">
            {task.taskNumber}
          </div>
          <div>
            <h2 className="font-display font-bold text-base md:text-lg text-white leading-tight">تنفيذ الجرد الفعلي</h2>
            <div className="text-[11px] text-white/80 flex items-center gap-1 mt-0.5">
              <span>📍 الرف الحالي:</span>
              <strong className="text-signal bg-white/10 px-1.5 py-0.2 rounded font-mono">{activeLocation}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle Warehouse & Shelf details button (Especially useful for mobile) */}
          <button
            type="button"
            onClick={() => setShowLocationDetails((v) => !v)}
            className="bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1.5 rounded-sm flex items-center gap-1 font-semibold border border-white/15 cursor-pointer"
          >
            <span>🏢 المستودع والرف</span>
            <span>{showLocationDetails ? "▲" : "▼"}</span>
          </button>

          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-sm text-xs md:text-sm transition-colors cursor-pointer"
          >
            إغلاق ✕
          </button>
        </div>

        {/* Collapsible Location & Shelf Details Panel */}
        {showLocationDetails && (
          <div className="w-full bg-white/10 p-2.5 rounded-sm border border-white/15 mt-1 flex flex-wrap items-center justify-between gap-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-white/70 font-semibold">🏢 المستودع المسند:</span>
              <span className="bg-ink border border-white/30 text-white rounded-xs px-2 py-0.5 font-bold">
                {assignedWarehouseName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-white/70 font-semibold">📍 الرف / الموقع:</span>
              <select
                className="bg-ink border border-white/30 text-white rounded-xs px-2 py-1 font-bold focus:border-signal cursor-pointer"
                value={activeLocation}
                onChange={(e) => setActiveLocation(e.target.value)}
              >
                {assignedTaskShelves.map((loc) => (
                  <option key={loc} value={loc}>📍 {loc}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 max-w-7xl mx-auto w-full">
        {message && (
          <div
            className={`p-2.5 rounded-sm text-xs font-bold flex items-center justify-between shadow-xs ${
              message.type === "success"
                ? "bg-good/15 text-good border border-good/30"
                : "bg-warn/15 text-warn border border-warn/30"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="font-bold opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Fast Ergonomic Scan & Search Entry Section (Compact layout for mobile) */}
        <div className="bg-white p-3 md:p-5 rounded-sm border border-graphite/20 shadow-md">
          <form onSubmit={handleFormSubmit} className="space-y-2.5">
            {/* Primary Entry Row: Barcode & Camera Scan & Immediate Save Button */}
            <div className="flex items-stretch gap-1.5 md:gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  placeholder="امسح الباركود أو اكتب اسم المادة..."
                  className="w-full border-2 border-graphite/30 rounded-sm px-2.5 py-1.5 md:px-3 md:py-2 text-xs md:text-base font-mono font-bold focus:border-signal focus:outline-none bg-paper/30"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />

                {/* Autocomplete Dropdown Menu */}
                {query.trim().length > 0 && searchResults.length > 0 && !selectedItem && (
                  <div className="absolute right-0 left-0 mt-1 bg-white border border-graphite/20 rounded-sm shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-graphite/10">
                    {searchResults.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setQuery(item.name);
                          const baseUnit = item.units?.[0];
                          setSelectedUnitName(baseUnit?.unitName || "قطعة");
                          setSelectedQtyPerUnit(baseUnit?.qtyPerUnit || 1);
                        }}
                        className="p-2.5 hover:bg-signal/5 cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-bold text-ink text-xs md:text-sm">{item.name}</div>
                          <div className="text-graphite/60 font-mono text-[11px] mt-0.5">
                            الباركود: {item.barcode}
                          </div>
                        </div>
                        <span className="bg-signal text-paper px-2 py-0.5 rounded text-[10px] font-bold">
                          اختر ↵
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Camera Scanner Button */}
              <button
                type="button"
                onClick={() => setShowCameraScanner(true)}
                className="bg-ink hover:bg-signal text-paper px-2.5 md:px-3 py-1.5 rounded-sm text-xs font-bold transition-colors flex items-center justify-center gap-1 shrink-0 cursor-pointer shadow-xs border border-white/20"
                title="مسح الباركود باستخدام كاميرا الهاتف"
              >
                <span>📷</span>
                <span className="hidden sm:inline">كاميرا</span>
              </button>

              {/* Immediate Save Button right next to search for no scrolling */}
              <button
                type="submit"
                disabled={savingScan || !query.trim()}
                className="bg-signal text-paper px-3 md:px-8 py-1.5 rounded-sm text-xs md:text-base font-bold hover:bg-ink transition-colors disabled:opacity-40 cursor-pointer shadow-md flex items-center justify-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>💾</span>
                <span>{savingScan ? "جارٍ..." : "تخزين ↵"}</span>
              </button>
            </div>

            {/* Live Mobile Camera Scanner Modal */}
            {showCameraScanner && (
              <CameraScanner
                taskId={task.id}
                activeShelf={activeLocation || assignedTaskShelves[0] || "رف 1"}
                assignedWarehouseName={assignedWarehouseName}
                onScanDone={loadRecent}
                onClose={() => setShowCameraScanner(false)}
              />
            )}

            {/* Secondary Compact Row: Quantity, Unit, Condition, Photo */}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2 text-xs items-center">
              <div>
                <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">الكمية</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  className="w-full border border-graphite/30 rounded-sm px-2 py-1 text-sm font-mono font-bold text-signal text-center focus:border-signal bg-white"
                  value={entryQty}
                  onChange={(e) => setEntryQty(parseFloat(e.target.value) || 1)}
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">الوحدة</label>
                <select
                  className="w-full border border-graphite/30 rounded-sm px-2 py-1 text-xs font-bold focus:border-signal bg-white"
                  value={selectedUnitName}
                  onChange={(e) => {
                    setSelectedUnitName(e.target.value);
                    const u = selectedItem?.units?.find((x: any) => x.unitName === e.target.value);
                    if (u) setSelectedQtyPerUnit(u.qtyPerUnit);
                  }}
                >
                  {selectedItem?.units?.map((u: any) => (
                    <option key={u.id || u.unitName} value={u.unitName}>
                      {u.unitName} ({u.qtyPerUnit})
                    </option>
                  ))}
                  {(!selectedItem || !selectedItem.units?.length) && (
                    <option value="قطعة">قطعة</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">الحالة</label>
                <select
                  className="w-full border border-graphite/30 rounded-sm px-2 py-1 text-xs font-bold focus:border-signal bg-white"
                  value={condition}
                  onChange={(e) => setCondition(e.target.value as any)}
                >
                  <option value="NORMAL">سليم ✓</option>
                  <option value="DAMAGED">تالف ⚠️</option>
                </select>
              </div>

              <div className="col-span-3 md:col-span-1 flex items-end">
                <label className="w-full bg-graphite/10 hover:bg-graphite/20 text-ink px-2.5 py-1 rounded cursor-pointer font-bold text-[11px] flex items-center justify-center gap-1 border border-graphite/20">
                  📷 <span>{photoUrl ? "تم إرفاق صورة ✓" : "إرفاق صورة"}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            </div>

            {selectedItem && (
              <div className="flex items-center justify-between bg-good/10 text-good px-2.5 py-1 rounded border border-good/20 text-xs font-bold">
                <span>تم اختيار: {selectedItem.name} ({selectedItem.barcode})</span>
                <button type="button" onClick={() => setSelectedItem(null)} className="text-graphite/60 hover:text-ink font-normal">تغيير</button>
              </div>
            )}
          </form>
        </div>

        {/* Modal for reporting unknown pending item with full fields */}
        {showPendingForm && (
          <div className="fixed inset-0 bg-ink/70 backdrop-blur-xs z-[90] flex items-center justify-center p-3">
            <div className="bg-white rounded-md border border-warn/40 shadow-2xl max-w-lg w-full p-4 space-y-3 max-h-[92vh] overflow-y-auto animate-fade-in text-right" dir="rtl">
              <div className="flex items-center justify-between border-b border-graphite/15 pb-2">
                <h3 className="font-bold text-warn text-xs md:text-sm flex items-center gap-1.5">
                  <span>⚠️ إبلاغ عن مادة غير مسجّلة بالنظام</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setShowPendingForm(false)}
                  className="text-graphite/50 hover:text-ink font-bold text-base cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-graphite/70 leading-relaxed font-medium">
                الباركود <span className="font-mono font-bold text-ink">{pendingBarcode}</span> غير موجود بالمعدة. يرجى إدخال كافة بيانات المادة وصورتها لرفعها للمراجعة والاعتماد من الإدارة:
              </p>

              <form onSubmit={handleSavePending} className="space-y-3 text-xs">
                {/* Barcode & Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-graphite/70 mb-0.5">رقم الباركود *</label>
                    <input
                      type="text"
                      required
                      className="w-full border border-graphite/30 rounded px-2.5 py-1.5 font-mono font-bold bg-graphite/5 text-ink text-xs"
                      value={pendingBarcode}
                      onChange={(e) => setPendingBarcode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-graphite/70 mb-0.5">اسم المادة *</label>
                    <input
                      type="text"
                      required
                      placeholder="اسم المادة بالكامل..."
                      className="w-full border border-graphite/30 rounded px-2.5 py-1.5 bg-white text-xs font-bold text-ink"
                      value={pendingName}
                      onChange={(e) => setPendingName(e.target.value)}
                    />
                  </div>
                </div>

                {/* Supplier & Category */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-graphite/70 mb-0.5">المورد</label>
                    <input
                      type="text"
                      placeholder="اسم المورد إن وجد..."
                      className="w-full border border-graphite/30 rounded px-2.5 py-1.5 bg-white text-xs"
                      value={pendingSupplier}
                      onChange={(e) => setPendingSupplier(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-graphite/70 mb-0.5">المجموعة / الفئة</label>
                    <input
                      type="text"
                      placeholder="فئة المادة..."
                      className="w-full border border-graphite/30 rounded px-2.5 py-1.5 bg-white text-xs"
                      value={pendingCategory}
                      onChange={(e) => setPendingCategory(e.target.value)}
                    />
                  </div>
                </div>

                {/* Account No / SKU & Unit Name & Quantity */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-graphite/70 mb-0.5">رقم المحاسبي / SKU</label>
                    <input
                      type="text"
                      placeholder="كود الحسابات..."
                      className="w-full border border-graphite/30 rounded px-2.5 py-1.5 bg-white font-mono text-xs"
                      value={pendingAccountNo}
                      onChange={(e) => setPendingAccountNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-graphite/70 mb-0.5">الوحدة</label>
                    <select
                      className="w-full border border-graphite/30 rounded px-2.5 py-1.5 bg-white text-xs font-bold"
                      value={pendingUnitName}
                      onChange={(e) => setPendingUnitName(e.target.value)}
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
                  </div>
                  <div>
                    <label className="block font-bold text-graphite/70 mb-0.5">الكمية المجرودة</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      required
                      className="w-full border border-graphite/30 rounded px-2.5 py-1.5 font-mono font-bold text-signal text-center bg-white text-xs"
                      value={pendingQty}
                      onChange={(e) => setPendingQty(Number(e.target.value) || 1)}
                    />
                  </div>
                </div>

                {/* Photo Capture / Upload (Important for Admin) */}
                <div className="border border-dashed border-graphite/30 p-2.5 rounded bg-graphite/5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-graphite/80 text-xs flex items-center gap-1">
                      <span>📸 صورة المادة (مهمة للادمن)</span>
                    </label>
                    <label className="bg-ink hover:bg-signal text-paper px-3 py-1 rounded text-xs font-bold cursor-pointer transition-colors shadow-xs">
                      <span>{pendingPhotoUrl ? "تغيير الصورة 📷" : "التقاط / رفع صورة 📷"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePendingPhotoUpload}
                      />
                    </label>
                  </div>

                  {pendingPhotoUrl ? (
                    <div className="relative w-24 h-24 rounded border border-graphite/20 overflow-hidden shadow-xs">
                      <img src={pendingPhotoUrl} alt="معاينة الصورة" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPendingPhotoUrl("")}
                        className="absolute top-0.5 right-0.5 bg-warn text-paper rounded-full w-5 h-5 flex items-center justify-center font-bold text-[10px]"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-graphite/50 italic">
                      يرجى التقاط صورة واضحة لمنتج المادة والباركود لمساعدة الإدمن في التوجيه والاعتماد.
                    </p>
                  )}
                </div>

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-graphite/15">
                  <button
                    type="button"
                    onClick={() => setShowPendingForm(false)}
                    className="px-3 py-1.5 rounded border border-graphite/30 font-bold text-graphite/70 hover:bg-graphite/10"
                  >
                    إلغاء ✕
                  </button>
                  <button
                    type="submit"
                    disabled={savingScan}
                    className="bg-warn text-paper px-5 py-1.5 rounded font-bold hover:bg-ink transition-colors cursor-pointer shadow-md flex items-center gap-1"
                  >
                    <span>📤</span>
                    <span>{savingScan ? "جارٍ الإرسال..." : "إرسال للمراجعة والاعتماد"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Audit Record Items List (Optimized for Mobile Card Layout & Desktop Table Layout) */}
        <div className="bg-white border border-graphite/20 rounded-sm shadow-md overflow-hidden">
          <div className="bg-graphite/5 px-4 py-2.5 border-b border-graphite/15 flex items-center justify-between">
            <h3 className="font-bold text-ink text-xs md:text-sm flex items-center gap-2">
              <span>📋 جدول الجرد المسجل</span>
              <span className="bg-ink text-paper px-2 py-0.5 rounded-full text-[11px] font-mono">{recentScans.length} صنف</span>
            </h3>
          </div>

          {/* MOBILE RESPONSIVE CARD VIEW (Visible on small screens) */}
          <div className="block md:hidden divide-y divide-graphite/15">
            {recentScans.map((sc) => (
              <div key={sc.id} className="p-3 hover:bg-signal/5 transition-colors flex items-center justify-between gap-3">
                {/* FAR RIGHT (أقصى اليمين): Quantity Control with + on top, - on bottom */}
                <div className="flex flex-col items-center justify-center bg-signal/5 p-1.5 rounded border border-signal/20 shrink-0">
                  {/* + Button on Top */}
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(sc, 1)}
                    className="bg-good/15 hover:bg-good hover:text-paper text-good font-black w-8 h-8 rounded flex items-center justify-center text-lg shadow-xs cursor-pointer active:scale-95 transition-transform"
                    title="زيادة الكمية بـ 1"
                  >
                    +
                  </button>

                  {/* Quantity Display in Middle */}
                  <button
                    type="button"
                    onClick={() => openEditModal(sc)}
                    className="my-1 font-mono font-extrabold text-sm text-signal text-center"
                  >
                    <div>{sc.qtyInUnit}</div>
                    <div className="text-[9px] font-sans font-bold text-graphite/70">{sc.unitName || "قطعة"}</div>
                  </button>

                  {/* - Button on Bottom */}
                  <button
                    type="button"
                    onClick={() => handleAdjustQty(sc, -1)}
                    className="bg-warn/15 hover:bg-warn hover:text-paper text-warn font-black w-8 h-8 rounded flex items-center justify-center text-lg shadow-xs cursor-pointer active:scale-95 transition-transform"
                    title="إنقاص الكمية بـ 1"
                  >
                    -
                  </button>
                </div>

                {/* MIDDLE COLUMN (الوسط): Item details across 2-3 neat lines */}
                <div className="flex-1 min-w-0 space-y-1 text-xs">
                  {/* Line 1: Item Name */}
                  <div className="font-bold text-ink text-sm leading-tight truncate">
                    {sc.item?.name || "صنف قيد المراجعة"}
                  </div>

                  {/* Line 2: Barcode, Supplier, Shelf */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-graphite/70">
                    <span className="font-mono bg-graphite/10 px-1.5 py-0.5 rounded text-graphite/80 font-bold">
                      {sc.barcodeScanned || sc.barcode}
                    </span>
                    <span>📍 {sc.locationLabel || sc.location || assignedTaskShelves[0]}</span>
                  </div>

                  {/* Line 3: Condition, Photo / Notes indicator, Time */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px]">
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold ${
                        sc.condition === "NORMAL"
                          ? "bg-good/15 text-good"
                          : "bg-warn/15 text-warn"
                      }`}
                    >
                      {sc.condition === "NORMAL" ? "سليم ✓" : "تالف ⚠️"}
                    </span>

                    {sc.photoUrl && (
                      <span className="text-signal font-bold">📷 صورة</span>
                    )}

                    {sc.notes && (
                      <span className="text-graphite/60 truncate max-w-[100px]">📝 {sc.notes}</span>
                    )}

                    <span className="font-mono text-graphite/40 mr-auto">
                      {new Date(sc.createdAt || sc.deviceTimestamp).toLocaleTimeString("ar-SA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* FAR LEFT (أقصى اليسار): Edit & Delete buttons */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(sc)}
                    className="bg-signal/10 text-signal hover:bg-signal hover:text-paper p-2 rounded text-xs font-bold cursor-pointer"
                    title="تعديل"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDeleteScan(sc.id)}
                    className="text-warn hover:bg-warn/10 p-1.5 rounded font-bold text-xs cursor-pointer"
                    title="حذف"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}

            {recentScans.length === 0 && (
              <div className="p-8 text-center text-graphite/40 text-xs font-medium">
                لا توجد مدخلات جرد مسجلة بعد.
              </div>
            )}
          </div>

          {/* DESKTOP TABLE VIEW (Visible on desktop md:screens) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead className="bg-paper text-graphite/70 font-bold border-b border-graphite/15">
                <tr>
                  <th className="py-3 px-4">الصنف / المادة</th>
                  <th className="py-3 px-4">الباركود</th>
                  <th className="py-3 px-4 text-center">الكمية المعاينة</th>
                  <th className="py-3 px-4">الرف / الموقع</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4">الصورة / الملاحظات</th>
                  <th className="py-3 px-4">التاريخ والوقت</th>
                  <th className="py-3 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-graphite/10">
                {recentScans.map((sc) => (
                  <tr key={sc.id} className="hover:bg-signal/5 transition-colors group">
                    <td onClick={() => openEditModal(sc)} className="py-3 px-4 cursor-pointer">
                      <div className="font-bold text-ink text-sm group-hover:text-signal transition-colors">
                        {sc.item?.name || "صنف قيد المراجعة"}
                      </div>
                      {sc.item?.supplier && (
                        <div className="text-[11px] text-graphite/50">المورد: {sc.item.supplier}</div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-graphite/80">
                      {sc.barcodeScanned || sc.barcode}
                    </td>

                    {/* Quick +/- Quantity Control */}
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAdjustQty(sc, -1)}
                          className="bg-graphite/10 hover:bg-warn hover:text-paper text-ink font-bold w-7 h-7 rounded flex items-center justify-center text-sm transition-colors cursor-pointer select-none"
                          title="إنقاص الكمية بـ 1"
                        >
                          -
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(sc)}
                          className="font-mono font-extrabold text-base text-signal px-3 py-1 bg-signal/10 rounded border border-signal/20 hover:bg-signal/20 transition-colors cursor-pointer"
                        >
                          {sc.qtyInUnit} {sc.unitName || "قطعة"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAdjustQty(sc, 1)}
                          className="bg-graphite/10 hover:bg-good hover:text-paper text-ink font-bold w-7 h-7 rounded flex items-center justify-center text-sm transition-colors cursor-pointer select-none"
                          title="زيادة الكمية بـ 1"
                        >
                          +
                        </button>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-medium text-graphite/80">
                      <span className="bg-graphite/10 px-2 py-1 rounded text-[11px] font-semibold">
                        📍 {sc.locationLabel || sc.location || assignedTaskShelves[0] || "رف 1"}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                          sc.condition === "NORMAL"
                            ? "bg-good/15 text-good"
                            : "bg-warn/15 text-warn"
                        }`}
                      >
                        {sc.condition === "NORMAL" ? "سليم ✓" : "تالف ⚠️"}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[11px] text-graphite/70">
                      <div className="flex items-center gap-2">
                        {sc.photoUrl && (
                          <img src={sc.photoUrl} alt="صورة الصنف" className="w-8 h-8 object-cover rounded border border-graphite/20 shrink-0" />
                        )}
                        {sc.notes ? (
                          <span className="truncate max-w-[120px]" title={sc.notes}>📝 {sc.notes}</span>
                        ) : (
                          !sc.photoUrl && <span className="text-graphite/40">-</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-[10px] text-graphite/50">
                      {new Date(sc.createdAt || sc.deviceTimestamp).toLocaleTimeString("ar-SA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(sc)}
                          className="bg-signal/10 text-signal hover:bg-signal hover:text-paper px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
                        >
                          ✏️ تعديل
                        </button>
                        <button
                          onClick={() => handleDeleteScan(sc.id)}
                          className="text-warn hover:underline font-bold text-xs cursor-pointer"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {recentScans.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-graphite/40 font-medium">
                      لا توجد مدخلات جرد مسجلة في هذه المهمة حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar: Finish Audit (Temporary or Final) */}
      <div className="bg-ink text-paper px-6 py-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-lg shrink-0">
        <div className="text-xs text-white/70 font-medium flex items-center gap-2">
          <span>إجمالي الأصناف المجرودة:</span>
          <span className="bg-white/20 text-white font-mono font-bold px-2.5 py-0.5 rounded text-sm">
            {recentScans.length} صنف
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Button 1: Finish Temporarily (Resume Later) */}
          <button
            type="button"
            disabled={submittingTask}
            onClick={handleFinishTemporarily}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-5 py-2 rounded-sm text-xs md:text-sm font-bold transition-colors cursor-pointer flex items-center gap-2"
          >
            <span>⏸️</span>
            <span>إنهاء مؤقت (حفظ واستكمال لاحقاً)</span>
          </button>

          {/* Button 2: Final Submission to Management */}
          <button
            type="button"
            disabled={submittingTask}
            onClick={() => setShowFinalSubmitConfirmModal(true)}
            className="bg-signal hover:bg-good text-paper px-6 py-2 rounded-sm text-xs md:text-sm font-bold transition-colors cursor-pointer shadow-md flex items-center gap-2"
          >
            <span>🚀</span>
            <span>{submittingTask ? "جارٍ الرفع..." : "إنهاء الجرد ورفعه للإدارة (تسليم نهائي)"}</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Final Audit Submission */}
      {showFinalSubmitConfirmModal && (
        <div className="fixed inset-0 bg-ink/80 backdrop-blur-xs z-[80] flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-graphite/20 shadow-2xl max-w-md w-full p-5 space-y-4 animate-fade-in text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-graphite/15 pb-2">
              <h3 className="font-bold text-sm md:text-base text-ink flex items-center gap-2">
                <span>🚀 تأكيد رفع وتسليم الجرد الفعلي للإدارة</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowFinalSubmitConfirmModal(false)}
                className="text-graphite/50 hover:text-ink font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-paper p-3 rounded-sm border border-graphite/15 text-xs text-graphite/80 space-y-2">
              <div className="flex justify-between border-b border-graphite/10 pb-1">
                <span className="font-bold text-graphite/60">رقم المهمة:</span>
                <span className="font-mono font-bold text-ink">{task.taskNumber}</span>
              </div>
              <div className="flex justify-between border-b border-graphite/10 pb-1">
                <span className="font-bold text-graphite/60">المستودع:</span>
                <span className="font-bold text-ink">{assignedWarehouseName}</span>
              </div>
              <div className="flex justify-between border-b border-graphite/10 pb-1">
                <span className="font-bold text-graphite/60">عدد الأصناف المجرودة:</span>
                <span className="font-bold text-signal">{recentScans.length} صنف</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold text-graphite/60">إجمالي الوحدات/القطع:</span>
                <span className="font-bold text-good">
                  {recentScans.reduce((sum, s) => sum + (Number(s.qtyInUnit) || 0), 0)} قطعة
                </span>
              </div>
            </div>

            <p className="text-xs text-graphite/70 leading-relaxed font-medium">
              عند التأكيد، ستتحول حالة المهمة إلى <span className="font-bold text-warn">[قيد المراجعة]</span> وسيتم إرسال كافة القراءات المخزنة مباشرة لمسؤول النظام للمطابقة والاعتماد النهائي.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowFinalSubmitConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold border border-graphite/30 rounded hover:bg-graphite/10 cursor-pointer"
              >
                إلغاء ✕
              </button>
              <button
                type="button"
                disabled={submittingTask}
                onClick={handleConfirmSubmitFinalAudit}
                className="bg-signal text-paper px-6 py-2 rounded text-xs font-bold hover:bg-good transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <span>🚀</span>
                <span>{submittingTask ? "جارٍ التسليم..." : "تأكيد الرفع والتسليم النهائي"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Edit Modal */}
      {editingScan && (
        <div className="fixed inset-0 bg-ink/70 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm border border-graphite/20 shadow-2xl max-w-md w-full p-4 space-y-3 max-h-[90vh] overflow-y-auto animate-fade-in" dir="rtl">
            <div className="flex items-center justify-between border-b border-graphite/15 pb-2">
              <h3 className="font-bold text-xs md:text-sm text-ink flex items-center gap-1.5">
                <span>✏️ تعديل بيانات قراءة الجرد</span>
              </h3>
              <button onClick={() => setEditingScan(null)} className="text-graphite/50 hover:text-ink font-bold text-base cursor-pointer">✕</button>
            </div>

            <div className="bg-paper p-2.5 rounded-sm border border-graphite/15 text-xs text-graphite/70">
              <span className="font-bold text-ink text-xs md:text-sm block">{editingScan.item?.name || "صنف مفحوص"}</span>
              <span className="font-mono text-graphite/60 text-[11px] mt-0.5 block">الباركود: {editingScan.barcodeScanned || editingScan.barcode}</span>
            </div>

            <form onSubmit={handleSaveFullEdit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                {/* Locked Assigned Warehouse */}
                <div>
                  <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">المستودع (المسند)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    className="w-full border border-graphite/20 rounded-sm px-2 py-1 text-xs font-bold bg-graphite/10 text-graphite/70 cursor-not-allowed truncate"
                    value={assignedWarehouseName}
                  />
                </div>

                {/* Shelf / Location Constrained to Assigned Shelves */}
                <div>
                  <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">الرف / الموقع المسند</label>
                  <select
                    className="w-full border border-graphite/30 rounded-sm px-2 py-1 text-xs font-bold bg-white focus:border-signal cursor-pointer"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                  >
                    {assignedTaskShelves.map((loc) => (
                      <option key={loc} value={loc}>📍 {loc}</option>
                    ))}
                  </select>
                </div>

                {/* Quantity */}
                <div>
                  <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">الكمية المسجلة</label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    className="w-full border-2 border-signal rounded-sm px-2 py-1 text-sm font-mono font-bold text-signal text-center focus:outline-none bg-white"
                    value={editQty}
                    onChange={(e) => setEditQty(parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* Condition */}
                <div>
                  <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">حالة الصنف</label>
                  <select
                    className="w-full border border-graphite/30 rounded-sm px-2 py-1 text-xs font-bold bg-white focus:border-signal"
                    value={editCondition}
                    onChange={(e) => setEditCondition(e.target.value as any)}
                  >
                    <option value="NORMAL">سليم ✓</option>
                    <option value="DAMAGED">تالف ⚠️</option>
                  </select>
                </div>
              </div>

              {/* Photo Attachment */}
              <div>
                <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">صورة الصنف / التلف</label>
                <div className="flex items-center gap-2">
                  <label className="bg-graphite/10 hover:bg-graphite/20 text-ink px-3 py-1 rounded cursor-pointer text-[11px] font-bold flex items-center gap-1 border border-graphite/20">
                    📷 <span>{editPhotoUrl ? "تغيير الصورة ↻" : "إرفاق صورة"}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleEditPhotoUpload} />
                  </label>
                  {editPhotoUrl && (
                    <div className="flex items-center gap-2">
                      <img src={editPhotoUrl} alt="تعديل الصورة" className="w-8 h-8 object-cover rounded border border-graphite/30" />
                      <button type="button" onClick={() => setEditPhotoUrl("")} className="text-warn text-xs font-bold">إزالة</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-graphite/70 mb-0.5">ملاحظة على الصنف</label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات على حالة الغلاف، التلف..."
                  className="w-full border border-graphite/30 rounded-sm p-1.5 text-xs focus:border-signal bg-white"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-graphite/15">
                <button
                  type="button"
                  onClick={() => setEditingScan(null)}
                  className="px-3 py-1 text-xs font-bold border border-graphite/30 rounded hover:bg-graphite/10 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="bg-signal text-paper px-4 py-1.5 rounded text-xs font-bold hover:bg-ink transition-colors cursor-pointer shadow-xs"
                >
                  {savingEdit ? "جارٍ الحفظ..." : "حفظ التعديلات (Enter ↵)"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

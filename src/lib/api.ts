const TOKEN_KEY = "inventory_admin_token";

// Point this at your Oracle Cloud deployment in production, or use same-origin /api prefix for full-stack integration
export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || (typeof window !== "undefined"
  ? `${window.location.protocol}//${window.location.host}/api`
  : "http://localhost:3000/api");

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };
  const res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });

  if (res.status === 204) return null;

  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    let errorMsg = `فشل الطلب (${res.status})`;
    if (body) {
      if (typeof body === "string") {
        errorMsg = body;
      } else if (typeof body.error === "string") {
        errorMsg = body.error;
      } else if (body.error) {
        errorMsg = typeof body.error === "object" ? JSON.stringify(body.error) : String(body.error);
      } else if (body.message) {
        errorMsg = body.message;
      }
    }
    throw new Error(errorMsg);
  }

  return body;
}

export const api = {
  signup: (payload: object) => request("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (username: string, password: string) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  listUsers: () => request("/users"),
  createUser: (payload: object) => request("/users", { method: "POST", body: JSON.stringify(payload) }),
  deactivateUser: (id: string) => request(`/users/${id}/deactivate`, { method: "PATCH" }),

  listWarehouses: () => request("/warehouses"),
  createWarehouse: (payload: object) => request("/warehouses", { method: "POST", body: JSON.stringify(payload) }),

  listItems: () => request("/items"),
  countItems: () => request("/items/count") as Promise<{ count: number }>,
  createItem: (payload: object) => request("/items", { method: "POST", body: JSON.stringify(payload) }),
  updateItem: (id: string, payload: object) => request(`/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteItem: (id: string) => request(`/items/${id}`, { method: "DELETE" }),
  clearItems: () => request("/items/clear", { method: "DELETE" }),
  importItemsCsv: (file: File, warehouseId?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (warehouseId) form.append("warehouseId", warehouseId);
    const token = getToken();
    return fetch(`${API_BASE_URL}/items/import/csv`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "فشل الاستيراد");
      return res.json();
    });
  },
  importItemsFromDatabase: (payload: object) =>
    request("/import/from-database", { method: "POST", body: JSON.stringify(payload) }),

  createTask: (payload: object) => request("/audit-tasks", { method: "POST", body: JSON.stringify(payload) }),
  listTasks: () => request("/audit-tasks"),
  listMyTasks: () => request("/audit-tasks/mine"),
  getTask: (id: string) => request(`/audit-tasks/${id}`),
  updateTaskStatus: (id: string, status: string) => request(`/audit-tasks/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),

  getBarcodeItem: (barcode: string) => request(`/items/barcode/${encodeURIComponent(barcode)}`),
  searchItems: (query: string) => request(`/items/search?q=${encodeURIComponent(query)}`),
  recordScan: (payload: object) => request("/audit-records", { method: "POST", body: JSON.stringify(payload) }),
  updateScanRecord: (id: string, payload: object) => request(`/audit-records/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteScanRecord: (id: string) => request(`/audit-records/${id}`, { method: "DELETE" }),
  getRecentScans: (taskId: string) => request(`/audit-records/task/${taskId}/recent?limit=50`),
  reportPendingItem: (payload: object) => request("/audit-records/pending-items", { method: "POST", body: JSON.stringify(payload) }),

  listPendingItems: () => request("/pending-items"),
  updatePendingItem: (id: string, payload: object) => request(`/pending-items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  approvePendingItem: (id: string, payload?: object) => request(`/pending-items/${id}/approve`, { method: "PATCH", body: JSON.stringify(payload || {}) }),
  rejectPendingItem: (id: string) => request(`/pending-items/${id}/reject`, { method: "PATCH" }),

  generateReport: (taskId: string) => request(`/tasks/${taskId}/generate`, { method: "POST" }),
  reportCsvUrl: (reportId: string) => `${API_BASE_URL}/reports/${reportId}/csv`,
};

const TOKEN_KEY = "inventory_admin_token";

// Point this at your Oracle Cloud deployment in production,
// e.g. "https://inventory-api.amrodev.com"
export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:4000";

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
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ? JSON.stringify(body.error) : `فشل الطلب (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
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
  createItem: (payload: object) => request("/items", { method: "POST", body: JSON.stringify(payload) }),
  importItemsCsv: (file: File) => {
    const form = new FormData();
    form.append("file", file);
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

  listPendingItems: () => request("/pending-items"),
  approvePendingItem: (id: string) => request(`/pending-items/${id}/approve`, { method: "PATCH" }),
  rejectPendingItem: (id: string) => request(`/pending-items/${id}/reject`, { method: "PATCH" }),

  generateReport: (taskId: string) => request(`/tasks/${taskId}/generate`, { method: "POST" }),
  reportCsvUrl: (reportId: string) => `${API_BASE_URL}/reports/${reportId}/csv`,
};

const BASE = "/api";

export const getToken = () => localStorage.getItem("token");

export async function api(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = `Token ${t}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.detail || `Request failed (${res.status})`);
  return data;
}

export const inr = (v) => "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
export const short = (h) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "");
export const when = (t) => new Date(t).toLocaleString();

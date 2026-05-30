// api.js  - thin wrapper over the YDNL prototype API.
const base = "/api";

async function j(method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let detail = {};
    try { detail = await res.json(); } catch { /* ignore */ }
    throw new Error(detail.error || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  vocabulary: () => j("GET", "/vocabulary"),
  listPatterns: (filters = {}) => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    return j("GET", `/patterns${qs ? "?" + qs : ""}`);
  },
  getPattern: (id) => j("GET", `/patterns/${id}`),
  savePattern: (pattern) => j("POST", "/patterns", pattern),
  deletePattern: (id) => j("DELETE", `/patterns/${id}`),
  benchmark: (pattern) => j("POST", "/benchmark", { pattern }),
  exportUrl: () => base + "/files/export"
};

export async function exportFile(pattern, format) {
  const res = await fetch(api.exportUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pattern, format })
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${pattern.pattern_id}.${format === "json" ? "json" : "ydnl.xml"}`;
  a.click();
  URL.revokeObjectURL(url);
}

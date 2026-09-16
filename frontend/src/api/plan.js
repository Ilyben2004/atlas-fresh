const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function detailMessage(payload, fallback) {
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
  }
  return fallback;
}

export async function uploadPlan(file) {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/v1/plan`, {
    method: "POST",
    body: form,
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(detailMessage(payload, `Upload failed (${response.status})`));
  }
  return payload;
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error("Backend unreachable");
  }
  return response.json();
}

export async function getChatStatus() {
  const response = await fetch(`${API_BASE}/api/v1/chat/status`);
  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(detailMessage(payload, "Unable to check assistant status"));
  }
  return payload;
}

export async function askPlanAssistant(question, context) {
  const response = await fetch(`${API_BASE}/api/v1/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
  });

  const payload = await readJson(response);
  if (!response.ok) {
    throw new Error(detailMessage(payload, `Assistant request failed (${response.status})`));
  }
  return payload;
}

export { API_BASE };

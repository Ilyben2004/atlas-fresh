const STORAGE_KEY = "atlas-fresh-plan-session";

export function loadPlanSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.plan?.kpis) return null;
    return {
      plan: parsed.plan,
      updatedAt: parsed.updatedAt || null,
      activeView: parsed.activeView || "overview",
      sidebarOpen: parsed.sidebarOpen !== false,
    };
  } catch {
    return null;
  }
}

export function savePlanSession({ plan, updatedAt, activeView, sidebarOpen }) {
  try {
    if (!plan) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        plan,
        updatedAt,
        activeView,
        sidebarOpen,
        savedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function clearPlanSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

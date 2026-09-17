const STORAGE_KEY = "atlas-fresh-plan-session";

function clone(value) {
  return value == null ? null : JSON.parse(JSON.stringify(value));
}

export function loadPlanSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.plan?.kpis) return null;
    const savedInputs = parsed.savedInputs || parsed.plan?.inputs || null;
    return {
      plan: parsed.plan,
      updatedAt: parsed.updatedAt || null,
      activeView: parsed.activeView || "overview",
      sidebarOpen: parsed.sidebarOpen !== false,
      savedInputs: clone(savedInputs),
      draftInputs: clone(parsed.draftInputs || savedInputs),
    };
  } catch {
    return null;
  }
}

export function savePlanSession({
  plan,
  updatedAt,
  activeView,
  sidebarOpen,
  savedInputs,
  draftInputs,
}) {
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
        savedInputs: savedInputs || null,
        draftInputs: draftInputs || null,
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

export function inputsAreEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

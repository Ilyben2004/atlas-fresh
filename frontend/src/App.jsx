import { useEffect, useMemo, useRef, useState } from "react";
import { checkHealth, computePlanFromInputs, uploadPlan } from "./api/plan";
import AiPlanAssistant from "./components/AiPlanAssistant";
import CommercialTable from "./components/CommercialTable";
import Header from "./components/Header";
import InputsEditor, { cloneInputs } from "./components/InputsEditor";
import KpiGrid from "./components/KpiGrid";
import LedgerTable from "./components/LedgerTable";
import ProductionTable from "./components/ProductionTable";
import Sidebar, { NAV } from "./components/Sidebar";
import { Icon } from "./utils/format.jsx";
import {
  inputsAreEqual,
  loadPlanSession,
  savePlanSession,
} from "./utils/planStorage";

const savedSession = loadPlanSession();

function stampNow() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export default function App() {
  const fileRef = useRef(null);
  const [plan, setPlan] = useState(savedSession?.plan ?? null);
  const [uploading, setUploading] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState(null);
  const [inputsError, setInputsError] = useState(null);
  const [live, setLive] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(savedSession?.updatedAt ?? null);
  const [activeView, setActiveView] = useState(savedSession?.activeView ?? "overview");
  const [sidebarOpen, setSidebarOpen] = useState(savedSession?.sidebarOpen ?? true);
  const [draftInputs, setDraftInputs] = useState(() =>
    savedSession?.draftInputs
      ? cloneInputs(savedSession.draftInputs)
      : savedSession?.plan?.inputs
        ? cloneInputs(savedSession.plan.inputs)
        : null,
  );
  const [savedInputs, setSavedInputs] = useState(() =>
    savedSession?.savedInputs
      ? cloneInputs(savedSession.savedInputs)
      : savedSession?.plan?.inputs
        ? cloneInputs(savedSession.plan.inputs)
        : null,
  );

  const dirty = useMemo(
    () => !inputsAreEqual(draftInputs, savedInputs),
    [draftInputs, savedInputs],
  );

  const activeLabel = useMemo(
    () => NAV.find((item) => item.id === activeView)?.label || "Overview",
    [activeView],
  );

  useEffect(() => {
    let cancelled = false;
    checkHealth()
      .then(() => {
        if (!cancelled) setLive(true);
      })
      .catch(() => {
        if (!cancelled) setLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    savePlanSession({
      plan,
      updatedAt,
      activeView,
      sidebarOpen,
      savedInputs,
      draftInputs,
    });
  }, [plan, updatedAt, activeView, sidebarOpen, savedInputs, draftInputs]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    setInputsError(null);
    try {
      const result = await uploadPlan(file);
      const stamp = stampNow();
      const inputs = result.inputs ? cloneInputs(result.inputs) : null;
      setPlan(result);
      setDraftInputs(inputs);
      setSavedInputs(inputs ? cloneInputs(inputs) : null);
      setUpdatedAt(stamp);
      setLive(true);
      setActiveView("overview");
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleSaveInputs() {
    if (!draftInputs) return;
    setSavedInputs(cloneInputs(draftInputs));
    setInputsError(null);
  }

  async function handlePlanFromInputs() {
    if (!savedInputs || dirty) return;
    setPlanning(true);
    setInputsError(null);
    setError(null);
    try {
      const result = await computePlanFromInputs(savedInputs);
      const inputs = result.inputs ? cloneInputs(result.inputs) : cloneInputs(savedInputs);
      setPlan(result);
      setDraftInputs(inputs);
      setSavedInputs(cloneInputs(inputs));
      setUpdatedAt(stampNow());
      setLive(true);
      setActiveView("overview");
    } catch (err) {
      setInputsError(err.message || "Plan failed");
    } finally {
      setPlanning(false);
    }
  }

  const showWorkspace = Boolean(plan) || Boolean(draftInputs);

  return (
    <div className="app-shell antialiased">
      <Header
        onUploadClick={() => fileRef.current?.click()}
        uploading={uploading}
        live={live}
        filename={plan?.filename}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        activeLabel={activeLabel}
      />

      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          open={sidebarOpen}
          activeView={activeView}
          onNavigate={setActiveView}
          plan={plan}
          hasInputs={Boolean(draftInputs || savedInputs || plan?.inputs)}
        />

        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas p-3 md:p-4">
          {error ? (
            <div className="mb-3 flex shrink-0 items-start gap-3 rounded-lg border border-[#ef4444]/40 bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
              <Icon name="error" className="mt-0.5 text-[18px]" />
              <div>
                <div className="font-semibold">Plan upload failed</div>
                <div className="mt-0.5 font-mono text-xs">{error}</div>
              </div>
            </div>
          ) : null}

          {!showWorkspace ? (
            <div className="arch-card flex h-full min-h-0 flex-col items-center justify-center gap-4 rounded-xl px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-chip-bg text-accent">
                <Icon name="upload_file" className="text-[28px]" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-ink">
                  Upload production commercial data
                </h2>
                <p className="mt-2 max-w-xl text-sm text-muted-soft">
                  Load the Excel workbook with Farms, Clients, and Station sheets. Then edit
                  Inputs, Save, and Plan again from the sidebar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-2 rounded-lg border border-accent-border bg-accent-strong px-4 py-2 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-70"
              >
                <Icon name="cloud_upload" />
                {uploading ? "Computing plan…" : "Choose Excel file"}
              </button>
            </div>
          ) : (
            <div className="flex h-full min-h-0 flex-col">
              {activeView === "overview" ? (
                plan ? (
                  <KpiGrid plan={plan} updatedAt={updatedAt} />
                ) : (
                  <div className="arch-card flex h-full items-center justify-center rounded-xl p-6 text-sm text-muted-soft">
                    Save Inputs and click Plan to compute Overview KPIs.
                  </div>
                )
              ) : null}
              {activeView === "inputs" ? (
                <InputsEditor
                  draftInputs={draftInputs}
                  savedInputs={savedInputs}
                  dirty={dirty}
                  planning={planning}
                  error={inputsError}
                  onChangeDraft={setDraftInputs}
                  onSave={handleSaveInputs}
                  onPlan={handlePlanFromInputs}
                />
              ) : null}
              {activeView === "production" ? <ProductionTable plan={plan} /> : null}
              {activeView === "commercial" ? <CommercialTable plan={plan} /> : null}
              {activeView === "ledger" ? <LedgerTable plan={plan} /> : null}
              {activeView === "assistant" ? <AiPlanAssistant plan={plan} /> : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

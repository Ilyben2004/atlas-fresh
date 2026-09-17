import { useState } from "react";
import { Icon } from "../utils/format.jsx";
import ApprovePlanModal from "./ApprovePlanModal";

const NAV = [
  {
    id: "overview",
    label: "Overview",
    hint: "KPIs & health",
    icon: "analytics",
  },
  {
    id: "inputs",
    label: "Inputs",
    hint: "Edit sheets",
    icon: "edit_note",
  },
  {
    id: "production",
    label: "Production",
    hint: "Farm variances",
    icon: "agriculture",
  },
  {
    id: "commercial",
    label: "Commercial",
    hint: "Client fill",
    icon: "handshake",
  },
  {
    id: "ledger",
    label: "Ledger",
    hint: "Traceability",
    icon: "receipt_long",
  },
  {
    id: "assistant",
    label: "AI Assistant",
    hint: "Approved prompts",
    icon: "smart_toy",
  },
];

export default function Sidebar({
  open,
  activeView,
  onNavigate,
  plan,
  hasInputs = false,
}) {
  const [approveOpen, setApproveOpen] = useState(false);

  const counts = {
    overview: plan ? "Ready" : "Idle",
    inputs: hasInputs ? "Edit" : "Idle",
    production: plan?.production_view?.length ?? 0,
    commercial: plan?.commercial_view?.length ?? 0,
    ledger: plan?.traceability_ledger?.length ?? 0,
    assistant: plan ? "Live" : "Idle",
  };

  return (
    <>
      <aside
        className={`flex h-full shrink-0 flex-col border-r border-line bg-white transition-[width,opacity,transform] duration-200 ease-out ${
          open ? "w-[240px] opacity-100" : "w-0 overflow-hidden border-r-0 opacity-0"
        }`}
        aria-hidden={!open}
      >
        <div className="flex h-full w-[240px] flex-col">
          <div className="border-b border-line px-4 py-4">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
              Workspace
            </div>
            <div className="mt-1 font-display text-sm font-semibold text-ink">
              Decision Views
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-2">
            {NAV.map((item) => {
              const active = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border border-accent/40 bg-chip-bg text-ink"
                      : "border border-transparent text-muted-soft hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      active ? "bg-accent text-white" : "bg-canvas text-muted"
                    }`}
                  >
                    <Icon name={item.icon} className="text-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-sm font-semibold leading-tight">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-muted">
                      {item.hint}
                    </span>
                  </span>
                  <span
                    className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                      active ? "bg-white text-ink" : "bg-canvas text-muted"
                    }`}
                  >
                    {counts[item.id]}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="border-t border-line p-3">
            <button
              type="button"
              onClick={() => setApproveOpen(true)}
              disabled={!plan}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-accent-border bg-accent-strong px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="verified" className="text-[18px]" />
              Approve Plan
            </button>
            <div className="mt-2 font-mono text-[10px] text-muted">
              Single-page shell · UTC sync
            </div>
          </div>
        </div>
      </aside>

      <ApprovePlanModal open={approveOpen} onClose={() => setApproveOpen(false)} />
    </>
  );
}

export { NAV };

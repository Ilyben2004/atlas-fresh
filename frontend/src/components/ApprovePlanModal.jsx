import { useEffect } from "react";
import { Icon } from "../utils/format.jsx";

export default function ApprovePlanModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(61,72,6,0.28)] p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="approve-plan-title"
        className="w-full max-w-lg rounded-xl border border-[#d5e08b] bg-white p-5 shadow-[0_4px_16px_-2px_rgba(61,72,6,0.08)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chip-bg text-accent">
            <Icon name="task_alt" className="text-[22px]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="approve-plan-title"
              className="font-display text-xl font-bold text-ink"
            >
              Plan acknowledged!
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-soft">
              In a production environment, this action would commit the Traceability
              Ledger to the database and sync the finalized export orders with the
              company&apos;s ERP system.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-canvas hover:text-ink"
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-border bg-accent-strong px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

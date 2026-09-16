import { useEffect, useMemo, useState } from "react";
import { askPlanAssistant, getChatStatus } from "../api/plan";
import { formatEuro, formatNumber, formatPct, formatTonnes, Icon } from "../utils/format.jsx";

export const ALLOWED_QUESTIONS = [
  "Which clients are at risk and why?",
  "Which farm/segment gaps matter most today?",
  "Why are 60 t going local and what is their estimated value?",
];

function buildDeterministicSummary(plan) {
  const kpis = plan?.kpis;
  if (!kpis) {
    return "No dashboard plan is loaded. Upload a workbook before reviewing KPIs.";
  }

  const atRisk = (plan.commercial_view || []).filter(
    (row) => row.status === "PARTIAL" || row.status === "UNSERVED",
  );
  const shortages = (plan.production_view || [])
    .filter((row) => (row.variance_t ?? 0) < -1e-9)
    .sort((a, b) => a.variance_t - b.variance_t)
    .slice(0, 3);

  const lines = [
    `Export fill: ${formatTonnes(kpis.total_exported_t)} of ${formatTonnes(kpis.export_capacity_t)} station capacity (${formatPct(kpis.export_rate_pct)} of intake).`,
    `Revenue: ${formatEuro((kpis.total_export_revenue_eur || 0) + (kpis.total_local_revenue_eur || 0))} combined (${formatEuro(kpis.total_export_revenue_eur)} export + ${formatEuro(kpis.total_local_revenue_eur)} local).`,
    `Local residual: ${formatTonnes(kpis.total_local_residual_t)} valued at ${formatEuro(kpis.total_local_revenue_eur)}.`,
  ];

  if (atRisk.length) {
    lines.push(
      `Clients at risk: ${atRisk
        .map((row) => `${row.client_id} (${row.status}${row.shortage_reason ? ` · ${row.shortage_reason}` : ""})`)
        .join("; ")}.`,
    );
  } else {
    lines.push("No PARTIAL/UNSERVED clients in the current commercial view.");
  }

  if (shortages.length) {
    lines.push(
      `Largest farm shortages: ${shortages
        .map(
          (row) =>
            `${row.farm_id} ${formatNumber(row.variance_t)} t (actual ${formatTonnes(row.actual_delivered)})`,
        )
        .join("; ")}.`,
    );
  }

  return lines.join(" ");
}

export default function AiPlanAssistant({ plan }) {
  const [mode, setMode] = useState("loading"); // loading | ready | no_key | offline
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const deterministicSummary = useMemo(() => buildDeterministicSummary(plan), [plan]);

  useEffect(() => {
    let cancelled = false;
    getChatStatus()
      .then((payload) => {
        if (cancelled) return;
        setMode(payload?.status === "ready" ? "ready" : "no_key");
      })
      .catch(() => {
        if (!cancelled) setMode("offline");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAsk(question) {
    if (!plan || busy) return;
    setBusy(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", text: question }]);

    try {
      const payload = await askPlanAssistant(question, plan);
      if (payload.status === "no_key") {
        setMode("no_key");
        setMessages((current) => current.slice(0, -1));
        return;
      }
      setMessages((current) => [
        ...current,
        { role: "assistant", text: payload.answer || "No answer returned." },
      ]);
    } catch (err) {
      setError(err.message || "Assistant request failed");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "The assistant could not complete that request. The provider may be unavailable.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[#eaf1ac] bg-white">
      <div className="shrink-0 border-b border-[#eaf1ac] px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="smart_toy" className="text-[22px] text-[#546500]" />
          <h2 className="font-display text-xl font-bold text-[#3d4806]">
            AI Plan Assistant
          </h2>
          {mode === "no_key" ? (
            <span className="rounded-sm border border-[#f59e0b]/45 bg-[#fef3c7] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#654a09]">
              No API Key - Deterministic Mode
            </span>
          ) : null}
          {mode === "ready" ? (
            <span className="rounded-sm border border-[#9aae37]/45 bg-[#f2f7d2] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#3d4806]">
              Gemini Ready
            </span>
          ) : null}
          {mode === "offline" ? (
            <span className="rounded-sm border border-[#ef4444]/35 bg-[#fee2e2] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#991b1b]">
              Backend Offline
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[#454837]">
          Restricted read-only analyst. Only the three approved prompts are accepted.
        </p>
      </div>

      <div className="view-scroll min-h-0 flex-1 px-4 py-4">
        {mode === "loading" ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[#6d7208]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#9aae37] border-t-transparent" />
            Checking assistant status…
          </div>
        ) : null}

        {mode === "no_key" ? (
          <div className="rounded-lg border border-[#eaf1ac] bg-[#fafbf4] p-4">
            <div className="font-display text-base font-semibold text-[#3d4806]">
              Deterministic KPI summary
            </div>
            <p className="mt-3 text-sm leading-relaxed text-[#3d4806]">
              {deterministicSummary}
            </p>
            <p className="mt-4 font-mono text-[11px] text-[#6d7208]">
              Set GEMINI_API_KEY on the backend to enable the approved Gemini prompts.
            </p>
          </div>
        ) : null}

        {mode === "offline" ? (
          <div className="rounded-lg border border-[#ef4444]/30 bg-[#fee2e2] p-4 text-sm text-[#991b1b]">
            Cannot reach `/api/v1/chat/status`. Start the backend to use the assistant.
          </div>
        ) : null}

        {mode === "ready" ? (
          <div className="flex flex-col gap-3">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-[#eaf1ac] bg-[#fafbf4] p-4 text-sm text-[#454837]">
                Choose one approved question below. Free-text chat is disabled by design.
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`rounded-lg border px-3 py-3 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "ml-6 border-[#9aae37]/40 bg-[#f2f7d2] text-[#3d4806]"
                    : "mr-6 border-[#eaf1ac] bg-white text-[#3d4806]"
                }`}
              >
                <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6d7208]">
                  {message.role === "user" ? "You" : "Atlas Fresh AI"}
                </div>
                {message.text}
              </div>
            ))}

            {busy ? (
              <div className="mr-6 flex items-center gap-2 rounded-lg border border-[#eaf1ac] bg-white px-3 py-3 text-sm text-[#6d7208]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#9aae37] border-t-transparent" />
                Analyzing dashboard context…
              </div>
            ) : null}

            {error ? (
              <div className="rounded-lg border border-[#ef4444]/35 bg-[#fee2e2] px-3 py-2 text-sm text-[#991b1b]">
                {error}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {mode === "ready" ? (
        <div className="shrink-0 border-t border-[#eaf1ac] bg-white p-4">
          <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6d7208]">
            Approved prompts
          </div>
          <div className="flex flex-col gap-2">
            {ALLOWED_QUESTIONS.map((question) => (
              <button
                key={question}
                type="button"
                disabled={!plan || busy}
                onClick={() => handleAsk(question)}
                className="rounded-lg border border-[#7d931d] bg-[#9aae37] px-3 py-2.5 text-left text-sm font-semibold text-white transition-colors hover:bg-[#7e941e] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

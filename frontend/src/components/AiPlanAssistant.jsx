import { useEffect, useMemo, useState } from "react";
import { askPlanAssistant, getChatStatus } from "../api/plan";
import { formatEuro, formatNumber, formatTonnes, Icon } from "../utils/format.jsx";

export const INTENT_PROMPTS = [
  "Which clients are at risk and why?",
  "Which farm/segment gaps matter most today?",
  "Why is fruit going local and what is its estimated value?",
];

function friendlyToolLabel(tool) {
  const labels = {
    get_clients_at_risk: "Clients at risk",
    get_farm_segment_gaps: "Farm gaps",
    get_local_residual_value: "Local volume",
  };
  return labels[tool] || null;
}

function formatAssistantText(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function AssistantMessageBody({ text }) {
  const cleaned = formatAssistantText(text);
  const rawLines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Merge wrapped continuation lines into the previous list item so multi-line
  // LLM answers still render as one bullet per client/farm.
  const lines = [];
  for (const line of rawLines) {
    const isListItem = /^\d+[\).:-]\s+/.test(line) || /^[-•]\s+/.test(line);
    if (!isListItem && lines.length > 0) {
      const prev = lines[lines.length - 1];
      if (/^\d+[\).:-]\s+/.test(prev) || /^[-•]\s+/.test(prev)) {
        lines[lines.length - 1] = `${prev} ${line}`;
        continue;
      }
    }
    lines.push(line);
  }

  const listStart = lines.findIndex(
    (line) => /^\d+[\).:-]\s+/.test(line) || /^[-•]\s+/.test(line),
  );

  if (listStart >= 0) {
    const intro = lines.slice(0, listStart);
    const items = lines.slice(listStart);
    const allItemsAreList = items.every(
      (line) => /^\d+[\).:-]\s+/.test(line) || /^[-•]\s+/.test(line),
    );

    if (allItemsAreList) {
      return (
        <div className="space-y-2 text-[15px] leading-relaxed text-[#3d4806]">
          {intro.map((line, index) => (
            <p key={`intro-${index}`}>{line}</p>
          ))}
          <ol className="list-decimal space-y-2.5 pl-5">
            {items.map((line, index) => (
              <li key={`item-${index}`} className="pl-1">
                {line.replace(/^\d+[\).:-]\s+/, "").replace(/^[-•]\s+/, "")}
              </li>
            ))}
          </ol>
        </div>
      );
    }
  }

  return (
    <div className="space-y-2 whitespace-pre-wrap text-[15px] leading-relaxed text-[#3d4806]">
      {cleaned}
    </div>
  );
}

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
    `Today the station exported ${formatTonnes(kpis.total_exported_t)} out of its ${formatTonnes(kpis.export_capacity_t)} limit.`,
    `Total value is about ${formatEuro((kpis.total_export_revenue_eur || 0) + (kpis.total_local_revenue_eur || 0))} (export plus local).`,
    `${formatTonnes(kpis.total_local_residual_t)} could not be exported and is valued locally at about ${formatEuro(kpis.total_local_revenue_eur)}.`,
  ];

  if (atRisk.length) {
    lines.push(
      `Clients not fully served: ${atRisk
        .map((row) => `${row.client_name || row.client_id} (${row.client_id})`)
        .join(", ")}.`,
    );
  } else {
    lines.push("Every client was fully served.");
  }

  if (shortages.length) {
    lines.push(
      `Biggest farm shortfalls: ${shortages
        .map(
          (row) =>
            `${row.farm_name || row.farm_id} short by ${formatNumber(Math.abs(row.variance_t))} t`,
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
  const [draft, setDraft] = useState("");

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
    const cleaned = (question || "").trim();
    if (!plan || busy || !cleaned) return;

    setBusy(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", text: cleaned }]);

    try {
      const payload = await askPlanAssistant(cleaned, plan);
      if (payload.status === "no_key") {
        setMode("no_key");
        setMessages((current) => current.slice(0, -1));
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: payload.answer || "No answer returned.",
          tool: payload.tool || null,
        },
      ]);
    } catch (err) {
      const message = err.message || "Assistant request failed";
      setError(message);
      const isRejected =
        /not allowed/i.test(message) || /approved/i.test(message) || /400/.test(message);
      const isUnavailable =
        /timed out|unavailable|503|provider/i.test(message) && !isRejected;
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: isRejected
            ? `Question not allowed. ${message}`
            : isUnavailable
              ? "The Gemini provider is temporarily unavailable (503). Try again shortly."
              : "The assistant could not complete that request.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function submitDraft(event) {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    setDraft("");
    handleAsk(question);
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
              Ready
            </span>
          ) : null}
          {mode === "offline" ? (
            <span className="rounded-sm border border-[#ef4444]/35 bg-[#fee2e2] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#991b1b]">
              Backend Offline
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-[#454837]">
          Ask about clients at risk, farm shortfalls, or fruit going local. Other topics are
          declined.
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
              Set GEMINI_API_KEY on the backend to enable tool-calling answers.
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
                Use a shortcut below or type a paraphrase. Off-topic questions are rejected.
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
                <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6d7208]">
                  <span>{message.role === "user" ? "You" : "Atlas Fresh AI"}</span>
                  {message.role === "assistant" && friendlyToolLabel(message.tool) ? (
                    <span className="rounded-sm border border-[#eaf1ac] bg-[#fafbf4] px-1.5 py-0.5 normal-case tracking-normal">
                      {friendlyToolLabel(message.tool)}
                    </span>
                  ) : null}
                </div>
                {message.role === "assistant" ? (
                  <AssistantMessageBody text={message.text} />
                ) : (
                  <div className="text-[15px] leading-relaxed">{message.text}</div>
                )}
              </div>
            ))}

            {busy ? (
              <div className="mr-6 flex items-center gap-2 rounded-lg border border-[#eaf1ac] bg-white px-3 py-3 text-sm text-[#6d7208]">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#9aae37] border-t-transparent" />
                Looking up today’s plan…
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
            Intent shortcuts
          </div>
          <div className="flex flex-col gap-2">
            {INTENT_PROMPTS.map((question) => (
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

          <form onSubmit={submitDraft} className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!plan || busy}
              className="min-w-0 flex-1 rounded-lg border border-[#eaf1ac] bg-white px-3 py-2 text-sm text-[#3d4806] placeholder:text-[#6d7208]/60 focus:border-[#9aae37] focus:outline-none"
              placeholder="Or paraphrase an approved intent…"
              type="text"
            />
            <button
              type="submit"
              disabled={!plan || busy || !draft.trim()}
              className="rounded-lg border border-[#7d931d] bg-[#9aae37] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#7e941e] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ask
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

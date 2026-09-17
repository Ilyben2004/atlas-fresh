import { useEffect, useMemo, useRef, useState } from "react";
import { askPlanAssistant, getChatStatus } from "../api/plan";
import { formatEuro, formatNumber, formatTonnes, Icon } from "../utils/format.jsx";

export const INTENT_PROMPTS = [
  {
    tool: "get_clients_at_risk",
    question: "Which clients are at risk and why?",
  },
  {
    tool: "get_farm_segment_gaps",
    question: "Which farm/segment gaps matter most today?",
  },
  {
    tool: "get_local_residual_value",
    question: "Why is fruit going local and what is its estimated value?",
  },
];

const SHORTCUTS_STORAGE_KEY = "atlas_fresh_assistant_shortcuts_open";

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
        <div className="space-y-2 text-[15px] leading-relaxed text-ink">
          {intro.map((line, index) => (
            <p key={`intro-${index}`}>{line}</p>
          ))}
          <ol className="list-decimal space-y-2.5 pl-5 marker:font-semibold marker:text-[#546500]">
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
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
      {cleaned}
    </div>
  );
}

function ModeBadge({ mode }) {
  if (mode === "no_key") {
    return (
      <span className="rounded-sm border border-[#f59e0b]/45 bg-[#fef3c7] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#654a09]">
        No API key
      </span>
    );
  }
  if (mode === "ready") {
    return (
      <span className="rounded-sm border border-[#9aae37]/45 bg-chip-bg px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#3f6b00]">
        Ready
      </span>
    );
  }
  if (mode === "offline") {
    return (
      <span className="rounded-sm border border-[#ef4444]/35 bg-[#fee2e2] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#991b1b]">
        Offline
      </span>
    );
  }
  return null;
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

function readShortcutsOpen() {
  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY);
    if (raw === null) return true;
    return raw === "1" || raw === "true";
  } catch {
    return true;
  }
}

export default function AiPlanAssistant({ plan }) {
  const [mode, setMode] = useState("loading");
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(readShortcutsOpen);
  const bottomRef = useRef(null);

  const deterministicSummary = useMemo(() => buildDeterministicSummary(plan), [plan]);
  const canChat = Boolean(plan) && !busy;

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy, error]);

  useEffect(() => {
    try {
      localStorage.setItem(SHORTCUTS_STORAGE_KEY, shortcutsOpen ? "1" : "0");
    } catch {
      /* ignore quota / private mode */
    }
  }, [shortcutsOpen]);

  async function handleAsk(intent) {
    const question = (intent?.question || "").trim();
    const tool = (intent?.tool || "").trim();
    if (!plan || busy || !question || !tool) return;

    setBusy(true);
    setError(null);
    setMessages((current) => [...current, { role: "user", text: question }]);

    try {
      const payload = await askPlanAssistant(question, plan, tool);
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
          tool: payload.tool || tool,
        },
      ]);
    } catch (err) {
      const message = err.message || "Assistant request failed";
      setError(message);
      const isRejected =
        /not allowed|invalid tool/i.test(message) || /400/.test(message);
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

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return (
    <section className="arch-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="shrink-0 border-b border-line bg-white px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Icon name="smart_toy" className="text-[22px] text-[#546500]" />
              <h2 className="font-display text-xl font-bold text-ink">AI Plan Assistant</h2>
              <ModeBadge mode={mode} />
            </div>
            <p className="mt-1 text-sm text-muted-soft">
              Choose one of the three approved questions. Free typing is disabled.
            </p>
          </div>
          {mode === "ready" && messages.length > 0 ? (
            <button
              type="button"
              onClick={clearChat}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-[#9aae37]/60 hover:bg-chip-bg disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon name="refresh" className="text-[16px] text-[#546500]" />
              Clear chat
            </button>
          ) : null}
        </div>
      </div>

      <div className="view-scroll min-h-0 flex-1 bg-[linear-gradient(180deg,#fafbf4_0%,#ffffff_48%)] px-4 py-4">
        {mode === "loading" ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[#6d7208]">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#9aae37] border-t-transparent" />
            Checking assistant status…
          </div>
        ) : null}

        {mode === "no_key" ? (
          <div className="rounded-xl border border-line bg-white p-5 shadow-[0_1px_0_rgba(61,72,6,0.04)]">
            <div className="font-display text-base font-semibold text-ink">
              Deterministic KPI summary
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink">{deterministicSummary}</p>
            <p className="mt-4 font-mono text-[11px] text-[#6d7208]">
              Set GEMINI_API_KEY on the backend to enable live answers.
            </p>
          </div>
        ) : null}

        {mode === "offline" ? (
          <div className="rounded-xl border border-[#ef4444]/30 bg-[#fee2e2] p-4 text-sm text-[#991b1b]">
            Cannot reach the assistant. Start the backend and try again.
          </div>
        ) : null}

        {mode === "ready" ? (
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
            {messages.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#9aae37]/45 bg-white/80 px-5 py-8 text-center">
                <Icon name="chat" className="mx-auto text-[28px] text-[#7e941e]" />
                <p className="mt-3 font-display text-lg font-semibold text-ink">
                  Choose a question below
                </p>
                <p className="mt-1 text-sm text-muted-soft">
                  Only the three approved questions can be asked.
                </p>
              </div>
            ) : null}

            {messages.map((message, index) => {
              const isUser = message.role === "user";
              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl border px-3.5 py-3 sm:max-w-[85%] ${
                      isUser
                        ? "rounded-br-md border-[#9aae37]/45 bg-[#f2f7d2] text-ink"
                        : "rounded-bl-md border-line bg-white text-ink shadow-[0_1px_0_rgba(61,72,6,0.04)]"
                    }`}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6d7208]">
                      <span>{isUser ? "You" : "Atlas Fresh AI"}</span>
                      {!isUser && friendlyToolLabel(message.tool) ? (
                        <span className="rounded-sm border border-line bg-canvas px-1.5 py-0.5 normal-case tracking-normal text-[#3f6b00]">
                          {friendlyToolLabel(message.tool)}
                        </span>
                      ) : null}
                    </div>
                    {isUser ? (
                      <div className="text-[15px] leading-relaxed">{message.text}</div>
                    ) : (
                      <AssistantMessageBody text={message.text} />
                    )}
                  </div>
                </div>
              );
            })}

            {busy ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-white px-3.5 py-3 text-sm text-[#6d7208]">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#9aae37] border-t-transparent" />
                  Looking up today’s plan…
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-[#ef4444]/35 bg-[#fee2e2] px-3 py-2 text-sm text-[#991b1b]">
                {error}
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>
        ) : null}
      </div>

      {mode === "ready" ? (
        <div className="shrink-0 border-t border-line bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setShortcutsOpen((open) => !open)}
            aria-expanded={shortcutsOpen}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#6d7208]">
              <Icon
                name={shortcutsOpen ? "expand_less" : "expand_more"}
                className="text-[18px] text-[#546500]"
              />
              Approved questions
              <span className="rounded-sm border border-line bg-canvas px-1.5 py-0.5 normal-case tracking-normal text-[#3f6b00]">
                {INTENT_PROMPTS.length}
              </span>
            </span>
            <span className="text-xs font-semibold text-[#546500]">
              {shortcutsOpen ? "Hide" : "Show"}
            </span>
          </button>

          {shortcutsOpen ? (
            <div className="mt-2.5 flex flex-col gap-2">
              {INTENT_PROMPTS.map((intent) => (
                <button
                  key={intent.tool}
                  type="button"
                  disabled={!canChat}
                  onClick={() => handleAsk(intent)}
                  className="group flex items-start gap-2 rounded-xl border border-line bg-white px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:border-[#9aae37]/70 hover:bg-chip-bg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon
                    name="arrow_forward"
                    className="mt-0.5 shrink-0 text-[16px] text-[#7e941e] transition-transform group-hover:translate-x-0.5"
                  />
                  <span>{intent.question}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-soft">
              Questions are hidden. Click Show to pick one.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

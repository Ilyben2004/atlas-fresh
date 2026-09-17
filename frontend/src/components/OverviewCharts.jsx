import { useMemo, useState } from "react";
import { formatNumber, formatTonnes } from "../utils/format.jsx";

/** High-contrast series colors (not near each other on the hue wheel). */
const COLORS = {
  expected: "#2f6fed",
  actual: "#3d4806",
  wanted: "#c45c26",
  received: "#0f7a5a",
  axis: "#eaf1ac",
  label: "#6d7208",
  ink: "#3d4806",
  hoverBand: "rgba(154, 174, 55, 0.12)",
  selectedBand: "rgba(47, 111, 237, 0.14)",
};

function ChartCard({ title, subtitle, legend, children, emptyMessage, isEmpty, footer }) {
  return (
    <div className="arch-card flex min-h-[340px] flex-col overflow-visible rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-soft">{subtitle}</p> : null}
        </div>
        {legend ? (
          <div className="flex flex-wrap items-center gap-2">{legend}</div>
        ) : null}
      </div>
      <div className="mt-4 min-h-0 flex-1">
        {isEmpty ? (
          <div className="flex h-full min-h-[220px] items-center justify-center rounded-lg border border-dashed border-line bg-canvas/60 px-4 text-center text-sm text-muted-soft">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
      {footer && !isEmpty ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}

function LegendButton({ color, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px] font-semibold transition-colors ${
        active
          ? "border-line bg-white text-ink"
          : "border-transparent bg-canvas text-muted line-through opacity-55"
      }`}
      title={active ? `Hide ${label}` : `Show ${label}`}
    >
      <span
        className="inline-block h-2.5 w-2.5 rounded-sm"
        style={{ background: active ? color : "#c8cbb8" }}
      />
      {label}
    </button>
  );
}

function TooltipPanel({ tip, seriesALabel, seriesBLabel, seriesAColor, seriesBColor }) {
  if (!tip) return null;
  const delta = tip.b - tip.a;
  const deltaLabel =
    tip.mode === "farm"
      ? delta >= 0
        ? `+${formatNumber(delta, 1)} t vs expected`
        : `${formatNumber(delta, 1)} t vs expected`
      : `short ${formatNumber(Math.max(0, tip.a - tip.b), 1)} t`;

  // Fixed positioning escapes overflow:hidden / overflow-x-auto clip parents.
  const placeBelow = tip.placeBelow;
  return (
    <div
      className="pointer-events-none fixed z-[80] min-w-[200px] max-w-[260px] rounded-xl border border-line bg-white px-3 py-2.5 shadow-[0_10px_28px_rgba(61,72,6,0.16)]"
      style={{
        left: tip.x,
        top: tip.y,
        transform: placeBelow
          ? "translate(-50%, 12px)"
          : "translate(-50%, calc(-100% - 12px))",
      }}
    >
      <div className="font-display text-sm font-semibold text-ink">{tip.name}</div>
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted">{tip.id}</div>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-soft">
            <span className="h-2 w-2 rounded-sm" style={{ background: seriesAColor }} />
            {seriesALabel}
          </span>
          <span className="metric-number font-semibold text-ink">
            {formatNumber(tip.a, 1)} t
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-1.5 text-muted-soft">
            <span className="h-2 w-2 rounded-sm" style={{ background: seriesBColor }} />
            {seriesBLabel}
          </span>
          <span className="metric-number font-semibold text-ink">
            {formatNumber(tip.b, 1)} t
          </span>
        </div>
      </div>
      <div
        className={`mt-2 border-t border-canvas pt-1.5 font-mono text-[11px] font-semibold ${
          tip.mode === "farm"
            ? tip.b + 1e-9 < tip.a
              ? "text-[#991b1b]"
              : "text-[#3f6b00]"
            : "text-[#991b1b]"
        }`}
      >
        {deltaLabel}
      </div>
    </div>
  );
}

function GroupedBarChart({
  rows,
  seriesAKey,
  seriesBKey,
  seriesALabel,
  seriesBLabel,
  seriesAColor,
  seriesBColor,
  showA = true,
  showB = true,
  mode = "farm",
  labelKey = "label",
  height = 260,
  selectedKey,
  onSelect,
}) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const [tip, setTip] = useState(null);

  const width = Math.max(380, rows.length * 58);
  const padding = { top: 20, right: 14, bottom: 48, left: 42 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [
      showA ? Number(row[seriesAKey]) || 0 : 0,
      showB ? Number(row[seriesBKey]) || 0 : 0,
    ]),
  );
  const niceMax = Math.ceil(maxValue / 5) * 5 || 5;
  const groupWidth = innerW / Math.max(rows.length, 1);
  const barWidth = Math.min(18, groupWidth * 0.34);
  const gap = 4;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => niceMax * t);

  function updateTip(index, event) {
    const row = rows[index];
    if (!row) return;
    const margin = 16;
    const approxTipHeight = 130;
    const placeBelow = event.clientY < approxTipHeight + margin;
    const rawX = event.clientX;
    const clampedX = Math.min(
      Math.max(rawX, 110),
      (typeof window !== "undefined" ? window.innerWidth : rawX) - 110,
    );
    setTip({
      x: clampedX,
      y: event.clientY,
      placeBelow,
      id: row.label,
      name: row.name || row.label,
      a: Number(row[seriesAKey]) || 0,
      b: Number(row[seriesBKey]) || 0,
      mode,
    });
  }

  return (
    <div className="relative w-full overflow-x-auto overflow-y-visible">
      <TooltipPanel
        tip={tip}
        seriesALabel={seriesALabel}
        seriesBLabel={seriesBLabel}
        seriesAColor={seriesAColor}
        seriesBColor={seriesBColor}
      />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="mx-auto block max-w-none"
        role="img"
        onMouseLeave={() => {
          setHoverIndex(null);
          setTip(null);
        }}
      >
        {ticks.map((tick) => {
          const y = padding.top + innerH - (tick / niceMax) * innerH;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={padding.left + innerW}
                y1={y}
                y2={y}
                stroke={COLORS.axis}
                strokeWidth="1"
              />
              <text
                x={padding.left - 8}
                y={y + 3}
                textAnchor="end"
                fill={COLORS.label}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {formatNumber(tick, tick % 1 === 0 ? 0 : 1)}
              </text>
            </g>
          );
        })}

        {rows.map((row, index) => {
          const a = Number(row[seriesAKey]) || 0;
          const b = Number(row[seriesBKey]) || 0;
          const cx = padding.left + index * groupWidth + groupWidth / 2;
          const aH = showA ? (a / niceMax) * innerH : 0;
          const bH = showB ? (b / niceMax) * innerH : 0;
          const baseY = padding.top + innerH;
          const label = String(row[labelKey] || "");
          const shortLabel = label.length > 8 ? `${label.slice(0, 7)}…` : label;
          const isHovered = hoverIndex === index;
          const isSelected = selectedKey === label;
          const dimmed =
            (hoverIndex !== null && !isHovered) ||
            (selectedKey && !isSelected && hoverIndex === null);
          const opacity = dimmed ? 0.28 : 1;

          return (
            <g
              key={`${label}-${index}`}
              style={{ cursor: "pointer" }}
              onMouseEnter={(event) => {
                setHoverIndex(index);
                updateTip(index, event);
              }}
              onMouseMove={(event) => updateTip(index, event)}
              onClick={() => onSelect?.(isSelected ? null : label)}
            >
              <rect
                x={cx - groupWidth / 2 + 2}
                y={padding.top}
                width={Math.max(groupWidth - 4, 8)}
                height={innerH}
                fill={
                  isSelected
                    ? COLORS.selectedBand
                    : isHovered
                      ? COLORS.hoverBand
                      : "transparent"
                }
                rx="4"
              />
              {showA ? (
                <rect
                  x={cx - (showB ? barWidth + gap / 2 : barWidth / 2)}
                  y={baseY - aH}
                  width={barWidth}
                  height={Math.max(aH > 0 ? aH : 0, 0)}
                  fill={seriesAColor}
                  opacity={opacity}
                  rx="3"
                  className="transition-opacity duration-150"
                />
              ) : null}
              {showB ? (
                <rect
                  x={cx + (showA ? gap / 2 : -barWidth / 2)}
                  y={baseY - bH}
                  width={barWidth}
                  height={Math.max(bH > 0 ? bH : 0, 0)}
                  fill={seriesBColor}
                  opacity={opacity}
                  rx="3"
                  className="transition-opacity duration-150"
                />
              ) : null}
              {(isHovered || isSelected) && showA && aH > 12 ? (
                <text
                  x={cx - (showB ? barWidth + gap / 2 : barWidth / 2) + barWidth / 2}
                  y={baseY - aH - 4}
                  textAnchor="middle"
                  fill={seriesAColor}
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                >
                  {formatNumber(a, 0)}
                </text>
              ) : null}
              {(isHovered || isSelected) && showB && bH > 12 ? (
                <text
                  x={cx + (showA ? gap / 2 : -barWidth / 2) + barWidth / 2}
                  y={baseY - bH - 4}
                  textAnchor="middle"
                  fill={seriesBColor}
                  fontSize="9"
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight="700"
                >
                  {formatNumber(b, 0)}
                </text>
              ) : null}
              <text
                x={cx}
                y={height - 18}
                textAnchor="middle"
                fill={isHovered || isSelected ? COLORS.ink : COLORS.label}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight={isHovered || isSelected ? "700" : "600"}
              >
                {shortLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center font-mono text-[10px] text-muted">
        Hover for details · click a bar to pin · click legend to toggle series
      </p>
    </div>
  );
}

function buildFarmRows(plan) {
  const production = plan?.production_view || [];
  return [...production]
    .sort(
      (a, b) =>
        (a.variance_t ?? 0) - (b.variance_t ?? 0) ||
        String(a.farm_id).localeCompare(String(b.farm_id)),
    )
    .map((row) => ({
      label: row.farm_id,
      expected: Number(row.expected_daily_capacity) || 0,
      actual: Number(row.actual_delivered) || 0,
      name: row.farm_name || row.farm_id,
    }));
}

function buildClientFillRows(plan) {
  const commercial = plan?.commercial_view || [];
  return commercial
    .filter((row) => {
      const status = String(row.status || "").toUpperCase();
      return status === "PARTIAL" || status === "UNSERVED";
    })
    .map((row) => ({
      label: row.client_id,
      wanted: Number(row.demand) || 0,
      received: Number(row.allocated_t) || 0,
      name: row.client_name || row.client_id,
      status: row.status,
    }))
    .sort((a, b) => b.wanted - b.received - (a.wanted - a.received));
}

function InteractiveChart({
  title,
  subtitle,
  rows,
  seriesAKey,
  seriesBKey,
  seriesALabel,
  seriesBLabel,
  seriesAColor,
  seriesBColor,
  mode,
  emptyMessage,
  footerExtra,
}) {
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);

  const selected = rows.find((row) => row.label === selectedKey);

  return (
    <ChartCard
      title={title}
      subtitle={subtitle}
      legend={
        <>
          <LegendButton
            color={seriesAColor}
            label={seriesALabel}
            active={showA}
            onClick={() => setShowA((v) => (showB || !v ? !v : v))}
          />
          <LegendButton
            color={seriesBColor}
            label={seriesBLabel}
            active={showB}
            onClick={() => setShowB((v) => (showA || !v ? !v : v))}
          />
        </>
      }
      isEmpty={rows.length === 0}
      emptyMessage={emptyMessage}
      footer={
        selected ? (
          <div className="rounded-lg border border-line bg-canvas/70 px-3 py-2 text-sm text-ink">
            <span className="font-semibold">{selected.name}</span>{" "}
            <span className="font-mono text-[11px] text-muted">({selected.label})</span>
            <span className="mx-2 text-muted">·</span>
            <span className="font-mono text-[12px]">
              {seriesALabel} {formatNumber(selected[seriesAKey], 1)} t · {seriesBLabel}{" "}
              {formatNumber(selected[seriesBKey], 1)} t
            </span>
            {footerExtra?.(selected)}
          </div>
        ) : (
          footerExtra?.(null)
        )
      }
    >
      <GroupedBarChart
        rows={rows}
        seriesAKey={seriesAKey}
        seriesBKey={seriesBKey}
        seriesALabel={seriesALabel}
        seriesBLabel={seriesBLabel}
        seriesAColor={seriesAColor}
        seriesBColor={seriesBColor}
        showA={showA}
        showB={showB}
        mode={mode}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />
    </ChartCard>
  );
}

export default function OverviewCharts({ plan }) {
  const farmRows = useMemo(() => buildFarmRows(plan), [plan]);
  const clientRows = useMemo(() => buildClientFillRows(plan), [plan]);

  if (!plan?.kpis) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Expected vs actual"
          subtitle="Farm delivery vs daily capacity"
          isEmpty
          emptyMessage="Upload a workbook to see farm expected vs actual."
        />
        <ChartCard
          title="Client fill rate"
          subtitle="Wanted vs received for at-risk clients"
          isEmpty
          emptyMessage="Upload a workbook to see client fill rates."
        />
      </div>
    );
  }

  const shortFarms = farmRows.filter((row) => row.actual + 1e-9 < row.expected).length;

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <InteractiveChart
        title="Expected vs actual"
        subtitle={
          shortFarms
            ? `${farmRows.length} farms · ${shortFarms} short of expected`
            : `${farmRows.length} farms · all meeting expected`
        }
        rows={farmRows}
        seriesAKey="expected"
        seriesBKey="actual"
        seriesALabel="Expected"
        seriesBLabel="Actual"
        seriesAColor={COLORS.expected}
        seriesBColor={COLORS.actual}
        mode="farm"
        emptyMessage="No farm production rows in this plan."
        footerExtra={(selected) =>
          selected ? null : (
            <p className="font-mono text-[11px] text-muted">
              Totals · expected {formatTonnes(farmRows.reduce((s, r) => s + r.expected, 0))} ·
              actual {formatTonnes(farmRows.reduce((s, r) => s + r.actual, 0))}
            </p>
          )
        }
      />

      <InteractiveChart
        title="Client fill rate"
        subtitle="Wanted vs received for at-risk clients"
        rows={clientRows}
        seriesAKey="wanted"
        seriesBKey="received"
        seriesALabel="Wanted"
        seriesBLabel="Received"
        seriesAColor={COLORS.wanted}
        seriesBColor={COLORS.received}
        mode="client"
        emptyMessage="No at-risk clients today — every order is fully served."
        footerExtra={(selected) =>
          selected ? null : (
            <ul className="space-y-1.5 border-t border-canvas pt-3">
              {clientRows.map((row) => {
                const short = Math.max(0, row.wanted - row.received);
                return (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-2 text-sm text-ink"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{row.name}</span>{" "}
                      <span className="font-mono text-[11px] text-muted">({row.label})</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] font-semibold text-[#991b1b]">
                      short {formatNumber(short, 0)} t
                    </span>
                  </li>
                );
              })}
            </ul>
          )
        }
      />
    </div>
  );
}

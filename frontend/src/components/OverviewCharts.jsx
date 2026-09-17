import { useMemo } from "react";
import { formatNumber, formatTonnes } from "../utils/format.jsx";

const COLORS = {
  expected: "#c5d46a",
  actual: "#546500",
  wanted: "#c5d46a",
  received: "#7e941e",
  axis: "#eaf1ac",
  label: "#6d7208",
  ink: "#3d4806",
};

function ChartCard({ title, subtitle, legend, children, emptyMessage, isEmpty }) {
  return (
    <div className="arch-card flex min-h-[320px] flex-col rounded-xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-muted-soft">{subtitle}</p> : null}
        </div>
        {legend ? (
          <div className="flex flex-wrap items-center gap-3">{legend}</div>
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
    </div>
  );
}

function LegendSwatch({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-muted">
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Compact grouped vertical bar chart (two series per category). */
function GroupedBarChart({
  rows,
  seriesAKey,
  seriesBKey,
  seriesAColor,
  seriesBColor,
  labelKey = "label",
  valueSuffix = " t",
  height = 240,
}) {
  const width = Math.max(360, rows.length * 56);
  const padding = { top: 16, right: 12, bottom: 52, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const maxValue = Math.max(
    1,
    ...rows.flatMap((row) => [Number(row[seriesAKey]) || 0, Number(row[seriesBKey]) || 0]),
  );
  const niceMax = Math.ceil(maxValue / 5) * 5 || 5;
  const groupWidth = innerW / rows.length;
  const barWidth = Math.min(16, groupWidth * 0.32);
  const gap = 3;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => niceMax * t);

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className="mx-auto block max-w-none"
        role="img"
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
          const aH = (a / niceMax) * innerH;
          const bH = (b / niceMax) * innerH;
          const baseY = padding.top + innerH;
          const label = String(row[labelKey] || "");
          const shortLabel = label.length > 8 ? `${label.slice(0, 7)}…` : label;

          return (
            <g key={`${label}-${index}`}>
              <rect
                x={cx - barWidth - gap / 2}
                y={baseY - aH}
                width={barWidth}
                height={Math.max(0, aH)}
                fill={seriesAColor}
                rx="2"
              >
                <title>{`${label}: ${formatNumber(a, 1)}${valueSuffix}`}</title>
              </rect>
              <rect
                x={cx + gap / 2}
                y={baseY - bH}
                width={barWidth}
                height={Math.max(0, bH)}
                fill={seriesBColor}
                rx="2"
              >
                <title>{`${label}: ${formatNumber(b, 1)}${valueSuffix}`}</title>
              </rect>
              <text
                x={cx}
                y={height - 28}
                textAnchor="middle"
                fill={COLORS.ink}
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fontWeight="600"
              >
                {shortLabel}
              </text>
              <text
                x={cx}
                y={height - 14}
                textAnchor="middle"
                fill={COLORS.label}
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                {row.sublabel || ""}
              </text>
            </g>
          );
        })}
      </svg>
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
      sublabel: "",
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
      sublabel: "",
      wanted: Number(row.demand) || 0,
      received: Number(row.allocated_t) || 0,
      name: row.client_name || row.client_id,
      status: row.status,
    }))
    .sort((a, b) => b.wanted - b.received - (a.wanted - a.received));
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
      <ChartCard
        title="Expected vs actual"
        subtitle={
          shortFarms
            ? `${farmRows.length} farms · ${shortFarms} short of expected`
            : `${farmRows.length} farms · all meeting expected`
        }
        legend={
          <>
            <LegendSwatch color={COLORS.expected} label="Expected" />
            <LegendSwatch color={COLORS.actual} label="Actual" />
          </>
        }
        isEmpty={farmRows.length === 0}
        emptyMessage="No farm production rows in this plan."
      >
        <GroupedBarChart
          rows={farmRows}
          seriesAKey="expected"
          seriesBKey="actual"
          seriesAColor={COLORS.expected}
          seriesBColor={COLORS.actual}
        />
        <p className="mt-2 font-mono text-[11px] text-muted">
          Totals · expected {formatTonnes(farmRows.reduce((s, r) => s + r.expected, 0))} ·
          actual {formatTonnes(farmRows.reduce((s, r) => s + r.actual, 0))}
        </p>
      </ChartCard>

      <ChartCard
        title="Client fill rate"
        subtitle="Wanted vs received for at-risk clients"
        legend={
          <>
            <LegendSwatch color={COLORS.wanted} label="Wanted" />
            <LegendSwatch color={COLORS.received} label="Received" />
          </>
        }
        isEmpty={clientRows.length === 0}
        emptyMessage="No at-risk clients today — every order is fully served."
      >
        <GroupedBarChart
          rows={clientRows}
          seriesAKey="wanted"
          seriesBKey="received"
          seriesAColor={COLORS.wanted}
          seriesBColor={COLORS.received}
        />
        <ul className="mt-3 space-y-1.5 border-t border-canvas pt-3">
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
      </ChartCard>
    </div>
  );
}

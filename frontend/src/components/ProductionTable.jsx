import { useMemo, useState } from "react";
import { SortableTh, useSortableRows } from "../hooks/useSortableRows.jsx";
import { formatNumber, formatTonnes, Icon, Metric } from "../utils/format.jsx";

function SegmentMix({ row }) {
  const segments = [
    {
      key: "A",
      tone: "bg-chip-bg text-[#3f6b00] border-[#9aae37]/40",
    },
    {
      key: "B",
      tone: "bg-canvas text-ink border-line",
    },
    {
      key: "C",
      tone: "bg-[#fff7ed] text-[#9b4500] border-[#fdba74]/50",
    },
    {
      key: "D",
      tone: "bg-[#f8faf0] text-muted border-line",
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {segments.map((segment) => {
        const actual = Number(row[`actual_${segment.key}`] ?? 0);
        const expected = Number(row[`expected_${segment.key}`] ?? 0);
        const variance = Number(row[`variance_${segment.key}`] ?? actual - expected);
        const varLabel =
          Math.abs(variance) < 1e-9
            ? "0"
            : `${variance > 0 ? "+" : ""}${formatNumber(variance)}`;
        return (
          <span
            key={segment.key}
            title={`Expected ${formatNumber(expected)} t · Actual ${formatNumber(actual)} t · Δ ${varLabel} t`}
            className={`rounded-sm border px-2 py-1 font-mono text-[11px] font-semibold ${segment.tone}`}
          >
            <span className="opacity-70">{segment.key}</span>{" "}
            {formatNumber(actual, actual % 1 === 0 ? 0 : 1)}
            <span className="mx-0.5 opacity-50">/</span>
            {formatNumber(expected, expected % 1 === 0 ? 0 : 1)}
            <span
              className={`ml-1 ${
                variance < -1e-9
                  ? "text-[#991b1b]"
                  : variance > 1e-9
                    ? "text-[#3f6b00]"
                    : "opacity-60"
              }`}
            >
              ({varLabel})
            </span>
          </span>
        );
      })}
    </div>
  );
}

function VarianceBadge({ value }) {
  const n = Number(value ?? 0);
  if (Math.abs(n) < 1e-9) {
    return (
      <span className="inline-flex items-center rounded-sm border border-line bg-canvas px-2.5 py-1 font-mono text-[12px] font-semibold text-muted">
        0.0 t
      </span>
    );
  }
  if (n > 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm border border-[#9aae37]/45 bg-chip-bg px-2.5 py-1 font-mono text-[12px] font-bold text-[#3f6b00]">
        <Icon name="arrow_upward" className="text-[14px]" />+{formatNumber(n)} t
      </span>
    );
  }
  const critical = n <= -5;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2.5 py-1 font-mono text-[12px] font-bold ${
        critical
          ? "border-[#ef4444]/40 bg-[#fee2e2] text-[#991b1b]"
          : "border-[#f59e0b]/40 bg-warn-bg text-warn-ink"
      }`}
    >
      <Icon
        name={critical ? "priority_high" : "arrow_downward"}
        className="text-[14px]"
      />
      {formatNumber(n)} t
    </span>
  );
}

export default function ProductionTable({ plan }) {
  const rows = plan?.production_view ?? [];
  const kpis = plan?.kpis;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const hay = `${row.farm_id} ${row.farm_name || ""}`.toLowerCase();
      if (q && !hay.includes(q)) return false;
      if (filter === "shortages") return row.variance_t < -1e-9;
      if (filter === "surplus") return row.variance_t > 1e-9;
      return true;
    });
  }, [rows, query, filter]);

  const sortableRows = useMemo(
    () =>
      filtered.map((row) => ({
        ...row,
        farm_label: `${row.farm_id} ${row.farm_name || ""}`,
      })),
    [filtered],
  );

  const { sortedRows, sortKey, sortDir, toggleSort } = useSortableRows(
    sortableRows,
    "farm_id",
    "asc",
  );

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (acc, row) => {
        acc.expected += row.expected_daily_capacity || 0;
        acc.actual += row.actual_delivered || 0;
        acc.residual += row.local_residual_t || 0;
        acc.variance += row.variance_t || 0;
        return acc;
      },
      { expected: 0, actual: 0, residual: 0, variance: 0 },
    );
  }, [sortedRows]);

  const shortageCount = rows.filter((row) => row.variance_t < -1e-9).length;
  const surplusCount = rows.filter((row) => row.variance_t > 1e-9).length;

  return (
    <section className="arch-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="flex shrink-0 flex-col justify-between gap-4 border-b border-line bg-white p-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="font-display text-xl font-bold text-ink">Production View</h2>
            {kpis ? (
              <span className="rounded-sm border border-line bg-header-band px-2.5 py-1 font-mono text-[11px] font-semibold text-ink">
                Intake {formatTonnes(kpis.total_actual_received_t)} · Ceiling{" "}
                {formatTonnes(kpis.export_capacity_t)} · Local{" "}
                {formatTonnes(kpis.total_local_residual_t)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-soft">
            Expected mix vs actual A/B/C/D · segment Δ in parentheses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Icon
              name="search"
              className="absolute left-2.5 top-2.5 text-[16px] text-[#767965]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-52 rounded-lg border border-line bg-canvas py-2 pl-8 pr-3 font-mono text-[12px] text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
              placeholder="Filter orchard..."
              type="search"
            />
          </div>
          <div className="inline-flex rounded-lg border border-line bg-canvas p-0.5">
            {[
              { id: "all", label: `All (${rows.length})` },
              { id: "shortages", label: `Short (${shortageCount})` },
              { id: "surplus", label: `Surplus (${surplusCount})` },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`rounded px-2.5 py-1.5 font-mono text-[11px] ${
                  filter === item.id
                    ? "bg-white font-semibold text-ink shadow-sm"
                    : "text-muted-soft hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="view-scroll w-full">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-line-strong bg-header-band font-mono text-[11px] tracking-wider">
              <SortableTh
                label="Farm"
                sortKey="farm_id"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Expected"
                sortKey="expected_daily_capacity"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableTh
                label="Actual"
                sortKey="actual_delivered"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <th className="px-4 py-3.5 text-left font-semibold uppercase tracking-wider text-ink">
                Mix actual / expected (Δ)
              </th>
              <SortableTh
                label="Variance"
                sortKey="variance_t"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableTh
                label="Local Residual"
                sortKey="local_residual_t"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-row-line">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-sm text-muted-soft">
                  {rows.length === 0
                    ? "Upload a workbook to populate farm supply variances."
                    : "No farms match the current filter."}
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => (
                <tr
                  key={row.farm_id}
                  className={`transition-colors hover:bg-canvas ${
                    index % 2 === 1 ? "bg-row-alt" : "bg-white"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-ink">
                        {row.farm_id}
                      </span>
                      <span className="font-mono text-[13px] font-semibold text-ink-deep">
                        {row.farm_name || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Metric size="sm" tone="muted">
                      {formatTonnes(row.expected_daily_capacity)}
                    </Metric>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Metric size="sm" tone="deep">
                      {formatTonnes(row.actual_delivered)}
                    </Metric>
                  </td>
                  <td className="px-4 py-3">
                    <SegmentMix row={row} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <VarianceBadge value={row.variance_t} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="rounded-sm border border-[#9aae37]/35 bg-chip-bg px-2.5 py-1 font-mono text-[12px] font-bold text-[#3f6b00]">
                      {formatTonnes(row.local_residual_t)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {sortedRows.length > 0 ? (
        <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-line-strong bg-header-band px-4 py-3 md:grid-cols-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Expected
            </div>
            <Metric size="md" tone="ink">
              {formatTonnes(totals.expected)}
            </Metric>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Actual
            </div>
            <Metric size="md" tone="deep">
              {formatTonnes(totals.actual)}
            </Metric>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Net Variance
            </div>
            <Metric size="md" tone={totals.variance < 0 ? "warn" : "good"}>
              {formatNumber(totals.variance)} t
            </Metric>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Local Residual
            </div>
            <Metric size="md" tone="warn">
              {formatTonnes(totals.residual)}
            </Metric>
          </div>
        </div>
      ) : null}
    </section>
  );
}

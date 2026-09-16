import { useMemo } from "react";
import { SortableTh, useSortableRows } from "../hooks/useSortableRows.jsx";
import { formatEuroExact, formatTonnes, Icon, Metric } from "../utils/format.jsx";

function StatusBadge({ status }) {
  const styles = {
    COMPLETE: "bg-chip-bg text-[#3f6b00] border-[#9aae37]/45",
    PARTIAL: "bg-warn-bg text-warn-ink border-[#f59e0b]/45",
    UNSERVED: "bg-[#fee2e2] text-[#991b1b] border-[#ef4444]/40",
  };
  return (
    <span
      className={`rounded-sm border px-2.5 py-1 font-mono text-[12px] font-bold tracking-wide ${
        styles[status] || "border-line bg-canvas text-muted"
      }`}
    >
      {status}
    </span>
  );
}

export default function CommercialTable({ plan }) {
  const rows = plan?.commercial_view ?? [];
  const sortableRows = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        shortage_sort: row.shortage_reason || "",
      })),
    [rows],
  );
  const { sortedRows, sortKey, sortDir, toggleSort } = useSortableRows(
    sortableRows,
    "client_id",
    "asc",
  );

  return (
    <section className="arch-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="shrink-0 border-b border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="handshake" className="text-[22px] text-[#546500]" />
          <h2 className="font-display text-xl font-bold text-ink">Commercial View</h2>
          <span className="rounded-sm border border-line bg-header-band px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
            {rows.length} clients
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-soft">
          Click any column header to sort · EXACT / MINIMUM segment rules
        </p>
      </div>

      <div className="view-scroll w-full">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-line-strong bg-header-band font-mono text-[11px] tracking-wider">
              <SortableTh
                label="Client"
                sortKey="client_id"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Mode"
                sortKey="acceptance_mode"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Segment"
                sortKey="requested_segment"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Demand"
                sortKey="demand"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableTh
                label="Allocated"
                sortKey="allocated_t"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableTh
                label="Price"
                sortKey="export_price_per_eur"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableTh
                label="Status"
                sortKey="status"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Shortage"
                sortKey="shortage_sort"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-row-line">
            {sortedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center text-sm text-muted-soft">
                  Client allocations appear after a successful plan upload.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => (
                <tr
                  key={row.client_id}
                  className={`hover:bg-canvas ${index % 2 === 1 ? "bg-row-alt" : "bg-white"}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-semibold text-ink">
                        {row.client_id}
                      </span>
                      <span className="font-mono text-[13px] font-semibold text-ink-deep">
                        {row.client_name || "—"}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold text-ink">
                    {row.acceptance_mode}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-[#9aae37]/35 bg-chip-bg px-2.5 py-1 font-mono text-[12px] font-bold text-[#3f6b00]">
                      {row.requested_segment}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Metric size="sm" tone="muted">
                      {formatTonnes(row.demand)}
                    </Metric>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Metric
                      size="sm"
                      tone={
                        row.status === "COMPLETE"
                          ? "good"
                          : row.status === "PARTIAL"
                            ? "warn"
                            : "danger"
                      }
                    >
                      {formatTonnes(row.allocated_t)}
                    </Metric>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Metric size="sm" tone="deep">
                      {formatEuroExact(row.export_price_per_eur)}
                    </Metric>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">
                    {row.shortage_reason || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

import { SortableTh, useSortableRows } from "../hooks/useSortableRows.jsx";
import { formatEuroExact, formatTonnes, Icon, Metric } from "../utils/format.jsx";

export default function LedgerTable({ plan }) {
  const rows = plan?.traceability_ledger ?? [];
  const { sortedRows, sortKey, sortDir, toggleSort } = useSortableRows(
    rows,
    "farm_id",
    "asc",
  );

  return (
    <section className="arch-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="shrink-0 border-b border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name="receipt_long" className="text-[22px] text-[#546500]" />
          <h2 className="font-display text-xl font-bold text-ink">Traceability Ledger</h2>
          <span className="rounded-sm border border-line bg-header-band px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
            {rows.length} transfers
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-soft">
          Sorted by farm by default · click any column header to re-sort
        </p>
      </div>

      <div className="view-scroll w-full">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-line-strong bg-header-band font-mono text-[11px] tracking-wider">
              <th className="px-4 py-3.5 font-semibold text-ink">#</th>
              <SortableTh
                label="Farm"
                sortKey="farm_id"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Segment"
                sortKey="segment"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Client"
                sortKey="client_id"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
              />
              <SortableTh
                label="Tonnes"
                sortKey="tonnes_allocated"
                activeKey={sortKey}
                direction={sortDir}
                onSort={toggleSort}
                align="right"
              />
              <SortableTh
                label="Export Revenue"
                sortKey="export_revenue_eur"
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
                  Ledger rows appear when export allocations are created.
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => (
                <tr
                  key={`${row.farm_id}-${row.client_id}-${row.segment}-${index}`}
                  className={index % 2 === 1 ? "bg-row-alt" : "bg-white"}
                >
                  <td className="px-4 py-3 font-mono text-[12px] text-muted">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold text-ink">
                    {row.farm_id}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-sm border border-[#9aae37]/35 bg-chip-bg px-2.5 py-1 font-mono text-[12px] font-bold text-[#3f6b00]">
                      {row.segment}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold text-ink">
                    {row.client_id}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Metric size="sm" tone="accent">
                      {formatTonnes(row.tonnes_allocated)}
                    </Metric>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Metric size="sm" tone="deep">
                      {formatEuroExact(row.export_revenue_eur)}
                    </Metric>
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

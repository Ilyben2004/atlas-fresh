import { formatEuro, formatNumber, formatPct, formatTonnes, Icon, Metric } from "../utils/format.jsx";

function KpiCard({ children, className = "" }) {
  return (
    <div
      className={`arch-card arch-card-hover flex min-h-[168px] flex-col justify-between rounded-xl p-5 transition-all ${className}`}
    >
      {children}
    </div>
  );
}

export default function KpiGrid({ plan, updatedAt }) {
  const kpis = plan?.kpis;
  const empty = !kpis;

  const exported = kpis?.total_exported_t ?? 0;
  const capacity = kpis?.export_capacity_t ?? 500;
  const saturation = capacity > 0 ? (exported / capacity) * 100 : 0;
  const stationFull = exported >= capacity - 1e-9;
  const totalValue =
    (kpis?.total_export_revenue_eur ?? 0) + (kpis?.total_local_revenue_eur ?? 0);
  const avgPerKg =
    (kpis?.total_actual_received_t ?? 0) > 0
      ? totalValue / (kpis.total_actual_received_t * 1000)
      : 0;

  return (
    <section className="flex h-full min-h-0 flex-col gap-5">
      <div className="shrink-0 flex flex-col justify-between gap-3 border-b border-line pb-3 md:flex-row md:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Icon name="analytics" className="text-[22px] text-[#546500]" />
            <h1 className="font-display text-[28px] font-bold tracking-tight text-ink">
              Executive Overview
            </h1>
            <span className="rounded-sm bg-line px-2 py-0.5 font-mono text-[11px] font-semibold text-ink">
              Daily Allocation
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-soft">
            Farm intake thresholds and realization telemetry
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted">
          <Icon name="schedule" className="text-[16px]" />
          <span>
            {updatedAt
              ? `Updated ${updatedAt}`
              : "Upload an Excel workbook to compute the plan"}
          </span>
        </div>
      </div>

      <div className="view-scroll grid grid-cols-1 content-start gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        <KpiCard>
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Export Capacity
            </span>
            <span className="rounded-sm border border-[#9aae37]/40 bg-chip-bg px-2 py-0.5 font-mono text-[11px] font-semibold text-[#3f6b00]">
              {empty ? "—" : `${formatNumber(saturation, 0)}%`}
            </span>
          </div>
          <div className="mt-4">
            <Metric tone={stationFull && !empty ? "danger" : "accent"} size="xl">
              {empty
                ? "— / —"
                : `${formatNumber(exported, 0)} / ${formatNumber(capacity, 0)}`}
            </Metric>
            <div className="mt-1 text-sm font-medium text-muted">tonnes</div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full border border-line bg-canvas">
              <div
                className={`h-full rounded-full transition-all ${
                  stationFull ? "bg-[#ba1a1a]" : "bg-accent-strong"
                }`}
                style={{ width: `${empty ? 0 : Math.min(100, saturation)}%` }}
              />
            </div>
          </div>
          <div className="mt-4 border-t border-canvas pt-3 font-mono text-[12px]">
            {empty ? (
              <span className="text-muted">Station conditioning limit</span>
            ) : stationFull ? (
              <span className="font-semibold text-[#991b1b]">Station limit reached</span>
            ) : (
              <span className="text-[#3f6b00]">Capacity remaining</span>
            )}
          </div>
        </KpiCard>

        <KpiCard>
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Export Rate
            </span>
            <span className="flex items-center gap-0.5 rounded-sm bg-chip-bg px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#3f6b00]">
              <Icon name="trending_up" className="text-[14px]" />
              of supply
            </span>
          </div>
          <div className="mt-4">
            <Metric tone="accent" size="xl">
              {empty ? "—" : formatPct(kpis.export_rate_pct, 1)}
            </Metric>
            <div className="mt-2 text-sm text-muted-soft">Of total actual supply</div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-canvas pt-3 font-mono text-[12px] text-muted">
            <Icon name="verified" className="text-[16px] text-[#546500]" />
            Intake {empty ? "—" : formatTonnes(kpis.total_actual_received_t)}
          </div>
        </KpiCard>

        <KpiCard>
          <div className="flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted">
              Total Value
            </span>
            <span className="rounded-sm border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink">
              EUR
            </span>
          </div>
          <div className="mt-4">
            <Metric tone="deep" size="xl">
              {empty ? "—" : formatEuro(totalValue)}
            </Metric>
            <div className="mt-2 text-sm text-muted-soft">
              Export + local revenue combined
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-canvas pt-3 font-mono text-[12px] text-muted">
            <span>Avg realization</span>
            <span className="metric-number text-[14px] font-semibold text-ink">
              {empty ? "—" : `€${avgPerKg.toFixed(3)} / kg`}
            </span>
          </div>
        </KpiCard>

        <div className="relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl border border-[#f59e0b]/45 bg-[#fffdf5] p-5 transition-all sm:col-span-2 xl:col-span-1">
          <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-[#fef3c7]/70" />
          <div className="relative z-10 flex items-start justify-between gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-warn-accent">
              Local Volume
            </span>
            <span className="flex items-center gap-1 rounded-sm border border-[#f59e0b]/40 bg-warn-bg px-2 py-0.5 font-mono text-[11px] font-bold text-warn-ink">
              <Icon name="warning" className="text-[13px] text-warn-accent" />
              Spillover
            </span>
          </div>
          <div className="relative z-10 mt-4">
            <Metric tone="warn" size="xl">
              {empty ? "—" : formatNumber(kpis.total_local_residual_t, 0)}
            </Metric>
            <div className="mt-1 text-sm font-medium text-warn-accent">tonnes residual</div>
            <div className="mt-2 metric-number text-[16px] font-semibold text-warn-ink">
              {empty ? "—" : formatEuro(kpis.total_local_revenue_eur)} impact
            </div>
          </div>
          <div className="relative z-10 mt-4 flex items-center gap-1 border-t border-[#fef3c7] pt-3 font-mono text-[12px] text-warn-ink">
            <Icon name="priority_high" className="text-[15px]" />
            Unallocated after export fill
          </div>
        </div>
      </div>
    </section>
  );
}

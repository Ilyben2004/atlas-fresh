import { useMemo, useState } from "react";
import { Icon } from "../utils/format.jsx";

const TABS = [
  { id: "farms", label: "Farms" },
  { id: "clients", label: "Clients" },
  { id: "station", label: "Station" },
];

function cloneInputs(inputs) {
  return JSON.parse(JSON.stringify(inputs));
}

function emptyFarm(index = 1) {
  const id = `F${String(index).padStart(2, "0")}`;
  return {
    farm_id: id,
    farm_name: `Farm ${id}`,
    expected_daily_capacity: 40,
    expected_A_pct: 0.25,
    expected_B_pct: 0.25,
    expected_C_pct: 0.25,
    expected_D_pct: 0.25,
    actual_A: 0,
    actual_B: 0,
    actual_C: 0,
    actual_D: 0,
  };
}

function emptyClient(index = 1) {
  const id = `C${String(index).padStart(2, "0")}`;
  return {
    client_id: id,
    client_name: `Client ${id}`,
    acceptance_mode: "EXACT",
    requested_segment: "A",
    demand: 10,
    export_price_per_eur: 1,
  };
}

function NumberCell({ value, onChange, step = "any", className = "" }) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(Number(value)) ? value : ""}
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? 0 : Number(raw));
      }}
      className={`w-full min-w-[4.5rem] rounded border border-line bg-white px-2 py-1.5 font-mono text-[12px] text-ink focus:border-accent focus:outline-none ${className}`}
    />
  );
}

function TextCell({ value, onChange, className = "" }) {
  return (
    <input
      type="text"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className={`w-full min-w-[5rem] rounded border border-line bg-white px-2 py-1.5 font-mono text-[12px] text-ink focus:border-accent focus:outline-none ${className}`}
    />
  );
}

function SelectCell({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded border border-line bg-white px-2 py-1.5 font-mono text-[12px] text-ink focus:border-accent focus:outline-none"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default function InputsEditor({
  draftInputs,
  savedInputs,
  dirty,
  planning,
  error,
  onChangeDraft,
  onSave,
  onPlan,
}) {
  const [tab, setTab] = useState("farms");

  const hasDraft = Boolean(draftInputs?.farms && draftInputs?.clients && draftInputs?.station);
  const canSave = hasDraft && dirty && !planning;
  const canPlan = Boolean(savedInputs) && !dirty && !planning;

  const farmCount = draftInputs?.farms?.length ?? 0;
  const clientCount = draftInputs?.clients?.length ?? 0;

  const stationPrices = useMemo(() => {
    const prices = { A: 0, B: 0, C: 0, D: 0 };
    for (const row of draftInputs?.station?.segment_prices || []) {
      const seg = String(row.segment || "").toUpperCase();
      if (seg in prices) {
        prices[seg] = row.reference_export_price_per_eur;
      }
    }
    return prices;
  }, [draftInputs]);

  function updateFarms(updater) {
    const next = cloneInputs(draftInputs);
    next.farms = updater(next.farms);
    onChangeDraft(next);
  }

  function updateClients(updater) {
    const next = cloneInputs(draftInputs);
    next.clients = updater(next.clients);
    onChangeDraft(next);
  }

  function updateStation(patch) {
    const next = cloneInputs(draftInputs);
    next.station = { ...next.station, ...patch };
    onChangeDraft(next);
  }

  function updateStationPrice(segment, value) {
    const next = cloneInputs(draftInputs);
    const list = [...(next.station.segment_prices || [])];
    const index = list.findIndex(
      (row) => String(row.segment || "").toUpperCase() === segment,
    );
    if (index >= 0) {
      list[index] = {
        ...list[index],
        segment,
        reference_export_price_per_eur: value,
      };
    } else {
      list.push({ segment, reference_export_price_per_eur: value });
    }
    next.station.segment_prices = list;
    onChangeDraft(next);
  }

  if (!hasDraft) {
    return (
      <section className="arch-card flex h-full min-h-0 flex-col items-center justify-center gap-3 rounded-xl px-6 text-center">
        <Icon name="edit_note" className="text-[32px] text-[#7e941e]" />
        <h2 className="font-display text-2xl font-bold text-ink">No sheet data yet</h2>
        <p className="max-w-md text-sm text-muted-soft">
          Upload an Excel workbook first. Farms, Clients, and Station will appear here so you
          can edit, Save, then Plan.
        </p>
      </section>
    );
  }

  return (
    <section className="arch-card flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-line bg-white p-4 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Icon name="edit_note" className="text-[22px] text-[#546500]" />
            <h2 className="font-display text-xl font-bold text-ink">Input sheets</h2>
            {dirty ? (
              <span className="rounded-sm border border-[#f59e0b]/45 bg-[#fef3c7] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#654a09]">
                Unsaved
              </span>
            ) : (
              <span className="rounded-sm border border-[#9aae37]/45 bg-chip-bg px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#3f6b00]">
                Saved
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-soft">
            Edit Farms, Clients, and Station · Save your draft · Plan to recompute
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!canSave}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-[#9aae37]/60 hover:bg-chip-bg disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="save" className="text-[16px] text-[#546500]" />
            Save
          </button>
          <button
            type="button"
            disabled={!canPlan}
            onClick={onPlan}
            className="inline-flex items-center gap-1.5 rounded-lg border border-accent-border bg-accent-strong px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon name="play_arrow" className="text-[18px]" />
            {planning ? "Planning…" : "Plan"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="shrink-0 border-b border-[#ef4444]/30 bg-[#fee2e2] px-4 py-3 text-sm text-[#991b1b]">
          <div className="font-semibold">Could not build the plan</div>
          <div className="mt-1 whitespace-pre-line leading-relaxed">{error}</div>
        </div>
      ) : null}

      <div className="flex shrink-0 gap-1 border-b border-line bg-header-band px-3 py-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider ${
              tab === item.id
                ? "bg-white text-ink shadow-sm"
                : "text-muted-soft hover:text-ink"
            }`}
          >
            {item.label}
            {item.id === "farms" ? ` (${farmCount})` : null}
            {item.id === "clients" ? ` (${clientCount})` : null}
          </button>
        ))}
      </div>

      <div className="view-scroll min-h-0 flex-1">
        {tab === "farms" ? (
          <div className="p-3">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  updateFarms((rows) => [...rows, emptyFarm(rows.length + 1)])
                }
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-chip-bg"
              >
                <Icon name="add" className="text-[16px]" />
                Add farm
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-strong bg-header-band font-mono text-[10px] uppercase tracking-wider text-ink">
                    <th className="px-2 py-2">ID</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Expected t</th>
                    <th className="px-2 py-2">A %</th>
                    <th className="px-2 py-2">B %</th>
                    <th className="px-2 py-2">C %</th>
                    <th className="px-2 py-2">D %</th>
                    <th className="px-2 py-2">Actual A</th>
                    <th className="px-2 py-2">Actual B</th>
                    <th className="px-2 py-2">Actual C</th>
                    <th className="px-2 py-2">Actual D</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-row-line">
                  {draftInputs.farms.map((row, index) => (
                    <tr key={`farm-${index}`} className="bg-white">
                      <td className="px-2 py-1.5">
                        <TextCell
                          value={row.farm_id}
                          onChange={(value) =>
                            updateFarms((rows) => {
                              const copy = [...rows];
                              copy[index] = { ...copy[index], farm_id: value };
                              return copy;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <TextCell
                          value={row.farm_name}
                          onChange={(value) =>
                            updateFarms((rows) => {
                              const copy = [...rows];
                              copy[index] = { ...copy[index], farm_name: value };
                              return copy;
                            })
                          }
                        />
                      </td>
                      {[
                        "expected_daily_capacity",
                        "expected_A_pct",
                        "expected_B_pct",
                        "expected_C_pct",
                        "expected_D_pct",
                        "actual_A",
                        "actual_B",
                        "actual_C",
                        "actual_D",
                      ].map((field) => (
                        <td key={field} className="px-2 py-1.5">
                          <NumberCell
                            value={row[field]}
                            step={field.includes("pct") ? "0.01" : "5"}
                            onChange={(value) =>
                              updateFarms((rows) => {
                                const copy = [...rows];
                                copy[index] = { ...copy[index], [field]: value };
                                return copy;
                              })
                            }
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          disabled={draftInputs.farms.length <= 1}
                          onClick={() =>
                            updateFarms((rows) => rows.filter((_, i) => i !== index))
                          }
                          className="rounded border border-line px-2 py-1 text-xs text-[#991b1b] hover:bg-[#fee2e2] disabled:opacity-40"
                          title="Remove farm"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted">
              Mix % must sum to 1.0 · actual tonnes must be multiples of 5
            </p>
          </div>
        ) : null}

        {tab === "clients" ? (
          <div className="p-3">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  updateClients((rows) => [...rows, emptyClient(rows.length + 1)])
                }
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-chip-bg"
              >
                <Icon name="add" className="text-[16px]" />
                Add client
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line-strong bg-header-band font-mono text-[10px] uppercase tracking-wider text-ink">
                    <th className="px-2 py-2">ID</th>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Mode</th>
                    <th className="px-2 py-2">Segment</th>
                    <th className="px-2 py-2">Demand</th>
                    <th className="px-2 py-2">Price €/t</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-row-line">
                  {draftInputs.clients.map((row, index) => (
                    <tr key={`client-${index}`} className="bg-white">
                      <td className="px-2 py-1.5">
                        <TextCell
                          value={row.client_id}
                          onChange={(value) =>
                            updateClients((rows) => {
                              const copy = [...rows];
                              copy[index] = { ...copy[index], client_id: value };
                              return copy;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <TextCell
                          value={row.client_name}
                          onChange={(value) =>
                            updateClients((rows) => {
                              const copy = [...rows];
                              copy[index] = { ...copy[index], client_name: value };
                              return copy;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <SelectCell
                          value={row.acceptance_mode}
                          options={["EXACT", "MINIMUM"]}
                          onChange={(value) =>
                            updateClients((rows) => {
                              const copy = [...rows];
                              copy[index] = { ...copy[index], acceptance_mode: value };
                              return copy;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <SelectCell
                          value={row.requested_segment}
                          options={["A", "B", "C", "D"]}
                          onChange={(value) =>
                            updateClients((rows) => {
                              const copy = [...rows];
                              copy[index] = {
                                ...copy[index],
                                requested_segment: value,
                              };
                              return copy;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberCell
                          value={row.demand}
                          step="5"
                          onChange={(value) =>
                            updateClients((rows) => {
                              const copy = [...rows];
                              copy[index] = { ...copy[index], demand: value };
                              return copy;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberCell
                          value={row.export_price_per_eur}
                          step="0.01"
                          onChange={(value) =>
                            updateClients((rows) => {
                              const copy = [...rows];
                              copy[index] = {
                                ...copy[index],
                                export_price_per_eur: value,
                              };
                              return copy;
                            })
                          }
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <button
                          type="button"
                          disabled={draftInputs.clients.length <= 1}
                          onClick={() =>
                            updateClients((rows) => rows.filter((_, i) => i !== index))
                          }
                          className="rounded border border-line px-2 py-1 text-xs text-[#991b1b] hover:bg-[#fee2e2] disabled:opacity-40"
                          title="Remove client"
                        >
                          <Icon name="delete" className="text-[16px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-[11px] text-muted">
              Demand must be a multiple of 5 t
            </p>
          </div>
        ) : null}

        {tab === "station" ? (
          <div className="grid max-w-3xl gap-4 p-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                Station ID
              </span>
              <div className="mt-1">
                <TextCell
                  value={draftInputs.station.station_id}
                  onChange={(value) => updateStation({ station_id: value })}
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                Export capacity (t)
              </span>
              <div className="mt-1">
                <NumberCell
                  value={draftInputs.station.export_conditioning_capacity}
                  step="5"
                  onChange={(value) =>
                    updateStation({ export_conditioning_capacity: value })
                  }
                />
              </div>
            </label>
            <label className="block text-sm">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                Local market ratio
              </span>
              <div className="mt-1">
                <NumberCell
                  value={draftInputs.station.local_market_ratio}
                  step="0.01"
                  onChange={(value) => updateStation({ local_market_ratio: value })}
                />
              </div>
            </label>
            <div className="md:col-span-2">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted">
                Reference export prices (€/t)
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {["A", "B", "C", "D"].map((segment) => (
                  <label key={segment} className="block text-sm">
                    <span className="font-mono text-[11px] font-semibold text-ink">
                      Grade {segment}
                    </span>
                    <div className="mt-1">
                      <NumberCell
                        value={stationPrices[segment]}
                        step="0.01"
                        onChange={(value) => updateStationPrice(segment, value)}
                      />
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export { cloneInputs };

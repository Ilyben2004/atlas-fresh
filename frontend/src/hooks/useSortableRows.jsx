import { useMemo, useState } from "react";
import { Icon } from "../utils/format.jsx";

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  const left = String(a).toLowerCase();
  const right = String(b).toLowerCase();
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
}

export function useSortableRows(rows, defaultKey, defaultDirection = "asc") {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDirection);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((left, right) => {
      const result = compareValues(left?.[sortKey], right?.[sortKey]);
      return sortDir === "asc" ? result : -result;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  return { sortedRows, sortKey, sortDir, toggleSort };
}

export function SortableTh({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
  className = "",
}) {
  const active = activeKey === sortKey;
  return (
    <th
      className={`px-4 py-3.5 font-semibold ${align === "right" ? "text-right" : "text-left"} ${className}`}
      scope="col"
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-[#546500] ${
          align === "right" ? "ml-auto flex-row-reverse" : ""
        } ${active ? "text-[#546500]" : "text-ink"}`}
      >
        <span>{label}</span>
        <Icon
          name={
            !active ? "unfold_more" : direction === "asc" ? "arrow_upward" : "arrow_downward"
          }
          className={`text-[14px] ${active ? "opacity-100" : "opacity-45"}`}
        />
      </button>
    </th>
  );
}

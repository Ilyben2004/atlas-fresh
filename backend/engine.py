"""Atlas Fresh daily export allocation engine.

Reference policy (deterministic):
1. Serve clients by export price descending, then client_id ascending.
2. For each client, take compatible farm-segment lots ordered by smallest
   quality upgrade, then farm_id.
3. Allocate in 5 t steps until demand, supply or station capacity is exhausted.
4. Value leftover fruit on the local market.
"""

from __future__ import annotations

import math
from typing import Any

# Quality hierarchy: A is best, D is worst.
SEGMENTS: tuple[str, ...] = ("A", "B", "C", "D")
SEGMENT_RANK = {segment: index for index, segment in enumerate(SEGMENTS)}
ALLOCATION_STEP_T = 5.0


def calculate_plan(
    farms: list[Any],
    clients: list[Any],
    station: Any,
) -> dict[str, Any]:
    """Allocate farm inventory to export clients and compute plan views/KPIs."""
    farm_rows = [_as_dict(item) for item in farms]
    client_rows = [_as_dict(item) for item in clients]
    station_row = _as_dict(station)

    export_capacity = float(station_row["export_conditioning_capacity"])
    local_ratio = float(station_row["local_market_ratio"])
    segment_prices = _segment_price_map(station_row)

    # Mutable per-farm inventory keyed by quality segment.
    inventory: dict[str, dict[str, float]] = {}
    farm_meta: dict[str, dict[str, Any]] = {}
    for farm in farm_rows:
        farm_id = str(farm["farm_id"])
        inventory[farm_id] = {
            "A": float(farm.get("actual_A", 0) or 0),
            "B": float(farm.get("actual_B", 0) or 0),
            "C": float(farm.get("actual_C", 0) or 0),
            "D": float(farm.get("actual_D", 0) or 0),
        }
        farm_meta[farm_id] = farm

    # Highest export price first; stable tie-break by client_id.
    ordered_clients = sorted(
        client_rows,
        key=lambda row: (
            -float(row["export_price_per_eur"]),
            str(row["client_id"]),
        ),
    )

    total_exported_t = 0.0
    total_export_revenue_eur = 0.0
    station_full = False
    ledger: list[dict[str, Any]] = []
    commercial_view: list[dict[str, Any]] = []

    for client in ordered_clients:
        client_id = str(client["client_id"])
        demand = float(client["demand"])
        price = float(client["export_price_per_eur"])
        mode = str(client["acceptance_mode"]).strip().upper()
        requested = str(client.get("requested_segment") or "").strip().upper()

        allocated_t = 0.0
        shortage_reason: str | None = None

        if demand <= 0:
            commercial_view.append(
                _commercial_row(client, allocated_t=0.0, demand=demand, shortage_reason=None)
            )
            continue

        if station_full or total_exported_t >= export_capacity - 1e-12:
            station_full = True
            commercial_view.append(
                _commercial_row(
                    client,
                    allocated_t=0.0,
                    demand=demand,
                    shortage_reason="STATION_CAPACITY_REACHED",
                )
            )
            continue

        supply_lots = _compatible_supply_lots(
            inventory=inventory,
            acceptance_mode=mode,
            requested_segment=requested,
        )

        for upgrade, farm_id, segment in supply_lots:
            if allocated_t + 1e-12 >= demand or total_exported_t >= export_capacity - 1e-12:
                break

            available = inventory[farm_id][segment]
            remaining_demand = demand - allocated_t
            remaining_capacity = export_capacity - total_exported_t
            take = min(available, remaining_demand, remaining_capacity)
            take = math.floor((take + 1e-12) / ALLOCATION_STEP_T) * ALLOCATION_STEP_T
            if take < ALLOCATION_STEP_T - 1e-12:
                continue

            inventory[farm_id][segment] -= take
            allocated_t += take
            total_exported_t += take
            revenue = take * price
            total_export_revenue_eur += revenue

            ledger.append(
                {
                    "farm_id": farm_id,
                    "segment": segment,
                    "client_id": client_id,
                    "tonnes_allocated": _round_t(take),
                    "export_revenue_eur": _round_money(revenue),
                    "quality_upgrade": int(upgrade),
                }
            )

            if total_exported_t >= export_capacity - 1e-12:
                station_full = True

        if allocated_t + 1e-12 < demand:
            if station_full:
                shortage_reason = "STATION_CAPACITY_REACHED"
            else:
                shortage_reason = "INSUFFICIENT_COMPATIBLE_SEGMENT"

        commercial_view.append(
            _commercial_row(
                client,
                allocated_t=allocated_t,
                demand=demand,
                shortage_reason=shortage_reason,
            )
        )

    # Preserve original client order in the commercial view.
    client_order = {str(row["client_id"]): index for index, row in enumerate(client_rows)}
    commercial_view.sort(key=lambda row: client_order.get(row["client_id"], 10**9))

    production_view: list[dict[str, Any]] = []
    total_local_residual_t = 0.0
    total_local_revenue_eur = 0.0
    total_actual_received_t = 0.0
    total_expected_t = 0.0

    for farm_id in sorted(inventory.keys()):
        stock = inventory[farm_id]
        farm = farm_meta[farm_id]
        expected = float(farm.get("expected_daily_capacity", 0) or 0)
        total_expected_t += expected
        actual_by_segment = {
            segment: float(farm.get(f"actual_{segment}", 0) or 0) for segment in SEGMENTS
        }
        actual_delivered = sum(actual_by_segment.values())
        total_actual_received_t += actual_delivered

        expected_by_segment = {
            segment: expected * float(farm.get(f"expected_{segment}_pct", 0) or 0)
            for segment in SEGMENTS
        }

        residual_by_segment = {segment: max(0.0, tonnes) for segment, tonnes in stock.items()}
        local_residual_t = sum(residual_by_segment.values())
        total_local_residual_t += local_residual_t

        local_revenue = 0.0
        for segment, tonnes in residual_by_segment.items():
            if tonnes <= 0:
                continue
            local_revenue += tonnes * local_ratio * float(segment_prices.get(segment, 0.0))
        total_local_revenue_eur += local_revenue

        production_view.append(
            {
                "farm_id": farm_id,
                "farm_name": farm.get("farm_name"),
                "expected_daily_capacity": _round_t(expected),
                "actual_delivered": _round_t(actual_delivered),
                "expected_A": _round_t(expected_by_segment["A"]),
                "expected_B": _round_t(expected_by_segment["B"]),
                "expected_C": _round_t(expected_by_segment["C"]),
                "expected_D": _round_t(expected_by_segment["D"]),
                "actual_A": _round_t(actual_by_segment["A"]),
                "actual_B": _round_t(actual_by_segment["B"]),
                "actual_C": _round_t(actual_by_segment["C"]),
                "actual_D": _round_t(actual_by_segment["D"]),
                "variance_A": _round_t(actual_by_segment["A"] - expected_by_segment["A"]),
                "variance_B": _round_t(actual_by_segment["B"] - expected_by_segment["B"]),
                "variance_C": _round_t(actual_by_segment["C"] - expected_by_segment["C"]),
                "variance_D": _round_t(actual_by_segment["D"] - expected_by_segment["D"]),
                "local_residual_t": _round_t(local_residual_t),
                "variance_t": _round_t(actual_delivered - expected),
            }
        )

    export_rate_pct = (
        (total_exported_t / total_actual_received_t) * 100.0
        if total_actual_received_t > 0
        else 0.0
    )
    at_risk_client_count = sum(
        1 for row in commercial_view if row["status"] in {"PARTIAL", "UNSERVED"}
    )
    total_value_eur = total_export_revenue_eur + total_local_revenue_eur

    ledger_sorted = sorted(
        ledger,
        key=lambda row: (
            str(row.get("farm_id", "")),
            str(row.get("segment", "")),
            str(row.get("client_id", "")),
        ),
    )

    return {
        "kpis": {
            "total_expected_t": _round_t(total_expected_t),
            "total_exported_t": _round_t(total_exported_t),
            "export_capacity_t": _round_t(export_capacity),
            "export_rate_pct": _round_pct(export_rate_pct),
            "total_export_revenue_eur": _round_money(total_export_revenue_eur),
            "total_local_residual_t": _round_t(total_local_residual_t),
            "total_local_revenue_eur": _round_money(total_local_revenue_eur),
            "total_value_eur": _round_money(total_value_eur),
            "total_actual_received_t": _round_t(total_actual_received_t),
            "at_risk_client_count": at_risk_client_count,
            "farm_count": len(farm_rows),
            "client_count": len(client_rows),
        },
        "production_view": production_view,
        "commercial_view": commercial_view,
        "traceability_ledger": ledger_sorted,
    }


def _compatible_segments(acceptance_mode: str, requested_segment: str) -> list[str]:
    """Return allocatable segments (requested first for MINIMUM via upgrade sort)."""
    requested = requested_segment.upper()
    if requested not in SEGMENT_RANK:
        return []

    if acceptance_mode == "EXACT":
        return [requested]

    if acceptance_mode == "MINIMUM":
        return [
            segment
            for segment in SEGMENTS
            if SEGMENT_RANK[segment] <= SEGMENT_RANK[requested]
        ]

    return []


def _quality_upgrade(requested_segment: str, allocated_segment: str) -> int:
    """How many grades better than requested (0 = exact match)."""
    return SEGMENT_RANK[requested_segment] - SEGMENT_RANK[allocated_segment]


def _compatible_supply_lots(
    *,
    inventory: dict[str, dict[str, float]],
    acceptance_mode: str,
    requested_segment: str,
) -> list[tuple[int, str, str]]:
    """Compatible (upgrade, farm_id, segment) lots, deterministic order."""
    requested = requested_segment.upper()
    lots: list[tuple[int, str, str]] = []
    for segment in _compatible_segments(acceptance_mode, requested):
        upgrade = _quality_upgrade(requested, segment)
        for farm_id in sorted(inventory.keys()):
            if inventory[farm_id][segment] > 1e-12:
                lots.append((upgrade, farm_id, segment))
    lots.sort(key=lambda item: (item[0], item[1], item[2]))
    return lots


def _segment_price_map(station: dict[str, Any]) -> dict[str, float]:
    prices: dict[str, float] = {segment: 0.0 for segment in SEGMENTS}
    for item in station.get("segment_prices") or []:
        row = _as_dict(item)
        segment = str(row.get("segment", "")).strip().upper()
        if segment not in prices:
            continue
        prices[segment] = float(row.get("reference_export_price_per_eur", 0) or 0)
    return prices


def _commercial_row(
    client: dict[str, Any],
    *,
    allocated_t: float,
    demand: float,
    shortage_reason: str | None,
) -> dict[str, Any]:
    if allocated_t <= 0 and demand > 0:
        status = "UNSERVED"
    elif shortage_reason is None and allocated_t + 1e-12 >= demand:
        status = "COMPLETE"
    elif allocated_t > 0:
        status = "PARTIAL"
    else:
        status = "UNSERVED"

    return {
        "client_id": str(client["client_id"]),
        "client_name": client.get("client_name"),
        "acceptance_mode": str(client["acceptance_mode"]).strip().upper(),
        "requested_segment": str(client.get("requested_segment") or "").strip().upper(),
        "demand": _round_t(demand),
        "export_price_per_eur": _round_money(float(client["export_price_per_eur"])),
        "allocated_t": _round_t(allocated_t),
        "remaining_t": _round_t(max(0.0, demand - allocated_t)),
        "export_revenue_eur": _round_money(allocated_t * float(client["export_price_per_eur"])),
        "status": status,
        "shortage_reason": shortage_reason,
    }


def _as_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if isinstance(value, dict):
        return value
    raise TypeError(f"Expected mapping or pydantic model, got {type(value)!r}")


def _round_t(value: float) -> float:
    return round(float(value), 6)


def _round_money(value: float) -> float:
    return round(float(value), 2)


def _round_pct(value: float) -> float:
    return round(float(value), 4)

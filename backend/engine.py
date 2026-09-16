"""Atlas Fresh daily export allocation engine.

Greedy revenue-maximizing allocator:
1. Serve highest-priced clients first.
2. Match EXACT / MINIMUM segment rules against farm inventory.
3. Hard-stop exports when the station conditioning capacity is reached.
4. Value any leftover fruit at the local-market residual price.
"""

from __future__ import annotations

from typing import Any

# Quality hierarchy: A is best, D is worst.
SEGMENTS: tuple[str, ...] = ("A", "B", "C", "D")
SEGMENT_RANK = {segment: index for index, segment in enumerate(SEGMENTS)}


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

    # Highest export price first — premium clients claim scarce fruit first.
    ordered_clients = sorted(
        client_rows,
        key=lambda row: float(row["export_price_per_eur"]),
        reverse=True,
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

        # Once the station is saturated, later clients (already lower priority)
        # cannot receive any more export volume.
        if station_full or total_exported_t >= export_capacity:
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

        # EXACT  -> only the requested segment.
        # MINIMUM -> requested segment or any better quality, lowest quality first
        #            so premium fruit is preserved for later / higher uses.
        #            Example MINIMUM B => try B first, then A.
        for segment in _compatible_segments(mode, requested):
            if allocated_t >= demand or total_exported_t >= export_capacity:
                break

            for farm_id, stock in inventory.items():
                if allocated_t >= demand or total_exported_t >= export_capacity:
                    break

                available = stock[segment]
                if available <= 0:
                    continue

                remaining_demand = demand - allocated_t
                remaining_capacity = export_capacity - total_exported_t
                take = min(available, remaining_demand, remaining_capacity)
                if take <= 0:
                    continue

                stock[segment] -= take
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
                    }
                )

                if total_exported_t >= export_capacity:
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

    for farm_id, stock in inventory.items():
        farm = farm_meta[farm_id]
        expected = float(farm.get("expected_daily_capacity", 0) or 0)
        actual_delivered = sum(
            float(farm.get(f"actual_{segment}", 0) or 0) for segment in SEGMENTS
        )
        total_actual_received_t += actual_delivered

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
                "local_residual_t": _round_t(local_residual_t),
                "variance_t": _round_t(actual_delivered - expected),
            }
        )

    export_rate_pct = (
        (total_exported_t / total_actual_received_t) * 100.0
        if total_actual_received_t > 0
        else 0.0
    )

    return {
        "kpis": {
            "total_exported_t": _round_t(total_exported_t),
            "export_rate_pct": _round_pct(export_rate_pct),
            "total_export_revenue_eur": _round_money(total_export_revenue_eur),
            "total_local_residual_t": _round_t(total_local_residual_t),
            "total_local_revenue_eur": _round_money(total_local_revenue_eur),
        },
        "production_view": production_view,
        "commercial_view": commercial_view,
        "traceability_ledger": ledger,
    }


def _compatible_segments(acceptance_mode: str, requested_segment: str) -> list[str]:
    """Return allocatable segments in fill order (lowest acceptable quality first)."""
    requested = requested_segment.upper()
    if requested not in SEGMENT_RANK:
        return []

    if acceptance_mode == "EXACT":
        return [requested]

    if acceptance_mode == "MINIMUM":
        # requested and every better grade. Reverse so we consume the worst
        # acceptable fruit first (MINIMUM B => B then A).
        allowed = [
            segment
            for segment in SEGMENTS
            if SEGMENT_RANK[segment] <= SEGMENT_RANK[requested]
        ]
        return list(reversed(allowed))

    return []


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

"""Deterministic data tools for the Atlas Fresh Plan Assistant.

These functions extract only the facts needed for each approved intent.
They never invent IDs or mutate the plan context.
"""

from __future__ import annotations

from typing import Any

ALLOWED_TOOL_NAMES = frozenset(
    {
        "get_clients_at_risk",
        "get_farm_segment_gaps",
        "get_local_residual_value",
    }
)

REJECT_TOOL_NAME = "reject_question"

STATUS_LABELS = {
    "COMPLETE": "fully served",
    "PARTIAL": "only partly served",
    "UNSERVED": "not served at all",
}

SHORTAGE_LABELS = {
    "STATION_CAPACITY_REACHED": (
        "the export station was already full, so no more fruit could be packed for export"
    ),
    "INSUFFICIENT_COMPATIBLE_SEGMENT": (
        "there was not enough fruit of the quality grade this client accepts"
    ),
}


def _plain_status(status: object) -> str:
    key = str(status or "").upper()
    return STATUS_LABELS.get(key, key.replace("_", " ").lower() or "unknown")


def _plain_shortage(reason: object) -> str | None:
    if reason in (None, ""):
        return None
    key = str(reason).upper()
    return SHORTAGE_LABELS.get(key, str(reason).replace("_", " ").lower())


def get_clients_at_risk(context: dict[str, Any]) -> dict[str, Any]:
    """Return commercial rows that are PARTIAL or UNSERVED."""
    commercial = list(context.get("commercial_view") or [])
    at_risk: list[dict[str, Any]] = []
    for row in commercial:
        status = str(row.get("status") or "").upper()
        if status not in {"PARTIAL", "UNSERVED"}:
            continue
        demand = float(row.get("demand") or 0)
        allocated = float(row.get("allocated_t") or 0)
        shortfall = max(0.0, demand - allocated)
        at_risk.append(
            {
                "client_id": row.get("client_id"),
                "client_name": row.get("client_name"),
                "requested_quality": row.get("requested_segment"),
                "wanted_tonnes": demand,
                "received_tonnes": allocated,
                "still_needed_tonnes": shortfall,
                "service_level": _plain_status(status),
                "plain_reason": _plain_shortage(row.get("shortage_reason")),
            }
        )

    return {
        "intent": "clients_at_risk",
        "at_risk_count": len(at_risk),
        "clients": at_risk,
    }


def get_farm_segment_gaps(context: dict[str, Any]) -> dict[str, Any]:
    """Return the largest farm shortages and their segment actuals."""
    production = list(context.get("production_view") or [])
    shortages = [
        row for row in production if float(row.get("variance_t") or 0) < -1e-9
    ]
    shortages.sort(key=lambda row: float(row.get("variance_t") or 0))
    top = shortages[:5]

    farms: list[dict[str, Any]] = []
    for row in top:
        expected = float(row.get("expected_daily_capacity") or 0)
        actual = float(row.get("actual_delivered") or 0)
        gap = actual - expected
        farms.append(
            {
                "farm_id": row.get("farm_id"),
                "farm_name": row.get("farm_name"),
                "expected_tonnes": expected,
                "delivered_tonnes": actual,
                "short_by_tonnes": abs(gap) if gap < 0 else 0.0,
                "quality_delivered": {
                    "A": row.get("actual_A"),
                    "B": row.get("actual_B"),
                    "C": row.get("actual_C"),
                    "D": row.get("actual_D"),
                },
                "left_unexported_tonnes": row.get("local_residual_t"),
            }
        )

    return {
        "intent": "farm_segment_gaps",
        "shortage_farm_count": len(shortages),
        "top_shortages": farms,
    }


def get_local_residual_value(context: dict[str, Any]) -> dict[str, Any]:
    """Return local residual tonnes, value, and capacity pressure facts."""
    kpis = dict(context.get("kpis") or {})
    production = list(context.get("production_view") or [])

    residual_leaders = sorted(
        production,
        key=lambda row: float(row.get("local_residual_t") or 0),
        reverse=True,
    )
    leaders = [
        {
            "farm_id": row.get("farm_id"),
            "farm_name": row.get("farm_name"),
            "tonnes_going_local": row.get("local_residual_t"),
            "delivered_tonnes": row.get("actual_delivered"),
        }
        for row in residual_leaders
        if float(row.get("local_residual_t") or 0) > 1e-9
    ][:5]

    exported = float(kpis.get("total_exported_t") or 0)
    capacity = float(kpis.get("export_capacity_t") or 0)
    station_full = capacity > 0 and exported >= capacity - 1e-9

    return {
        "intent": "local_residual_value",
        "tonnes_going_local": kpis.get("total_local_residual_t"),
        "estimated_local_value_eur": kpis.get("total_local_revenue_eur"),
        "exported_tonnes": kpis.get("total_exported_t"),
        "station_limit_tonnes": kpis.get("export_capacity_t"),
        "total_received_tonnes": kpis.get("total_actual_received_t"),
        "station_is_full": station_full,
        "main_farms_sending_local": leaders,
    }


TOOL_HANDLERS = {
    "get_clients_at_risk": get_clients_at_risk,
    "get_farm_segment_gaps": get_farm_segment_gaps,
    "get_local_residual_value": get_local_residual_value,
}


def run_tool(name: str, context: dict[str, Any]) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        raise ValueError(f"Unknown tool: {name}")
    return handler(context)


def gemini_tool_declarations() -> list[dict[str, Any]]:
    """Function declarations for Gemini toolConfig.

    Gemini rejects OBJECT schemas with empty properties, so each tool includes
    a harmless optional string field even when no arguments are required.
    """
    optional_focus = {
        "type": "OBJECT",
        "properties": {
            "focus": {
                "type": "STRING",
                "description": (
                    "Optional short focus note. Leave empty unless clarifying emphasis."
                ),
            }
        },
    }
    return [
        {
            "name": "get_clients_at_risk",
            "description": (
                "Use when the user asks which clients are at risk, incomplete, "
                "partially served, unserved, shorted, or why a client was not fully filled. "
                "Match paraphrases of client risk / shortage questions."
            ),
            "parameters": optional_focus,
        },
        {
            "name": "get_farm_segment_gaps",
            "description": (
                "Use when the user asks which farm or segment gaps, shortages, "
                "production shortfalls, or supply variances matter most today. "
                "Match paraphrases about orchard deficits or A/B/C/D gaps."
            ),
            "parameters": optional_focus,
        },
        {
            "name": "get_local_residual_value",
            "description": (
                "Use when the user asks why fruit/apples/tonnes are going local, "
                "local residual/spillover volume, local market value, or similar. "
                "Match even if they cite a different tonne figure than today's residual."
            ),
            "parameters": optional_focus,
        },
        {
            "name": "reject_question",
            "description": (
                "Use when the user asks a question outside the three approved analytical intents "
                "(client risk, farm/segment gaps, local residual value). "
                "Also use for poems, coding help, allocation recalculation requests, "
                "or any off-topic ask."
            ),
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "reason": {
                        "type": "STRING",
                        "description": "Short reason the question is unsupported.",
                    }
                },
                "required": ["reason"],
            },
        },
    ]

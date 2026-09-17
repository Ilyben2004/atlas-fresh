from __future__ import annotations

from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import ValidationError

from engine import calculate_plan
from ingestion import IngestionError, ingest_plan_workbook
from schemas import PlanInputs, PlanResultResponse

router = APIRouter(tags=["plan"])

_FIELD_LABELS = {
    "farm_id": "farm ID",
    "farm_name": "farm name",
    "expected_daily_capacity": "expected daily capacity",
    "expected_A_pct": "expected A mix",
    "expected_B_pct": "expected B mix",
    "expected_C_pct": "expected C mix",
    "expected_D_pct": "expected D mix",
    "actual_A": "actual A tonnes",
    "actual_B": "actual B tonnes",
    "actual_C": "actual C tonnes",
    "actual_D": "actual D tonnes",
    "client_id": "client ID",
    "client_name": "client name",
    "acceptance_mode": "acceptance mode",
    "requested_segment": "requested quality",
    "demand": "demand",
    "export_price_per_eur": "export price",
    "station_id": "station ID",
    "export_conditioning_capacity": "export station capacity",
    "local_market_ratio": "local market ratio",
    "segment": "quality grade",
    "reference_export_price_per_eur": "reference export price",
    "segment_prices": "reference prices",
    "farms": "Farms sheet",
    "clients": "Clients sheet",
    "station": "Station sheet",
}


@router.post("/plan", response_model=PlanResultResponse)
async def create_plan(file: UploadFile = File(...)) -> PlanResultResponse:
    content = await file.read()
    try:
        farms, clients, station = ingest_plan_workbook(content)
    except IngestionError as exc:
        raise HTTPException(status_code=400, detail=exc.message) from exc

    plan = calculate_plan(farms, clients, station)
    inputs = PlanInputs(farms=farms, clients=clients, station=station)
    return PlanResultResponse(filename=file.filename, inputs=inputs, **plan)


@router.post("/plan/json", response_model=PlanResultResponse)
async def create_plan_from_json(payload: dict[str, Any]) -> PlanResultResponse:
    """Recompute the daily plan from edited Farms / Clients / Station JSON."""
    try:
        inputs = PlanInputs.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail=_format_validation_error(exc),
        ) from exc

    plan = calculate_plan(inputs.farms, inputs.clients, inputs.station)
    return PlanResultResponse(
        filename="edited-inputs.json",
        inputs=inputs,
        **plan,
    )


def _format_validation_error(exc: ValidationError) -> str:
    """Turn Pydantic errors into short plain-language planner messages."""
    parts: list[str] = []
    for error in exc.errors():
        message = _friendly_validation_message(error)
        if message and message not in parts:
            parts.append(message)
    if not parts:
        return "Some values in the input sheets are invalid. Please check and try again."
    if len(parts) == 1:
        return parts[0]
    return "\n".join(f"{index}. {text}" for index, text in enumerate(parts, start=1))


def _friendly_validation_message(error: dict[str, Any]) -> str:
    loc = list(error.get("loc") or ())
    raw_msg = str(error.get("msg") or "is invalid")
    if raw_msg.lower().startswith("value error,"):
        raw_msg = raw_msg.split(",", 1)[1].strip()
    if raw_msg.lower().startswith("assertion failed,"):
        raw_msg = raw_msg.split(",", 1)[1].strip()

    sheet, row_label, field_key = _parse_error_location(loc)
    field_label = _FIELD_LABELS.get(field_key, field_key.replace("_", " ") if field_key else "")
    rule = _plain_rule_message(raw_msg, field_label or field_key)

    where = " · ".join(bit for bit in (sheet, row_label) if bit)
    if where and field_label:
        sentence = f"{where}: {field_label} {rule}"
    elif where:
        sentence = f"{where}: {rule}"
    elif field_label:
        sentence = f"{field_label} {rule}"
    else:
        sentence = rule

    sentence = sentence.strip()
    if sentence and not sentence.endswith("."):
        sentence += "."
    if sentence:
        sentence = sentence[0].upper() + sentence[1:]
    return sentence


def _parse_error_location(loc: list[Any]) -> tuple[str, str, str]:
    if not loc:
        return "", "", ""

    root = loc[0]
    if root == "farms":
        if len(loc) >= 2 and isinstance(loc[1], int):
            field = str(loc[2]) if len(loc) >= 3 else ""
            return "Farms sheet", f"row {loc[1] + 1}", field
        return "Farms sheet", "", str(loc[1]) if len(loc) >= 2 else ""

    if root == "clients":
        if len(loc) >= 2 and isinstance(loc[1], int):
            field = str(loc[2]) if len(loc) >= 3 else ""
            return "Clients sheet", f"row {loc[1] + 1}", field
        return "Clients sheet", "", str(loc[1]) if len(loc) >= 2 else ""

    if root == "station":
        if len(loc) >= 2 and loc[1] == "segment_prices":
            if len(loc) >= 3 and isinstance(loc[2], int):
                field = str(loc[3]) if len(loc) >= 4 else ""
                return "Station sheet", f"price row {loc[2] + 1}", field
            return "Station sheet", "", "segment_prices"
        return "Station sheet", "", str(loc[1]) if len(loc) >= 2 else ""

    return "", "", str(loc[-1])


def _plain_rule_message(raw_msg: str, field_label: str) -> str:
    text = raw_msg.strip()
    lower = text.lower()

    if field_label:
        for candidate in {
            field_label,
            field_label.replace(" ", "_"),
            field_label.replace(" tonnes", ""),
            field_label.replace(" mix", "_pct").replace(" ", "_"),
        }:
            prefix = candidate.lower().strip()
            if prefix and lower.startswith(prefix):
                text = text[len(candidate) :].lstrip(" :,-")
                lower = text.lower()
                break

    # Strip leftover technical field tokens like actual_B
    for token in list(_FIELD_LABELS.keys()):
        if lower.startswith(token.lower()):
            text = text[len(token) :].lstrip(" :,-")
            lower = text.lower()
            break

    got_value = ""
    if "(got " in lower:
        start = lower.index("(got ")
        got_value = text[start + 5 :].rstrip("). ").strip()
        text = text[:start].rstrip()
        lower = text.lower()

    rules = [
        ("cannot be negative", "cannot be negative"),
        (
            "must be a non-negative multiple of 5 t",
            "must be a multiple of 5 tonnes (0, 5, 10, …)",
        ),
        ("must be between 0 and 1", "must be a share between 0 and 1"),
        ("must exactly equal 1.0", "mix percentages must add up to exactly 1"),
        ("acceptance_mode must be exact or minimum", "must be EXACT or MINIMUM"),
        ("must be exact or minimum", "must be EXACT or MINIMUM"),
        ("requested_segment must be one of a, b, c, d", "must be A, B, C or D"),
        ("must be one of a, b, c, d", "must be A, B, C or D"),
        ("cannot be greater than 1.0", "cannot be greater than 1"),
        ("field required", "is required"),
        ("input should be a valid number", "must be a number"),
        ("input should be a valid string", "must be filled in"),
        ("list should have at least 1 item", "needs at least one row"),
        ("duplicate farm ids", "has duplicate farm IDs"),
        ("duplicate client ids", "has duplicate client IDs"),
        (
            "segment reference-price table must include",
            "must include reference prices for A, B, C and D",
        ),
        (
            "segment reference-price table has duplicate segments",
            "has duplicate quality grades in reference prices",
        ),
    ]
    for old, new in rules:
        if old in lower:
            text = new
            break

    if got_value and "you entered" not in text.lower():
        text = f"{text} (you entered {got_value})"
    return text or "is invalid"

from __future__ import annotations

import re
from io import BytesIO
from typing import Any

import pandas as pd
from pydantic import ValidationError

from schemas import ClientInput, FarmInput

FARM_SHEET = "Farms"
CLIENT_SHEET = "Clients"
HEADER_SCAN_ROWS = 20

FARM_COLUMNS = (
    "farm_id",
    "expected_capacity",
    "actual_a",
    "actual_b",
    "actual_c",
    "actual_d",
    "mix_a",
    "mix_b",
    "mix_c",
    "mix_d",
)
CLIENT_COLUMNS = ("client_id", "rule", "demand", "reference_price")

COLUMN_ALIASES = {
    "farmid": "farm_id",
    "farmname": "farm_name",
    "expectedcapacity": "expected_capacity",
    "expecteddailycapacity": "expected_capacity",
    "expecteddailycapacityt": "expected_capacity",
    "capacity": "expected_capacity",
    "actuala": "actual_a",
    "actualat": "actual_a",
    "actualb": "actual_b",
    "actualbt": "actual_b",
    "actualc": "actual_c",
    "actualct": "actual_c",
    "actuald": "actual_d",
    "actualdt": "actual_d",
    "mixa": "mix_a",
    "expecteda": "mix_a",
    "expectedapct": "mix_a",
    "mixb": "mix_b",
    "expectedb": "mix_b",
    "expectedbpct": "mix_b",
    "mixc": "mix_c",
    "expectedc": "mix_c",
    "expectedcpct": "mix_c",
    "mixd": "mix_d",
    "expectedd": "mix_d",
    "expecteddpct": "mix_d",
    "clientid": "client_id",
    "clientname": "client_name",
    "rule": "rule",
    "acceptancemode": "rule",
    "requestedsegment": "requested_segment",
    "demand": "demand",
    "demandt": "demand",
    "referenceprice": "reference_price",
    "price": "reference_price",
    "exportpricepert": "reference_price",
    "exportpriceperteur": "reference_price",
    "exportpricepertteur": "reference_price",
}


class IngestionError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def ingest_plan_workbook(content: bytes) -> tuple[list[FarmInput], list[ClientInput]]:
    try:
        workbook = pd.ExcelFile(BytesIO(content), engine="openpyxl")
    except Exception as exc:
        raise IngestionError("Unable to parse the uploaded Excel file.") from exc

    farms_sheet = _find_sheet(workbook, FARM_SHEET, FARM_COLUMNS)
    clients_sheet = _find_sheet(workbook, CLIENT_SHEET, CLIENT_COLUMNS)
    if farms_sheet == clients_sheet:
        raise IngestionError(
            "Farms and Clients data cannot be read from the same sheet."
        )

    farms_df = _read_sheet(workbook, farms_sheet, FARM_COLUMNS, FarmInput)
    clients_df = _read_sheet(workbook, clients_sheet, CLIENT_COLUMNS, ClientInput)

    farms = _validate_records(farms_df, FarmInput, entity="farm")
    clients = _validate_records(clients_df, ClientInput, entity="client")
    return farms, clients


def _find_sheet(
    workbook: pd.ExcelFile,
    expected: str,
    required_columns: tuple[str, ...],
) -> str:
    """Locate a sheet by name anywhere in the workbook; tab order is ignored."""
    exact_matches = [
        name
        for name in workbook.sheet_names
        if _normalize_sheet_name(name) == _normalize_sheet_name(expected)
    ]
    if len(exact_matches) == 1:
        return exact_matches[0]
    if len(exact_matches) > 1:
        joined = ", ".join(exact_matches)
        raise IngestionError(f"Multiple sheets match '{expected}': {joined}.")

    token_matches = [
        name
        for name in workbook.sheet_names
        if _normalize_sheet_name(expected) in _sheet_name_tokens(name)
    ]
    if len(token_matches) == 1:
        return token_matches[0]
    if len(token_matches) > 1:
        joined = ", ".join(token_matches)
        raise IngestionError(f"Multiple sheets match '{expected}': {joined}.")

    content_matches = [
        name
        for name in workbook.sheet_names
        if _sheet_has_columns(workbook, name, required_columns)
    ]
    if len(content_matches) == 1:
        return content_matches[0]
    if len(content_matches) > 1:
        joined = ", ".join(content_matches)
        raise IngestionError(
            f"Multiple sheets look like '{expected}' based on columns: {joined}."
        )

    raise IngestionError(
        f"Could not find a '{expected}' sheet. "
        "Sheet order does not matter; the workbook must contain Farms and Clients sheets."
    )


def _normalize_sheet_name(name: object) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(name).strip().lower())


def _sheet_name_tokens(name: object) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", str(name).strip().lower()))


def _sheet_has_columns(
    workbook: pd.ExcelFile,
    sheet_name: str,
    required_columns: tuple[str, ...],
) -> bool:
    raw = pd.read_excel(workbook, sheet_name=sheet_name, header=None)
    if raw.empty:
        return False
    return _find_header_row(raw, required_columns) is not None


def _read_sheet(
    workbook: pd.ExcelFile,
    sheet_name: str,
    required_columns: tuple[str, ...],
    model: type[FarmInput] | type[ClientInput],
) -> pd.DataFrame:
    raw = pd.read_excel(workbook, sheet_name=sheet_name, header=None)
    if raw.empty:
        raise IngestionError(f"Sheet '{sheet_name}' is empty.")

    header_idx = _find_header_row(raw, required_columns)
    if header_idx is None:
        found = [
            _canonical_column(value)
            for value in raw.head(HEADER_SCAN_ROWS).stack().tolist()
            if str(value).strip()
        ]
        missing = ", ".join(required_columns)
        raise IngestionError(
            f"Sheet '{sheet_name}' is missing required columns: {missing}."
            + (f" Found headers: {', '.join(dict.fromkeys(found))}." if found else "")
        )

    columns = [_canonical_column(value) for value in raw.iloc[header_idx].tolist()]
    frame = raw.iloc[header_idx + 1 :].copy()
    frame.columns = columns
    frame = frame.loc[:, ~pd.Index(frame.columns).duplicated()]
    keep = [name for name in model.model_fields if name in frame.columns]
    frame = frame.loc[:, keep]
    frame = frame.dropna(how="all")
    if frame.empty:
        raise IngestionError(f"Sheet '{sheet_name}' contains no data rows.")
    return frame.where(pd.notna(frame), None)


def _find_header_row(raw: pd.DataFrame, required_columns: tuple[str, ...]) -> int | None:
    required = set(required_columns)
    scan_limit = min(HEADER_SCAN_ROWS, len(raw))
    for index in range(scan_limit):
        candidates = {_canonical_column(value) for value in raw.iloc[index].tolist()}
        if required.issubset(candidates):
            return index
    return None


def _canonical_column(value: object) -> str:
    normalized = str(value).strip().lower()
    normalized = re.sub(r"[\s\-]+", "_", normalized)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    compact = normalized.replace("_", "")
    if compact in COLUMN_ALIASES:
        return COLUMN_ALIASES[compact]
    for suffix in ("teur", "eur", "pct", "t"):
        if compact.endswith(suffix) and compact != suffix:
            stripped = compact[: -len(suffix)]
            if stripped in COLUMN_ALIASES:
                return COLUMN_ALIASES[stripped]
    return COLUMN_ALIASES.get(compact, normalized)


def _validate_records(
    frame: pd.DataFrame,
    model: type[FarmInput] | type[ClientInput],
    *,
    entity: str,
) -> list[Any]:
    records = frame.to_dict(orient="records")
    validated: list[Any] = []
    for index, record in enumerate(records, start=1):
        try:
            validated.append(model.model_validate(record))
        except ValidationError as exc:
            raise IngestionError(
                _format_validation_error(
                    entity=entity,
                    row_number=index,
                    record=record,
                    exc=exc,
                )
            ) from exc
    return validated


def _format_validation_error(
    *,
    entity: str,
    row_number: int,
    record: dict[str, Any],
    exc: ValidationError,
) -> str:
    identity_key = "farm_id" if entity == "farm" else "client_id"
    identity = record.get(identity_key)
    if identity in (None, ""):
        prefix = f"Validation failed for {entity} at row {row_number}"
    else:
        prefix = f"Validation failed for {entity} '{identity}' (row {row_number})"

    details: list[str] = []
    for error in exc.errors():
        location = ".".join(
            str(part) for part in error.get("loc", ()) if part not in {"__root__", "body"}
        )
        message = error.get("msg", "invalid value")
        message = message.removeprefix("Value error, ")
        if location and location not in message:
            details.append(f"{location}: {message}")
        else:
            details.append(message)
    return f"{prefix}: {'; '.join(details)}"

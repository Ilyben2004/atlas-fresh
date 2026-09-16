from __future__ import annotations

import re
from io import BytesIO
from typing import Any

import pandas as pd
from pydantic import BaseModel, ValidationError

from schemas import ClientInput, FarmInput, SegmentLocalPrice, StationInput

FARM_SHEET = "Farms"
CLIENT_SHEET = "Clients"
STATION_SHEET = "Station"
HEADER_SCAN_ROWS = 20

FARM_COLUMNS = (
    "farm_id",
    "expected_daily_capacity",
    "expected_A_pct",
    "expected_B_pct",
    "expected_C_pct",
    "expected_D_pct",
    "actual_A",
    "actual_B",
    "actual_C",
    "actual_D",
)
CLIENT_COLUMNS = (
    "client_id",
    "acceptance_mode",
    "demand",
    "export_price_per_eur",
)
STATION_COLUMNS = (
    "station_id",
    "export_conditioning_capacity",
    "local_market_ratio",
)
SEGMENT_PRICE_COLUMNS = ("segment", "reference_export_price_per_eur")

# Compact lowercase keys (no underscores) -> Excel-aligned JSON field names.
# Quantity `_t` suffixes are stripped; price `_per_t_` becomes `_per_`.
COLUMN_ALIASES = {
    "farmid": "farm_id",
    "farmname": "farm_name",
    "expecteddailycapacity": "expected_daily_capacity",
    "expecteddailycapacityt": "expected_daily_capacity",
    "expectedapct": "expected_A_pct",
    "expectedbpct": "expected_B_pct",
    "expectedcpct": "expected_C_pct",
    "expecteddpct": "expected_D_pct",
    "actuala": "actual_A",
    "actualat": "actual_A",
    "actualb": "actual_B",
    "actualbt": "actual_B",
    "actualc": "actual_C",
    "actualct": "actual_C",
    "actuald": "actual_D",
    "actualdt": "actual_D",
    "clientid": "client_id",
    "clientname": "client_name",
    "acceptancemode": "acceptance_mode",
    "requestedsegment": "requested_segment",
    "demand": "demand",
    "demandt": "demand",
    "exportpriceperteur": "export_price_per_eur",
    "exportpricepert": "export_price_per_eur",
    "exportpricepereur": "export_price_per_eur",
    "stationid": "station_id",
    "exportconditioningcapacity": "export_conditioning_capacity",
    "exportconditioningcapacityt": "export_conditioning_capacity",
    "localmarketratio": "local_market_ratio",
    "segment": "segment",
    "referenceexportpriceperteur": "reference_export_price_per_eur",
    "referenceexportpricepert": "reference_export_price_per_eur",
    "referenceexportpricepereur": "reference_export_price_per_eur",
}


class IngestionError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def ingest_plan_workbook(
    content: bytes,
) -> tuple[list[FarmInput], list[ClientInput], StationInput]:
    try:
        workbook = pd.ExcelFile(BytesIO(content), engine="openpyxl")
    except Exception as exc:
        raise IngestionError("Unable to parse the uploaded Excel file.") from exc

    farms_sheet = _find_sheet(workbook, FARM_SHEET, FARM_COLUMNS)
    clients_sheet = _find_sheet(workbook, CLIENT_SHEET, CLIENT_COLUMNS)
    station_sheet = _find_sheet(workbook, STATION_SHEET, STATION_COLUMNS)

    used = {farms_sheet, clients_sheet, station_sheet}
    if len(used) < 3:
        raise IngestionError(
            "Farms, Clients, and Station data must come from distinct sheets."
        )

    farms_df = _read_sheet(workbook, farms_sheet, FARM_COLUMNS, FarmInput)
    clients_df = _read_sheet(workbook, clients_sheet, CLIENT_COLUMNS, ClientInput)
    station = _read_station(workbook, station_sheet)

    farms = _validate_records(farms_df, FarmInput, entity="farm")
    clients = _validate_records(clients_df, ClientInput, entity="client")
    return farms, clients, station


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
        "Sheet order does not matter; the workbook must contain Farms, Clients, and Station sheets."
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
    model: type[BaseModel],
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


def _read_station(workbook: pd.ExcelFile, sheet_name: str) -> StationInput:
    raw = pd.read_excel(workbook, sheet_name=sheet_name, header=None)
    if raw.empty:
        raise IngestionError(f"Sheet '{sheet_name}' is empty.")

    station_header_idx = _find_header_row(raw, STATION_COLUMNS)
    if station_header_idx is None:
        missing = ", ".join(STATION_COLUMNS)
        raise IngestionError(
            f"Sheet '{sheet_name}' is missing required columns: {missing}."
        )

    station_columns = [
        _canonical_column(value) for value in raw.iloc[station_header_idx].tolist()
    ]
    station_frame = raw.iloc[station_header_idx + 1 :].copy()
    station_frame.columns = station_columns
    station_frame = station_frame.loc[:, ~pd.Index(station_frame.columns).duplicated()]
    keep = [name for name in STATION_COLUMNS if name in station_frame.columns]
    station_frame = station_frame.loc[:, keep].dropna(how="all")
    station_frame = station_frame.where(pd.notna(station_frame), None)

    if station_frame.empty:
        raise IngestionError(f"Sheet '{sheet_name}' contains no station data rows.")

    station_record: dict[str, Any] | None = None
    for record in station_frame.to_dict(orient="records"):
        if all(record.get(column) not in (None, "") for column in STATION_COLUMNS):
            station_record = record
            break
    if station_record is None:
        raise IngestionError(
            f"Sheet '{sheet_name}' does not contain a complete station row."
        )

    segment_prices = _read_segment_prices(raw)

    try:
        return StationInput.model_validate(
            {**station_record, "segment_prices": segment_prices}
        )
    except ValidationError as exc:
        raise IngestionError(
            _format_validation_error(
                entity="station",
                row_number=1,
                record=station_record,
                exc=exc,
            )
        ) from exc


def _read_segment_prices(raw: pd.DataFrame) -> list[dict[str, Any]]:
    header_idx = _find_header_row(raw, SEGMENT_PRICE_COLUMNS)
    if header_idx is None:
        return []

    columns = [_canonical_column(value) for value in raw.iloc[header_idx].tolist()]
    frame = raw.iloc[header_idx + 1 :].copy()
    frame.columns = columns
    frame = frame.loc[:, ~pd.Index(frame.columns).duplicated()]
    keep = [name for name in SEGMENT_PRICE_COLUMNS if name in frame.columns]
    frame = frame.loc[:, keep].dropna(how="all")
    frame = frame.where(pd.notna(frame), None)

    prices: list[dict[str, Any]] = []
    for record in frame.to_dict(orient="records"):
        if all(record.get(column) not in (None, "") for column in SEGMENT_PRICE_COLUMNS):
            prices.append(record)
        else:
            break

    validated: list[dict[str, Any]] = []
    for index, record in enumerate(prices, start=1):
        try:
            validated.append(SegmentLocalPrice.model_validate(record).model_dump())
        except ValidationError as exc:
            raise IngestionError(
                _format_validation_error(
                    entity="segment price",
                    row_number=index,
                    record=record,
                    exc=exc,
                )
            ) from exc
    return validated


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
    # Quantity in tonnes: drop trailing _t. Price-per-tonne: _per_t_ -> _per_.
    normalized = normalized.replace("_per_t_", "_per_")
    if normalized.endswith("_t"):
        normalized = normalized[:-2]
    compact = normalized.replace("_", "")
    if compact in COLUMN_ALIASES:
        return COLUMN_ALIASES[compact]
    for suffix in ("eur", "pct"):
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
    identity_key = {
        "farm": "farm_id",
        "client": "client_id",
        "station": "station_id",
        "segment price": "segment",
    }.get(entity)
    identity = record.get(identity_key) if identity_key else None
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

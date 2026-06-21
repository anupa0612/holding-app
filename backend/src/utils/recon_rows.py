from __future__ import annotations

from typing import Any


def difference_is_zero(value: Any) -> bool:
    """True when Difference is zero (5 decimal places), i.e. matched."""
    if value is None:
        return True
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return True
        try:
            return round(float(s), 5) == 0.0
        except ValueError:
            return False
    try:
        return round(float(value), 5) == 0.0
    except (TypeError, ValueError):
        return False


def _broker_balance_from_row(r: dict) -> Any:
    for key in (
        "Balance at record date (Clear Street - ISIN total)",
        "Balance at record date (CACEIS - ISIN total)",
        "Balance at record date (CACEIS)",
    ):
        if r.get(key) is not None:
            return r.get(key)
    for k, v in r.items():
        if str(k).startswith("Balance at record date"):
            return v
    return None


def normalize_caceis_row(r: dict, *, value_date: str | None = None, only_side: str | None = None) -> dict:
    isin = r.get("ISIN")
    diff_display = r.get("Net holding difference (display)")
    if diff_display is None:
        diff_display = r.get("Net holding difference (ISIN total)")
    if diff_display is None:
        diff_display = r.get("Net holding difference")
    row = {
        "Date": r.get("Date"),
        "Customer No": r.get("Customer No"),
        "Customer Name": r.get("Customer Name"),
        "AT - ISIN": isin,
        "AT Settled Quantity": r.get("Settled Quantity (AT - customer)") or r.get("Settled Quantity (AT)"),
        "Broker ISIN": isin,
        "Broker Settled Quantity": _broker_balance_from_row(r),
        "Difference": diff_display,
        "rowKey": f"{isin}|{r.get('Customer No') or ''}|{r.get('Customer Name') or ''}",
    }

    if only_side == "our":
        row["Broker Settled Quantity"] = 0
        row["Difference"] = row.get("AT Settled Quantity") or 0
        row["rowKey"] = (
            f"{row.get('AT - ISIN')}|{row.get('Customer No') or ''}|{row.get('Customer Name') or ''}|ONLY_AT"
        )
    elif only_side == "cp":
        row["Date"] = value_date or row.get("Date")
        row["AT Settled Quantity"] = 0
        row["Difference"] = row.get("Broker Settled Quantity") or 0
        row["rowKey"] = f"{row.get('Broker ISIN')}|||ONLY_BROKER"

    return row


def collect_normalized_rows(recon: dict, res: dict) -> list[dict]:
    rows: list[dict] = []
    value_date = recon.get("valueDate")

    for x in res.get("matched") or []:
        rows.append(normalize_caceis_row(x))
    for x in res.get("breaks") or []:
        rows.append(normalize_caceis_row(x))
    for x in res.get("onlyOur") or []:
        rows.append(normalize_caceis_row(x, only_side="our"))
    for x in res.get("onlyCp") or []:
        rows.append(normalize_caceis_row(x, value_date=value_date, only_side="cp"))

    return rows


def split_rows_by_difference(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    matched: list[dict] = []
    breaks: list[dict] = []
    for row in rows:
        if difference_is_zero(row.get("Difference")):
            matched.append(row)
        else:
            breaks.append(row)
    return matched, breaks


def isin_summary_counts(matched: list[dict], breaks: list[dict]) -> dict[str, int]:
    def isin_key(row: dict) -> str:
        return str(row.get("Broker ISIN") or row.get("AT - ISIN") or "")

    return {
        "matched": len({isin_key(x) for x in matched if isin_key(x)}),
        "breaks": len({isin_key(x) for x in breaks if isin_key(x)}),
    }

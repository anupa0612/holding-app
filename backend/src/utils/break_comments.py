from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from src.mongo_ids import oid

BREAK_ROW_KEY_PREFIX = "BREAK|"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def break_comment_row_key(isin: str) -> str:
    return f"{BREAK_ROW_KEY_PREFIX}{isin}"


def is_break_comment_row_key(row_key: str) -> bool:
    return str(row_key or "").startswith(BREAK_ROW_KEY_PREFIX)


def isin_from_break_row_key(row_key: str) -> str | None:
    if not is_break_comment_row_key(row_key):
        return None
    isin = row_key[len(BREAK_ROW_KEY_PREFIX) :].strip()
    return isin or None


def isin_from_normalized_row(row: dict) -> str:
    return str(row.get("Broker ISIN") or row.get("AT - ISIN") or "").strip()


def normalize_difference(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        try:
            return round(float(s), 5)
        except ValueError:
            return None
    try:
        return round(float(value), 5)
    except (TypeError, ValueError):
        return None


def differences_equal(a: Any, b: Any) -> bool:
    na = normalize_difference(a)
    nb = normalize_difference(b)
    if na is None and nb is None:
        return True
    if na is None or nb is None:
        return False
    return na == nb


def compute_isin_break_differences(break_rows: list[dict]) -> dict[str, float | None]:
    """First-seen difference per ISIN in the current breaks list."""
    out: dict[str, float | None] = {}
    for row in break_rows:
        isin = isin_from_normalized_row(row)
        if not isin or isin in out:
            continue
        out[isin] = normalize_difference(row.get("Difference"))
    return out


def _account_scope_query(recon: dict) -> dict:
    return {
        "accountId": recon.get("accountId"),
        "brokerId": recon.get("brokerId"),
        "reconType": recon.get("type"),
    }


def get_latest_reviewed_reconciliation(db, recon: dict) -> dict | None:
    account_id = recon.get("accountId")
    if not account_id:
        return None
    q = {**_account_scope_query(recon), "status": "reviewed"}
    return db["reconciliations"].find_one(
        q,
        sort=[("reviewedAt", -1), ("updatedAt", -1), ("createdAt", -1)],
    )


def is_latest_reviewed_for_account(db, recon: dict) -> bool:
    if recon.get("status") != "reviewed":
        return False
    latest = get_latest_reviewed_reconciliation(db, recon)
    if not latest:
        return False
    return oid_str(latest["_id"]) == oid_str(recon["_id"])


def _account_break_query(recon: dict, isin: str) -> dict:
    return {
        "accountId": recon.get("accountId"),
        "brokerId": recon.get("brokerId"),
        "reconType": recon.get("type"),
        "isin": isin,
    }


def _archive_active_to_history(doc: dict, *, reason: str, difference: Any) -> list[dict]:
    history = list(doc.get("history") or [])
    active_break = doc.get("break")
    active_comment = (doc.get("comment") or "").strip()
    if not active_break and not active_comment:
        return history
    history.append(
        {
            "break": active_break,
            "comment": active_comment,
            "difference": normalize_difference(difference),
            "archivedReason": reason,
            "createdAt": doc.get("updatedAt") or _now(),
            "updatedBy": doc.get("updatedBy"),
            "updatedByName": doc.get("updatedByName"),
        }
    )
    return history


def _sync_recon_comment_doc(
    db,
    recon_id,
    row_key: str,
    *,
    break_payload: dict | None,
    comment: str,
    history: list[dict],
    updated_by=None,
    updated_by_name: str | None = None,
) -> None:
    recon_oid = oid(recon_id) if not hasattr(recon_id, "binary") else recon_id
    if not history and not break_payload and not (comment or "").strip():
        db["comments"].delete_many({"reconciliationId": recon_oid, "rowKey": row_key})
        return

    update_fields: dict[str, Any] = {
        "reconciliationId": recon_oid,
        "rowKey": row_key,
        "comment": comment or "",
        "break": break_payload,
        "history": history,
        "updatedAt": _now(),
    }
    if updated_by is not None:
        update_fields["updatedBy"] = updated_by
    if updated_by_name is not None:
        update_fields["updatedByName"] = updated_by_name

    db["comments"].update_one(
        {"reconciliationId": recon_oid, "rowKey": row_key},
        {"$set": update_fields},
        upsert=True,
    )


def _find_prior_break_comment(db, recon: dict, row_key: str, *, exclude_recon_id) -> dict | None:
    recent_recon_ids = [
        d["_id"]
        for d in db["reconciliations"]
        .find(
            {
                "accountId": recon.get("accountId"),
                "brokerId": recon.get("brokerId"),
                "type": recon.get("type"),
                "_id": {"$ne": exclude_recon_id},
            }
        )
        .sort("createdAt", -1)
        .limit(30)
    ]
    if not recent_recon_ids:
        return None
    return db["comments"].find_one(
        {"reconciliationId": {"$in": recent_recon_ids}, "rowKey": row_key},
        sort=[("updatedAt", -1)],
    )


def sync_account_break_comments_on_build(db, recon: dict, break_rows: list[dict]) -> None:
    """
    Persist ISIN-level break comments per account across daily rebuilds.

    - Same difference while still breaking: carry active comment forward.
    - Difference changed: archive active comment to history and clear the field.
    - Break cleared (matched): archive active comment and deactivate until it breaks again.
    """
    account_id = recon.get("accountId")
    if not account_id:
        return

    recon_oid = recon["_id"]
    current_breaks = compute_isin_break_differences(break_rows)
    current_isins = set(current_breaks.keys())

    active_docs = list(
        db["account_break_comments"].find(
            {
                "accountId": account_id,
                "brokerId": recon.get("brokerId"),
                "reconType": recon.get("type"),
                "active": True,
            }
        )
    )
    for doc in active_docs:
        isin = str(doc.get("isin") or "")
        if isin in current_isins:
            continue
        history = _archive_active_to_history(doc, reason="break_cleared", difference=doc.get("lastDifference"))
        db["account_break_comments"].update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "active": False,
                    "break": None,
                    "comment": "",
                    "history": history,
                    "clearedAt": _now(),
                    "updatedAt": _now(),
                }
            },
        )

    for isin, current_diff in current_breaks.items():
        row_key = break_comment_row_key(isin)
        query = _account_break_query(recon, isin)
        doc = db["account_break_comments"].find_one(query) or {}

        history = list(doc.get("history") or [])
        active_break = doc.get("break")
        active_comment = doc.get("comment") or ""

        if doc.get("_id"):
            if doc.get("active"):
                if not differences_equal(doc.get("lastDifference"), current_diff):
                    history = _archive_active_to_history(
                        doc, reason="difference_changed", difference=doc.get("lastDifference")
                    )
                    active_break = None
                    active_comment = ""
            else:
                # Break returned after being cleared — start a fresh active comment.
                active_break = None
                active_comment = ""
        else:
            prior = _find_prior_break_comment(db, recon, row_key, exclude_recon_id=recon_oid)
            if prior and (prior.get("break") or prior.get("comment")):
                prior_recon = db["reconciliations"].find_one({"_id": prior.get("reconciliationId")}) or {}
                prior_res = db["reconciliation_results"].find_one({"reconciliationId": prior.get("reconciliationId")}) or {}
                from src.utils.recon_rows import collect_normalized_rows, split_rows_by_difference

                _, prior_break_rows = split_rows_by_difference(collect_normalized_rows(prior_recon, prior_res))
                prior_diff = compute_isin_break_differences(prior_break_rows).get(isin)
                prior_break = prior.get("break")
                prior_comment = prior.get("comment") or ""
                history = list(prior.get("history") or [])
                if not history and (prior_break or prior_comment):
                    history = [
                        {
                            "break": prior_break,
                            "comment": prior_comment,
                            "createdAt": prior.get("updatedAt") or _now(),
                            "updatedBy": prior.get("updatedBy"),
                            "updatedByName": prior.get("updatedByName"),
                        }
                    ]
                if differences_equal(prior_diff, current_diff):
                    active_break = prior_break
                    active_comment = prior_comment
                else:
                    history = _archive_active_to_history(
                        {
                            "break": prior_break,
                            "comment": prior_comment,
                            "history": history,
                            "updatedAt": prior.get("updatedAt"),
                            "updatedBy": prior.get("updatedBy"),
                            "updatedByName": prior.get("updatedByName"),
                        },
                        reason="difference_changed",
                        difference=prior_diff,
                    )
                    active_break = None
                    active_comment = ""
            else:
                active_break = None
                active_comment = ""

        account_doc = {
            **query,
            "rowKey": row_key,
            "isin": isin,
            "lastDifference": current_diff,
            "active": True,
            "break": active_break,
            "comment": active_comment,
            "history": history,
            "lastReconciliationId": recon_oid,
            "updatedAt": _now(),
        }
        if doc.get("_id"):
            db["account_break_comments"].update_one({"_id": doc["_id"]}, {"$set": account_doc})
        else:
            account_doc["createdAt"] = _now()
            db["account_break_comments"].insert_one(account_doc)

        _sync_recon_comment_doc(
            db,
            recon_oid,
            row_key,
            break_payload=active_break,
            comment=active_comment,
            history=history,
            updated_by=doc.get("updatedBy"),
            updated_by_name=doc.get("updatedByName"),
        )


def upsert_account_break_comment(
    db,
    recon: dict,
    row_key: str,
    *,
    break_payload: dict | None,
    comment: str,
    history_item: dict,
) -> None:
    isin = isin_from_break_row_key(row_key)
    if not isin or not recon.get("accountId"):
        return

    res = db["reconciliation_results"].find_one({"reconciliationId": recon["_id"]}) or {}
    from src.utils.recon_rows import collect_normalized_rows, split_rows_by_difference

    _, breaks = split_rows_by_difference(collect_normalized_rows(recon, res))
    current_diff = compute_isin_break_differences(breaks).get(isin)

    query = _account_break_query(recon, isin)
    existing = db["account_break_comments"].find_one(query) or {}
    history = list(existing.get("history") or [])
    history.append(history_item)

    account_doc = {
        **query,
        "rowKey": row_key,
        "isin": isin,
        "lastDifference": current_diff,
        "active": True,
        "break": break_payload,
        "comment": comment,
        "history": history,
        "lastReconciliationId": recon["_id"],
        "updatedAt": _now(),
        "updatedBy": history_item.get("updatedBy"),
        "updatedByName": history_item.get("updatedByName"),
    }
    if existing.get("_id"):
        db["account_break_comments"].update_one({"_id": existing["_id"]}, {"$set": account_doc})
    else:
        account_doc["createdAt"] = _now()
        db["account_break_comments"].insert_one(account_doc)


def comment_for_export(comments_by_rowkey: dict[str, dict], row: dict) -> dict:
    """Resolve break comment for export — prefer BREAK|ISIN key."""
    direct = comments_by_rowkey.get(row.get("rowKey") or "") or {}
    if direct.get("break") or direct.get("comment"):
        return direct
    isin = isin_from_normalized_row(row)
    if isin:
        return comments_by_rowkey.get(break_comment_row_key(isin)) or {}
    return {}

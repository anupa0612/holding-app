from __future__ import annotations

import os
import shutil

from flask import current_app

from bson import ObjectId

from src.mongo_ids import oid, oid_str


def _recon_oid(recon_id) -> ObjectId:
    if isinstance(recon_id, ObjectId):
        return recon_id
    return oid(str(recon_id))


def delete_recon_upload_dir(recon_id: str) -> None:
    upload_root = current_app.config.get("UPLOAD_ROOT")
    if not upload_root:
        return
    recon_dir = os.path.join(upload_root, str(recon_id))
    if os.path.isdir(recon_dir):
        shutil.rmtree(recon_dir, ignore_errors=True)


def purge_reconciliation(db, recon_id) -> None:
    """Remove a reconciliation and all dependent records (comments, results, uploads)."""
    recon_oid = _recon_oid(recon_id)
    recon_id_str = oid_str(recon_oid)
    db["comments"].delete_many({"reconciliationId": recon_oid})
    db["reconciliation_results"].delete_many({"reconciliationId": recon_oid})
    db["reconciliations"].delete_one({"_id": recon_oid})
    delete_recon_upload_dir(recon_id_str)


def purge_account_data(db, account_id, broker_id) -> int:
    """
    Delete an account and all reconciliations / break-comment history tied to it.
    Returns the number of reconciliations removed.
    """
    account_oid = oid(account_id)
    broker_oid = oid(broker_id)
    recon_count = 0
    for recon in db["reconciliations"].find({"accountId": account_oid, "brokerId": broker_oid}):
        purge_reconciliation(db, recon["_id"])
        recon_count += 1
    db["account_break_comments"].delete_many({"accountId": account_oid, "brokerId": broker_oid})
    db["accounts"].delete_one({"_id": account_oid, "brokerId": broker_oid})
    return recon_count

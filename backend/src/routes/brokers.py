from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from src.broker_seed import ensure_standard_brokers
from src.db import get_db
from src.mongo_ids import oid, oid_str
from src.routes.users import JURISDICTIONS
from src.utils.recon_cleanup import purge_account_data
from src.utils.broker_templates import (
    BUILDERS,
    broker_template_keys_map,
    list_registered_recon_types,
    list_supported_recon_types,
    list_template_catalog,
    resolve_broker_template_key,
)

bp = Blueprint("brokers", __name__)


def _now():
    return datetime.now(timezone.utc)


def _sync_broker_template_links(db) -> None:
    """Persist resolved template keys onto broker documents (idempotent)."""
    brokers = db["brokers"]
    for doc in brokers.find():
        keys_map = broker_template_keys_map(doc)
        if not keys_map:
            continue
        updates: dict = {}
        if doc.get("templateKeys") != keys_map:
            updates["templateKeys"] = keys_map
        position_key = keys_map.get("position")
        if position_key and doc.get("templateKey") != position_key:
            updates["templateKey"] = position_key
        if updates:
            brokers.update_one({"_id": doc["_id"]}, {"$set": updates})


def _serialize_broker(doc: dict) -> dict:
    supported = list_supported_recon_types(doc)
    position_template = resolve_broker_template_key(doc, "position")
    return {
        "id": oid_str(doc["_id"]),
        "name": doc.get("name"),
        "jurisdiction": doc.get("jurisdiction"),
        "templateKey": doc.get("templateKey") or position_template,
        "templateKeys": broker_template_keys_map(doc) or doc.get("templateKeys"),
        "supportedReconTypes": supported,
    }


def _serialize_account(doc: dict) -> dict:
    return {"id": oid_str(doc["_id"]), "name": doc.get("name"), "number": doc.get("number")}

def _active_jurisdiction() -> str:
    j = (get_jwt() or {}).get("jurisdiction") or ""
    j = str(j).strip()
    return j if j in JURISDICTIONS else "ALL"


def _require_admin(db) -> tuple[bool, dict]:
    me = db["users"].find_one({"_id": oid(get_jwt_identity())}) or {}
    return (me.get("role") == "admin"), me


def _jurisdiction_query(active: str) -> dict:
    """
    Backward compatible:
    - new: docs may have `jurisdictions: []` or `jurisdiction: str`
    - legacy: no jurisdiction fields => treated as ALL (visible everywhere)
    """
    if active == "ALL":
        return {}
    return {
        "$or": [
            {"jurisdiction": active},
            {"jurisdiction": "ALL"},
            {"jurisdictions": active},
            {"jurisdictions": "ALL"},
            {"jurisdiction": {"$exists": False}, "jurisdictions": {"$exists": False}},
        ]
    }


@bp.post("")
@jwt_required()
def create_broker():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    jurisdiction = (body.get("jurisdiction") or "EU").strip()
    if not name:
        return {"error": "Broker name is required"}, 400
    if jurisdiction not in JURISDICTIONS or jurisdiction == "ALL":
        return {"error": "Valid jurisdiction required (EU, US, ME, ASIA, HK)"}, 400

    db = get_db()
    is_admin, _ = _require_admin(db)
    if not is_admin:
        return {"error": "Admin access required"}, 403

    existing = db["brokers"].find_one({"name": name})
    if existing:
        return {"error": "A broker with this name already exists"}, 409

    doc = {
        "name": name,
        "jurisdiction": jurisdiction,
        "createdBy": oid(get_jwt_identity()),
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    position_template = (body.get("positionTemplateKey") or body.get("templateKey") or "").strip()
    if position_template:
        if position_template not in BUILDERS:
            known = ", ".join(sorted(BUILDERS.keys())) or "(none)"
            return {"error": f"Unknown position template '{position_template}'. Known: {known}"}, 400
        doc["templateKeys"] = {"position": position_template}
        doc["templateKey"] = position_template
    else:
        template_keys = broker_template_keys_map({"name": name})
        if template_keys:
            doc["templateKeys"] = template_keys
            if template_keys.get("position"):
                doc["templateKey"] = template_keys["position"]
    res = db["brokers"].insert_one(doc)
    created = db["brokers"].find_one({"_id": res.inserted_id})
    return {"broker": _serialize_broker(created)}, 201


@bp.get("/recon-types")
@jwt_required()
def registered_recon_types():
    """Reconciliation types that have a backend template implemented."""
    return {"items": list_registered_recon_types()}


@bp.get("/templates")
@jwt_required()
def registered_templates():
    """All registered backend reconciliation templates."""
    return {"items": list_template_catalog()}


@bp.get("")
@jwt_required()
def list_brokers():
    db = get_db()
    ensure_standard_brokers(db)
    _sync_broker_template_links(db)
    active = _active_jurisdiction()
    q = _jurisdiction_query(active)
    items = [_serialize_broker(d) for d in db["brokers"].find(q).sort("name", 1)]
    return {"items": items}


@bp.get("/<broker_id>/accounts")
@jwt_required()
def list_accounts(broker_id: str):
    db = get_db()
    active = _active_jurisdiction()

    broker = db["brokers"].find_one({"_id": oid(broker_id)})
    if not broker:
        return {"error": "Broker not found"}, 404
    broker_allowed = db["brokers"].find_one({"_id": oid(broker_id), **_jurisdiction_query(active)})
    if not broker_allowed:
        return {"error": "Broker not available for this jurisdiction"}, 403

    items = [
        _serialize_account(d)
        for d in db["accounts"].find({"brokerId": oid(broker_id)}).sort("name", 1)
    ]
    return {"items": items}


@bp.post("/<broker_id>/accounts")
@jwt_required()
def create_account(broker_id: str):
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    number = (body.get("number") or "").strip()
    if not name:
        return {"error": "Account name is required"}, 400

    db = get_db()
    active = _active_jurisdiction()
    broker_allowed = db["brokers"].find_one({"_id": oid(broker_id), **_jurisdiction_query(active)})
    if not broker_allowed:
        return {"error": "Broker not available for this jurisdiction"}, 403

    doc = {
        "brokerId": oid(broker_id),
        "name": name,
        "number": number or None,
        "jurisdiction": active,
        "createdBy": oid(get_jwt_identity()),
        "createdAt": _now(),
        "updatedAt": _now(),
    }
    res = db["accounts"].insert_one(doc)
    created = db["accounts"].find_one({"_id": res.inserted_id})
    return {"account": _serialize_account(created)}


@bp.delete("/<broker_id>/accounts/<account_id>")
@jwt_required()
def delete_account(broker_id: str, account_id: str):
    db = get_db()
    is_admin, _ = _require_admin(db)
    if not is_admin:
        return {"error": "Admin access required"}, 403

    broker_oid = oid(broker_id)
    account_oid = oid(account_id)
    broker = db["brokers"].find_one({"_id": broker_oid})
    if not broker:
        return {"error": "Broker not found"}, 404

    account = db["accounts"].find_one({"_id": account_oid, "brokerId": broker_oid})
    if not account:
        return {"error": "Account not found for this broker"}, 404

    reconciliations_deleted = purge_account_data(db, account_oid, broker_oid)
    return {"ok": True, "reconciliationsDeleted": reconciliations_deleted}


@bp.delete("/<broker_id>")
@jwt_required()
def delete_broker(broker_id: str):
    db = get_db()
    is_admin, _ = _require_admin(db)
    if not is_admin:
        return {"error": "Admin access required"}, 403

    broker_oid = oid(broker_id)
    broker = db["brokers"].find_one({"_id": broker_oid})
    if not broker:
        return {"error": "Broker not found"}, 404

    recon_count = db["reconciliations"].count_documents({"brokerId": broker_oid})
    if recon_count:
        return {
            "error": (
                f"Cannot delete broker: {recon_count} reconciliation(s) still reference it. "
                "Delete those reconciliations first."
            )
        }, 409

    db["accounts"].delete_many({"brokerId": broker_oid})
    db["brokers"].delete_one({"_id": broker_oid})
    return {"ok": True}


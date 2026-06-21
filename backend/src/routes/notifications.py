from __future__ import annotations

from datetime import datetime, timezone

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.db import get_db
from src.mongo_ids import oid, oid_str

bp = Blueprint("notifications", __name__)


def _now():
    return datetime.now(timezone.utc)


def _serialize(n: dict) -> dict:
    return {
        "id": oid_str(n["_id"]),
        "type": n.get("type") or "generic",
        "title": n.get("title") or "",
        "body": n.get("body") or "",
        "meta": n.get("meta") or {},
        "createdAt": n.get("createdAt").isoformat() if n.get("createdAt") else None,
        "readAt": n.get("readAt").isoformat() if n.get("readAt") else None,
    }


@bp.get("")
@jwt_required()
def list_notifications():
    limit = int(request.args.get("limit") or 30)
    limit = max(1, min(limit, 200))
    only_unread = str(request.args.get("unread") or "").strip().lower() in {"1", "true", "yes"}

    db = get_db()
    user_oid = oid(get_jwt_identity())
    q: dict = {"userId": user_oid}
    if only_unread:
        q["readAt"] = None

    items = [_serialize(x) for x in db["notifications"].find(q).sort("createdAt", -1).limit(limit)]
    unread_count = db["notifications"].count_documents({"userId": user_oid, "readAt": None})
    return {"items": items, "unreadCount": int(unread_count)}


@bp.post("/mark-read")
@jwt_required()
def mark_read():
    body = request.get_json(silent=True) or {}
    ids = body.get("ids") or []
    if not isinstance(ids, list) or not ids:
        return {"error": "ids must be a non-empty array"}, 400

    db = get_db()
    user_oid = oid(get_jwt_identity())

    oids = []
    for x in ids:
        s = str(x).strip()
        if not s:
            continue
        try:
            oids.append(oid(s))
        except Exception:
            continue

    if not oids:
        return {"error": "No valid ids provided"}, 400

    db["notifications"].update_many(
        {"_id": {"$in": oids}, "userId": user_oid, "readAt": None},
        {"$set": {"readAt": _now()}},
    )
    unread_count = db["notifications"].count_documents({"userId": user_oid, "readAt": None})
    return {"ok": True, "unreadCount": int(unread_count)}


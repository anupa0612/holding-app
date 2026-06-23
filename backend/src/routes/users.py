from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from src.db import get_db
from src.mongo_ids import oid, oid_str
from src.security import hash_password

bp = Blueprint("users", __name__)

TEAMS = {"Reconciliations", "Operations"}
PORTAL_JURISDICTIONS = frozenset({"EU", "US", "ME", "ASIA", "HK"})
# ALL is a user-access flag (any portal), not a sign-in jurisdiction.
JURISDICTIONS = PORTAL_JURISDICTIONS | {"ALL"}
ROLES = {"admin", "user"}


def _to_username(email: str | None, full_name: str | None) -> str:
    if full_name and str(full_name).strip():
        return str(full_name).strip()
    if email and "@" in str(email):
        return str(email).split("@", 1)[0]
    return str(email or "").strip() or "user"


def _require_admin(db) -> tuple[bool, dict | None]:
    me = db["users"].find_one({"_id": oid(get_jwt_identity())}) or {}
    return (me.get("role") == "admin"), me


def _normalize_jurisdictions(body: dict) -> tuple[list[str], str] | tuple[None, None]:
    """
    Returns (jurisdictions, primaryJurisdiction).
    Accepts new-style `jurisdictions: string[]` and legacy `jurisdiction: string`.
    """
    raw_list = body.get("jurisdictions")
    raw_single = body.get("jurisdiction")

    vals: list[str] = []
    if isinstance(raw_list, list):
        vals = [str(v).strip() for v in raw_list if str(v).strip()]
    elif raw_single is not None:
        s = str(raw_single).strip()
        vals = [s] if s else []

    vals = [v for v in vals if v in JURISDICTIONS]
    # de-dupe (preserve order)
    seen: set[str] = set()
    vals = [v for v in vals if not (v in seen or seen.add(v))]

    if not vals:
        return None, None

    if "ALL" in vals:
        vals = ["ALL"]

    primary = vals[0]
    return vals, primary


@bp.get("/reviewer-candidates")
@jwt_required()
def list_reviewer_candidates():
    """Users who can review reconciliations (Reconciliations team, not Operations)."""
    db = get_db()
    me_id = oid(get_jwt_identity())
    items = []
    for u in db["users"].find({}).sort("email", 1):
        if u.get("_id") == me_id:
            continue
        team = str(u.get("team") or "")
        if team == "Operations":
            continue
        items.append(
            {
                "id": oid_str(u["_id"]),
                "fullName": u.get("fullName") or u.get("username") or "",
                "email": u.get("email"),
                "team": u.get("team"),
            }
        )
    return {"items": items}


@bp.get("")
@jwt_required()
def list_users():
    db = get_db()
    is_admin, _me = _require_admin(db)
    if not is_admin:
        return {"error": "Admin access required"}, 403
    items = []
    for u in db["users"].find({}).sort("email", 1):
        jurisdictions = u.get("jurisdictions")
        if not isinstance(jurisdictions, list) or not jurisdictions:
            legacy = u.get("jurisdiction")
            jurisdictions = [legacy] if legacy else []
        items.append(
            {
                "id": oid_str(u["_id"]),
                "fullName": u.get("fullName") or u.get("username") or "",
                "email": u.get("email"),
                "role": u.get("role", "user"),
                "team": u.get("team"),
                "jurisdiction": u.get("jurisdiction") or (jurisdictions[0] if jurisdictions else None),
                "jurisdictions": jurisdictions,
            }
        )
    return {"items": items}


@bp.post("")
@jwt_required()
def create_user():
    db = get_db()
    is_admin, _me = _require_admin(db)
    if not is_admin:
        return {"error": "Admin access required"}, 403

    body = request.get_json(silent=True) or {}
    full_name = (body.get("fullName") or "").strip()
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    role = (body.get("role") or "user").strip().lower()
    team = (body.get("team") or "").strip()
    jurisdictions, primary_jurisdiction = _normalize_jurisdictions(body)

    if not full_name:
        return {"error": "fullName is required"}, 400
    if not email or "@" not in email:
        return {"error": "Valid email is required"}, 400
    if not password or len(str(password)) < 6:
        return {"error": "Password must be at least 6 characters"}, 400
    if role not in ROLES:
        return {"error": "Invalid role"}, 400
    if team not in TEAMS:
        return {"error": "Invalid team"}, 400
    if not jurisdictions:
        return {"error": "At least one jurisdiction is required"}, 400

    existing = db["users"].find_one({"email": email})
    if existing:
        return {"error": "User already exists"}, 400

    doc = {
        "email": email,
        "fullName": full_name,
        "username": _to_username(email, full_name),
        "role": role,
        "team": team,
        "jurisdiction": primary_jurisdiction,
        "jurisdictions": jurisdictions,
        "passwordHash": hash_password(str(password)),
    }
    res = db["users"].insert_one(doc)
    return {
        "user": {
            "id": oid_str(res.inserted_id),
            "fullName": doc["fullName"],
            "email": doc["email"],
            "role": doc["role"],
            "team": doc["team"],
            "jurisdiction": doc["jurisdiction"],
            "jurisdictions": doc["jurisdictions"],
        }
    }


@bp.put("/<user_id>")
@jwt_required()
def update_user(user_id: str):
    db = get_db()
    is_admin, me = _require_admin(db)
    if not is_admin:
        return {"error": "Admin access required"}, 403

    target = db["users"].find_one({"_id": oid(user_id)})
    if not target:
        return {"error": "Not found"}, 404

    body = request.get_json(silent=True) or {}
    full_name = (body.get("fullName") or "").strip()
    role = (body.get("role") or "").strip().lower() if body.get("role") is not None else None
    team = (body.get("team") or "").strip() if body.get("team") is not None else None
    wants_juris = body.get("jurisdictions") is not None or body.get("jurisdiction") is not None
    jurisdictions, primary_jurisdiction = _normalize_jurisdictions(body) if wants_juris else (None, None)
    password = body.get("password")

    updates: dict = {}
    if full_name:
        updates["fullName"] = full_name
        updates["username"] = _to_username(target.get("email"), full_name)
    if role is not None:
        if role not in ROLES:
            return {"error": "Invalid role"}, 400
        updates["role"] = role
    if team is not None:
        if team not in TEAMS:
            return {"error": "Invalid team"}, 400
        updates["team"] = team
    if wants_juris:
        if not jurisdictions:
            return {"error": "At least one jurisdiction is required"}, 400
        updates["jurisdictions"] = jurisdictions
        updates["jurisdiction"] = primary_jurisdiction

    if password is not None and str(password).strip():
        if len(str(password)) < 6:
            return {"error": "Password must be at least 6 characters"}, 400
        updates["passwordHash"] = hash_password(str(password))

    # Prevent admin from removing their own admin access accidentally
    if oid_str(me["_id"]) == oid_str(target["_id"]) and updates.get("role") == "user":
        return {"error": "You cannot remove your own admin access"}, 400

    if not updates:
        return {"error": "No changes provided"}, 400

    db["users"].update_one({"_id": oid(user_id)}, {"$set": updates})
    updated = db["users"].find_one({"_id": oid(user_id)}) or {}
    out_jurisdictions = updated.get("jurisdictions")
    if not isinstance(out_jurisdictions, list) or not out_jurisdictions:
        legacy = updated.get("jurisdiction")
        out_jurisdictions = [legacy] if legacy else []
    return {
        "user": {
            "id": oid_str(updated["_id"]),
            "fullName": updated.get("fullName") or updated.get("username") or "",
            "email": updated.get("email"),
            "role": updated.get("role", "user"),
            "team": updated.get("team"),
            "jurisdiction": updated.get("jurisdiction") or (out_jurisdictions[0] if out_jurisdictions else None),
            "jurisdictions": out_jurisdictions,
        }
    }


@bp.delete("/<user_id>")
@jwt_required()
def delete_user(user_id: str):
    db = get_db()
    is_admin, me = _require_admin(db)
    if not is_admin:
        return {"error": "Admin access required"}, 403

    target_oid = oid(user_id)
    target = db["users"].find_one({"_id": target_oid})
    if not target:
        return {"error": "Not found"}, 404

    if oid_str(me["_id"]) == oid_str(target_oid):
        return {"error": "You cannot delete your own account"}, 400

    if target.get("role") == "admin":
        admin_count = db["users"].count_documents({"role": "admin"})
        if admin_count <= 1:
            return {"error": "Cannot delete the last admin account"}, 400

    user_oid = target_oid
    user_id_str = oid_str(user_oid)
    user_ref = {"$in": [user_oid, user_id_str]}

    # Keep historical reconciliations; clear pending reviewer assignments only.
    db["reconciliations"].update_many(
        {"reviewerId": user_ref, "status": "submitted"},
        {"$unset": {"reviewerId": ""}},
    )
    db["notifications"].delete_many({"userId": user_oid})
    db["users"].delete_one({"_id": target_oid})
    return {"ok": True}


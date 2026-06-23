from __future__ import annotations

from flask import Blueprint, request
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required

from src.db import get_db
from src.mongo_ids import oid, oid_str
from src.rate_limit import check_rate_limit
from src.security import verify_password
from src.routes.users import PORTAL_JURISDICTIONS

bp = Blueprint("auth", __name__)


@bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    jurisdiction = (body.get("jurisdiction") or "").strip()

    if not email or not password or not jurisdiction:
        return {"error": "Missing email, password, or jurisdiction"}, 400
    if jurisdiction == "ALL" or jurisdiction not in PORTAL_JURISDICTIONS:
        return {
            "error": "Select a sign-in jurisdiction: EU, US, ME, ASIA, or HK (ALL is not a region)",
        }, 400

    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "unknown").split(",")[0].strip()
    if not check_rate_limit(f"login:{client_ip}:{email}", max_attempts=8, window_seconds=300):
        return {"error": "Too many login attempts. Try again in a few minutes."}, 429

    db = get_db()
    user = db["users"].find_one({"email": email})
    if not user or not verify_password(password, user.get("passwordHash", "")):
        return {"error": "Invalid credentials"}, 401

    allowed = user.get("jurisdictions")
    if not isinstance(allowed, list) or not allowed:
        legacy = user.get("jurisdiction")
        allowed = [legacy] if legacy else []
    allowed = [str(v).strip() for v in allowed if str(v).strip()]
    if "ALL" not in allowed and jurisdiction not in allowed:
        return {"error": f"Jurisdiction '{jurisdiction}' not allowed for this user"}, 403

    token = create_access_token(
        identity=oid_str(user["_id"]),
        additional_claims={"jurisdiction": jurisdiction},
    )
    return {
        "accessToken": token,
        "user": {
            "id": oid_str(user["_id"]),
            "email": user["email"],
            "role": user.get("role", "user"),
            "team": user.get("team"),
            "fullName": user.get("fullName") or user.get("username") or "",
            "jurisdiction": jurisdiction,
            "jurisdictions": allowed,
        },
    }


@bp.get("/me")
@jwt_required()
def me():
    user_id = get_jwt_identity()
    claims = get_jwt() or {}
    db = get_db()
    user = db["users"].find_one({"_id": oid(user_id)})
    if not user:
        return {"error": "Not found"}, 404
    allowed = user.get("jurisdictions")
    if not isinstance(allowed, list) or not allowed:
        legacy = user.get("jurisdiction")
        allowed = [legacy] if legacy else []
    allowed = [str(v).strip() for v in allowed if str(v).strip()]
    return {
        "user": {
            "id": oid_str(user["_id"]),
            "email": user["email"],
            "role": user.get("role", "user"),
            "fullName": user.get("fullName") or user.get("username") or "",
            "team": user.get("team"),
            "jurisdiction": claims.get("jurisdiction") or user.get("jurisdiction"),
            "jurisdictions": allowed,
        }
    }


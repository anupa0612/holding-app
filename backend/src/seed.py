from __future__ import annotations

from flask import Flask

from src.broker_seed import ensure_standard_brokers
from src.db import get_db
from src.security import hash_password


def seed_dev_admin(app: Flask) -> None:
    """Seed dev admin user and sample broker/account (development only)."""
    seed_dev_user(app)


def seed_dev_user(app: Flask) -> None:
    db = get_db(app)
    users = db["users"]

    email = "admin@local"
    existing = users.find_one({"email": email})
    if not existing:
        users.insert_one(
            {
                "email": email,
                "fullName": "Admin",
                "username": "Admin",
                "passwordHash": hash_password("admin1234"),
                "role": "admin",
                "jurisdiction": "ALL",
                "jurisdictions": ["ALL"],
            }
        )
    else:
        updates = {}
        if not existing.get("fullName"):
            updates["fullName"] = "Admin"
        if not existing.get("username"):
            updates["username"] = existing.get("fullName") or "Admin"
        if not existing.get("jurisdiction"):
            updates["jurisdiction"] = "ALL"
        if not isinstance(existing.get("jurisdictions"), list) or not existing.get("jurisdictions"):
            updates["jurisdictions"] = ["ALL"]
        if updates:
            users.update_one({"_id": existing["_id"]}, {"$set": updates})

    # Seed standard brokers + default accounts for quick start
    ensure_standard_brokers(db)


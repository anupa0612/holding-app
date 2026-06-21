from __future__ import annotations

from flask import Flask

from src.db import get_db


def ensure_indexes(app: Flask) -> None:
    db = get_db(app)
    db["users"].create_index("email", unique=True)
    db["reconciliations"].create_index([("userId", 1), ("createdAt", -1)])
    db["reconciliations"].create_index([("reviewerId", 1), ("status", 1)])
    db["reconciliations"].create_index([("reviewerId", 1), ("status", 1), ("submittedAt", -1)])
    db["reconciliations"].create_index([("status", 1), ("jurisdiction", 1), ("reviewedAt", -1)])
    db["reconciliation_results"].create_index("reconciliationId", unique=True)
    db["comments"].create_index([("reconciliationId", 1), ("rowKey", 1)], unique=True)
    db["account_break_comments"].create_index(
        [("accountId", 1), ("brokerId", 1), ("reconType", 1), ("isin", 1)],
        unique=True,
    )
    db["reconciliations"].create_index(
        [("accountId", 1), ("brokerId", 1), ("type", 1), ("status", 1), ("reviewedAt", -1)]
    )
    db["notifications"].create_index([("userId", 1), ("createdAt", -1)])

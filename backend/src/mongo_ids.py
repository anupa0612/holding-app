from __future__ import annotations

from bson import ObjectId


def oid(value: str) -> ObjectId:
    return ObjectId(value)


def oid_str(value: ObjectId) -> str:
    return str(value)


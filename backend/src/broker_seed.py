from __future__ import annotations

"""Upsert standard EU brokers/accounts (idempotent)."""

# Broker display name vs backend template key (common mix-up in the admin UI).
_CLEAR_STREET_NAME = "Clear Street"
_CLEAR_STREET_TEMPLATE = "clearstreet_holdings"
_MISNAMED_CLEAR_STREET_NAMES = frozenset(
    {_CLEAR_STREET_TEMPLATE, "clearstreet", "clear street holdings"}
)


def _repair_misnamed_clear_street_brokers(db, clear_street_id) -> None:
    """Merge brokers created with the template key as the name."""
    brokers = db["brokers"]
    accounts = db["accounts"]
    for doc in brokers.find({"name": {"$in": sorted(_MISNAMED_CLEAR_STREET_NAMES)}}):
        if doc["_id"] == clear_street_id:
            continue
        accounts.update_many({"brokerId": doc["_id"]}, {"$set": {"brokerId": clear_street_id}})
        brokers.delete_one({"_id": doc["_id"]})


def ensure_standard_brokers(db) -> None:
    brokers = db["brokers"]
    accounts = db["accounts"]

    caceis = brokers.find_one({"name": "CACEIS"})
    if not caceis:
        caceis_id = brokers.insert_one(
            {
                "name": "CACEIS",
                "jurisdiction": "EU",
                "templateKeys": {"position": "caceis_holdings"},
            }
        ).inserted_id
    else:
        caceis_id = caceis["_id"]
        updates = {}
        if not caceis.get("jurisdiction"):
            updates["jurisdiction"] = "EU"
        template_keys = caceis.get("templateKeys")
        if not isinstance(template_keys, dict) or not template_keys.get("position"):
            updates["templateKeys"] = {"position": "caceis_holdings"}
        if updates:
            brokers.update_one({"_id": caceis_id}, {"$set": updates})

    if not accounts.find_one({"brokerId": caceis_id, "name": "Default Account"}):
        accounts.insert_one(
            {
                "brokerId": caceis_id,
                "name": "Default Account",
                "number": "0001",
                "jurisdiction": "EU",
                "createdBy": None,
            }
        )

    clear_street = brokers.find_one({"name": _CLEAR_STREET_NAME})
    if not clear_street:
        clear_street_id = brokers.insert_one(
            {
                "name": _CLEAR_STREET_NAME,
                "jurisdiction": "EU",
                "templateKeys": {"position": _CLEAR_STREET_TEMPLATE},
                "templateKey": _CLEAR_STREET_TEMPLATE,
            }
        ).inserted_id
    else:
        clear_street_id = clear_street["_id"]
        brokers.update_one(
            {"_id": clear_street_id},
            {
                "$set": {
                    "jurisdiction": clear_street.get("jurisdiction") or "EU",
                    "templateKeys": {"position": _CLEAR_STREET_TEMPLATE},
                    "templateKey": _CLEAR_STREET_TEMPLATE,
                }
            },
        )

    if not accounts.find_one({"brokerId": clear_street_id, "name": "Default Account"}):
        accounts.insert_one(
            {
                "brokerId": clear_street_id,
                "name": "Default Account",
                "number": "0002",
                "jurisdiction": "EU",
                "createdBy": None,
            }
        )

    _repair_misnamed_clear_street_brokers(db, clear_street_id)

    gtna_template = "eu_settled_holdings"
    gtna = brokers.find_one({"name": "GTNA"})
    if not gtna:
        gtna_id = brokers.insert_one(
            {
                "name": "GTNA",
                "jurisdiction": "EU",
                "templateKeys": {"position": gtna_template},
                "templateKey": gtna_template,
            }
        ).inserted_id
    else:
        gtna_id = gtna["_id"]
        brokers.update_one(
            {"_id": gtna_id},
            {
                "$set": {
                    "jurisdiction": gtna.get("jurisdiction") or "EU",
                    "templateKeys": {"position": gtna_template},
                    "templateKey": gtna_template,
                }
            },
        )

    if not accounts.find_one({"brokerId": gtna_id, "name": "Default Account"}):
        accounts.insert_one(
            {
                "brokerId": gtna_id,
                "name": "Default Account",
                "number": "0003",
                "jurisdiction": "EU",
                "createdBy": None,
            }
        )

    gtnme_template = "gtnme_holdings"
    gtnme = brokers.find_one({"name": "GTNME"})
    if not gtnme:
        gtnme_id = brokers.insert_one(
            {
                "name": "GTNME",
                "jurisdiction": "EU",
                "templateKeys": {"position": gtnme_template},
                "templateKey": gtnme_template,
            }
        ).inserted_id
    else:
        gtnme_id = gtnme["_id"]
        brokers.update_one(
            {"_id": gtnme_id},
            {
                "$set": {
                    "jurisdiction": gtnme.get("jurisdiction") or "EU",
                    "templateKeys": {"position": gtnme_template},
                    "templateKey": gtnme_template,
                }
            },
        )

    if not accounts.find_one({"brokerId": gtnme_id, "name": "Default Account"}):
        accounts.insert_one(
            {
                "brokerId": gtnme_id,
                "name": "Default Account",
                "number": "0004",
                "jurisdiction": "EU",
                "createdBy": None,
            }
        )

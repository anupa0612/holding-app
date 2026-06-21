from __future__ import annotations

import logging
import os
import sys

from flask import Flask

logger = logging.getLogger(__name__)


def init_db(app: Flask) -> None:
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/holding_app")
    app.extensions["mongo_uri"] = uri

    try:
        from pymongo import MongoClient

        client = MongoClient(
            uri,
            serverSelectionTimeoutMS=5000,
            maxPoolSize=int(os.getenv("MONGO_MAX_POOL_SIZE", "20")),
            retryWrites=True,
        )
        client.admin.command("ping")
        app.extensions["mongo_client"] = client
        app.extensions["mongo_db"] = client.get_default_database()
        app.extensions["mongo_mode"] = "mongo"
        logger.info("Connected to MongoDB at %s", uri.split("@")[-1] if "@" in uri else uri)
    except Exception as exc:
        logger.error("MongoDB connection failed: %s", exc)
        print(
            "FATAL: Cannot connect to MongoDB. Set MONGO_URI in backend/.env and ensure the server is reachable.",
            file=sys.stderr,
        )
        sys.exit(1)


def get_db(app: Flask | None = None):
    from flask import current_app

    flask_app = app or current_app
    return flask_app.extensions["mongo_db"]

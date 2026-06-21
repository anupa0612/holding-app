from __future__ import annotations

import os
import sys


def is_production() -> bool:
    return os.getenv("FLASK_ENV", "development").strip().lower() == "production"


def is_development() -> bool:
    return not is_production()


def seed_dev_data() -> bool:
    return os.getenv("SEED_DEV_DATA", "true" if is_development() else "false").strip().lower() in {
        "1",
        "true",
        "yes",
    }


def validate_runtime_config(jwt_secret: str) -> None:
    if not is_production():
        return
    if not jwt_secret or jwt_secret == "dev-change-me" or len(jwt_secret) < 32:
        print("FATAL: JWT_SECRET_KEY must be at least 32 characters in production.", file=sys.stderr)
        sys.exit(1)

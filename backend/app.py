from __future__ import annotations

import logging
import os
import sys
from datetime import timedelta

from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from werkzeug.exceptions import HTTPException, NotFound, RequestEntityTooLarge

_BACKEND_DIR = Path(__file__).resolve().parent
load_dotenv(_BACKEND_DIR / ".env")

from src.config import is_production, seed_dev_data, validate_runtime_config
from src.db import init_db
from src.db_indexes import ensure_indexes
from src.routes.auth import bp as auth_bp
from src.routes.brokers import bp as brokers_bp
from src.routes.notifications import bp as notifications_bp
from src.routes.reconciliations import bp as reconciliations_bp
from src.routes.users import bp as users_bp
from src.seed import seed_dev_admin


def _configure_logging() -> None:
    level = logging.DEBUG if not is_production() else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
        stream=sys.stdout,
    )


def create_app() -> Flask:
    _configure_logging()
    app = Flask(__name__)

    jwt_secret = os.getenv("JWT_SECRET_KEY", "dev-change-me")
    validate_runtime_config(jwt_secret)

    app.config["JWT_SECRET_KEY"] = jwt_secret
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=12)
    max_upload_mb = int(os.getenv("MAX_UPLOAD_MB", "50"))
    app.config["MAX_CONTENT_LENGTH"] = max_upload_mb * 1024 * 1024
    upload_root = os.getenv("UPLOAD_ROOT", str(Path(__file__).resolve().parent / "uploads"))
    Path(upload_root).mkdir(parents=True, exist_ok=True)
    app.config["UPLOAD_ROOT"] = upload_root

    cors_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if o.strip()]
    CORS(app, resources={r"/api/*": {"origins": cors_origins}}, supports_credentials=True)

    JWTManager(app)
    init_db(app)
    ensure_indexes(app)

    if seed_dev_data():
        seed_dev_admin(app)

    from src.utils.broker_templates import list_template_keys

    logging.getLogger(__name__).info(
        "Registered broker templates: %s",
        ", ".join(list_template_keys()) or "(none)",
    )

    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(users_bp, url_prefix="/api/users")
    app.register_blueprint(brokers_bp, url_prefix="/api/brokers")
    app.register_blueprint(reconciliations_bp, url_prefix="/api/reconciliations")
    app.register_blueprint(notifications_bp, url_prefix="/api/notifications")

    @app.get("/api/health")
    def health():
        from src.utils.broker_templates import list_template_keys

        mode = app.extensions.get("mongo_mode", "unknown")
        return {
            "ok": True,
            "mongoMode": mode,
            "env": "production" if is_production() else "development",
            "registeredTemplates": list_template_keys(),
        }

    @app.errorhandler(RequestEntityTooLarge)
    def handle_upload_too_large(_exc):
        max_mb = int(os.getenv("MAX_UPLOAD_MB", "50"))
        return jsonify({"error": f"Upload exceeds maximum size of {max_mb} MB"}), 413

    @app.errorhandler(NotFound)
    def handle_not_found(exc: NotFound):
        if str(getattr(exc, "path", "") or "").startswith("/api/"):
            return jsonify({"error": "API route not found"}), 404
        return exc

    @app.errorhandler(HTTPException)
    def handle_http_exception(exc: HTTPException):
        path = str(getattr(exc, "path", "") or request.path or "")
        if exc.code and path.startswith("/api/"):
            return jsonify({"error": exc.description or exc.name}), exc.code
        return exc

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc: Exception):
        if str(request.path or "").startswith("/api/"):
            logging.getLogger(__name__).exception("Unhandled API error on %s", request.path)
            return jsonify({"error": "Internal server error"}), 500
        raise exc

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "5000")), debug=not is_production())

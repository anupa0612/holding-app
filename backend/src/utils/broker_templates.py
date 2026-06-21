from __future__ import annotations

from typing import Any, Callable

from src.utils.recon_caceis import (
    build_caceis_holdings,
    build_clearstreet_holdings,
    build_eu_settled_holdings,
    build_gtnme_holdings,
    caceis_stats,
    clearstreet_stats,
    eu_settled_stats,
    gtnme_stats,
)

# Reconciliation build logic is registered here in code — not created via the app UI.
# Each templateKey maps to exactly one reconciliation type (trade | position | fi).

RECON_TYPES = frozenset({"trade", "position", "fi"})

BuildFn = Callable[[str, str], Any]
StatsFn = Callable[[str, str], dict[str, Any]]

BUILDERS: dict[str, BuildFn] = {
    "caceis_holdings": build_caceis_holdings,
    "clearstreet_holdings": build_clearstreet_holdings,
    "eu_settled_holdings": build_eu_settled_holdings,
    "gtnme_holdings": build_gtnme_holdings,
}

STATS: dict[str, StatsFn] = {
    "caceis_holdings": caceis_stats,
    "clearstreet_holdings": clearstreet_stats,
    "eu_settled_holdings": eu_settled_stats,
    "gtnme_holdings": gtnme_stats,
}

# Which reconciliation type each registered template implements.
TEMPLATE_RECON_TYPE: dict[str, str] = {
    "caceis_holdings": "position",
    "clearstreet_holdings": "position",
    "eu_settled_holdings": "position",
    "gtnme_holdings": "position",
}


def list_template_keys() -> list[str]:
    return sorted(BUILDERS.keys())


def list_registered_recon_types() -> list[dict[str, str]]:
    seen: set[str] = set()
    items: list[dict[str, str]] = []
    for key in sorted(BUILDERS.keys()):
        recon_type = TEMPLATE_RECON_TYPE.get(key, "position")
        if recon_type in seen:
            continue
        seen.add(recon_type)
        items.append({"type": recon_type, "templateKey": key})
    return items


def list_template_catalog() -> list[dict[str, str]]:
    return [
        {
            "templateKey": key,
            "reconType": TEMPLATE_RECON_TYPE.get(key, "position"),
        }
        for key in sorted(BUILDERS.keys())
    ]


def _normalize_recon_type(recon_type: str | None) -> str | None:
    t = str(recon_type or "").strip().lower()
    return t if t in RECON_TYPES else None


def broker_template_keys_map(broker: dict) -> dict[str, str]:
    """recon_type -> template_key for this broker."""
    out: dict[str, str] = {}

    raw = broker.get("templateKeys")
    if isinstance(raw, dict):
        for k, v in raw.items():
            rt = _normalize_recon_type(k)
            key = str(v or "").strip()
            if rt and key and key in BUILDERS:
                out[rt] = key

    # Legacy single templateKey applies to position (holdings) only — not trade/fi.
    legacy = str(broker.get("templateKey") or "").strip()
    if legacy and legacy in BUILDERS:
        rt = TEMPLATE_RECON_TYPE.get(legacy, "position")
        out.setdefault(rt, legacy)

    if str(broker.get("name") or "").strip().upper() == "CACEIS":
        if "caceis_holdings" in BUILDERS:
            out.setdefault("position", "caceis_holdings")

    broker_name = str(broker.get("name") or "").strip().upper().replace(" ", "")
    if broker_name in {"CLEARSTREET", "CLEARST"}:
        if "clearstreet_holdings" in BUILDERS:
            out.setdefault("position", "clearstreet_holdings")

    if broker_name == "GTNA":
        if "eu_settled_holdings" in BUILDERS:
            out.setdefault("position", "eu_settled_holdings")

    if broker_name == "GTNME":
        if "gtnme_holdings" in BUILDERS:
            out.setdefault("position", "gtnme_holdings")

    return out


def _stored_template_keys_map(broker: dict) -> dict[str, str]:
    """recon_type -> template_key from MongoDB fields (no BUILDERS check)."""
    out: dict[str, str] = {}
    raw = broker.get("templateKeys")
    if isinstance(raw, dict):
        for k, v in raw.items():
            rt = _normalize_recon_type(k)
            key = str(v or "").strip()
            if rt and key:
                out[rt] = key
    legacy = str(broker.get("templateKey") or "").strip()
    if legacy:
        out.setdefault(TEMPLATE_RECON_TYPE.get(legacy, "position"), legacy)
    return out


def list_supported_recon_types(broker: dict | None) -> list[str]:
    if not broker:
        return []
    supported = sorted(broker_template_keys_map(broker).keys())
    if supported:
        return supported
    return sorted(_stored_template_keys_map(broker).keys())


def resolve_broker_template_key(broker: dict | None, recon_type: str) -> str | None:
    if not broker:
        return None
    rt = _normalize_recon_type(recon_type)
    if not rt:
        return None
    key = broker_template_keys_map(broker).get(rt)
    if key:
        return key
    return _stored_template_keys_map(broker).get(rt)


def template_unavailable_message(broker: dict | None, recon_type: str) -> str:
    name = str((broker or {}).get("name") or "this broker")
    rt = _normalize_recon_type(recon_type) or recon_type
    supported = list_supported_recon_types(broker)
    if supported:
        return (
            f"No backend template for {rt} reconciliation with {name}. "
            f"Supported types: {', '.join(supported)}."
        )
    return (
        f"No reconciliation templates configured for {name}. "
        "Set brokers.templateKeys in the backend (e.g. position → caceis_holdings)."
    )


def run_build(template_key: str, our_path: str, cp_path: str):
    builder = BUILDERS.get(template_key)
    if not builder:
        known = ", ".join(list_template_keys()) or "(none)"
        raise ValueError(
            f"Broker template '{template_key}' is not registered in backend code. Known templates: {known}"
        )
    return builder(our_path, cp_path)


def run_stats(template_key: str, our_path: str, cp_path: str) -> dict[str, Any]:
    stats_fn = STATS.get(template_key)
    if not stats_fn:
        known = ", ".join(list_template_keys()) or "(none)"
        raise ValueError(
            f"Broker template '{template_key}' is not registered in backend code. Known templates: {known}"
        )
    return stats_fn(our_path, cp_path)

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

_lock = Lock()
_attempts: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, *, max_attempts: int = 5, window_seconds: int = 300) -> bool:
    """
    Returns True if the request is allowed, False if rate-limited.
    """
    now = time.time()
    cutoff = now - window_seconds
    with _lock:
        bucket = [t for t in _attempts[key] if t >= cutoff]
        if len(bucket) >= max_attempts:
            _attempts[key] = bucket
            return False
        bucket.append(now)
        _attempts[key] = bucket
        return True

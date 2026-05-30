"""
cache_manager.py
---------------------------------------------------------
Monthly file-based cache manager for the RxNorm Intelligence
Explorer backend.

Purpose:
- Align cache refresh behavior to source data cadence.
- RxNorm, RxClass, RxTerms, NDC, and CMS trend data are treated as
  monthly-refreshing reference datasets.
- Cache refresh day defaults to the 15th of each month.
- Cached payloads are persisted as JSON under backend/cache/.

Behavior:
- Before the 15th: use the prior monthly cache cycle.
- On/after the 15th: use the current monthly cache cycle.
- If a live refresh fails, stale cache can be returned as a safe fallback.
---------------------------------------------------------
"""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import json
import os
import tempfile
import re
from typing import Any, Callable, Dict, Optional


DEFAULT_REFRESH_DAY = int(os.getenv("MONTHLY_CACHE_REFRESH_DAY", "15"))
BASE_CACHE_DIR = Path(
    os.getenv(
        "RXNORM_CACHE_DIR",
        "/var/data/rxnorm_cache"
    )
)
BASE_CACHE_DIR.mkdir(parents=True, exist_ok=True)

CACHE_FOLDERS = {
    "drug_payloads": BASE_CACHE_DIR / "drug_payloads",
    "graph_payloads": BASE_CACHE_DIR / "graph_payloads",
    "ndc_payloads": BASE_CACHE_DIR / "ndc_payloads",
    "trending": BASE_CACHE_DIR / "trending",
    "status": BASE_CACHE_DIR / "status",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().replace(microsecond=0).isoformat()


def calculate_current_cache_cycle(
    now: Optional[datetime] = None,
    refresh_day: int = DEFAULT_REFRESH_DAY,
) -> Dict[str, str]:
    """
    Calculates the active monthly cache cycle.

    The app uses source data as monthly reference data. On/after the refresh
    day, the cache cycle advances to the current month. Before the refresh day,
    the active cache cycle remains the prior month.
    """

    safe_refresh_day = max(1, min(int(refresh_day or DEFAULT_REFRESH_DAY), 28))
    current = now or utc_now()

    if current.day >= safe_refresh_day:
        cycle_year = current.year
        cycle_month = current.month
        if current.month == 12:
            next_year = current.year + 1
            next_month = 1
        else:
            next_year = current.year
            next_month = current.month + 1
    else:
        if current.month == 1:
            cycle_year = current.year - 1
            cycle_month = 12
        else:
            cycle_year = current.year
            cycle_month = current.month - 1
        next_year = current.year
        next_month = current.month

    return {
        "cache_cycle": f"{cycle_year:04d}-{cycle_month:02d}",
        "refresh_day": str(safe_refresh_day),
        "next_refresh_date_utc": f"{next_year:04d}-{next_month:02d}-{safe_refresh_day:02d}",
    }


def ensure_cache_directories() -> None:
    for folder in CACHE_FOLDERS.values():
        folder.mkdir(parents=True, exist_ok=True)


def _safe_filename(raw_key: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9_.-]+", "_", str(raw_key).strip().lower()).strip("_")
    digest = hashlib.sha256(str(raw_key).encode("utf-8")).hexdigest()[:12]
    prefix = cleaned[:80] or "cache_entry"
    return f"{prefix}_{digest}.json"


def get_cache_path(category: str, key: str) -> Path:
    ensure_cache_directories()
    folder = CACHE_FOLDERS.get(category)
    if folder is None:
        folder = BASE_CACHE_DIR / category
        folder.mkdir(parents=True, exist_ok=True)
    return folder / _safe_filename(key)


def read_cache(category: str, key: str) -> Optional[Dict[str, Any]]:
    path = get_cache_path(category, key)
    if not path.exists():
        return None

    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return None



def _atomic_write_json(path: Path, payload: Any) -> None:
    """Writes JSON atomically so interrupted cache writes do not corrupt files."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    tmp_path = Path(tmp_name)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)
        tmp_path.replace(path)
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass


def read_status(status_name: str) -> Optional[Dict[str, Any]]:
    path = get_cache_path("status", status_name)
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return None


def write_status(status_name: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    path = get_cache_path("status", status_name)
    safe_payload = dict(payload or {})
    safe_payload["status_updated_at_utc"] = utc_now_iso()
    safe_payload["cache_base_dir"] = str(BASE_CACHE_DIR)
    try:
        _atomic_write_json(path, safe_payload)
    except Exception:
        pass
    return safe_payload


def get_cache_summary() -> Dict[str, Any]:
    ensure_cache_directories()
    folders = {}
    total_files = 0
    total_bytes = 0

    for name, folder in CACHE_FOLDERS.items():
        files = list(folder.glob("*.json")) if folder.exists() else []
        size_bytes = 0
        for file_path in files:
            try:
                size_bytes += file_path.stat().st_size
            except Exception:
                pass
        folders[name] = {
            "path": str(folder),
            "json_file_count": len(files),
            "size_bytes": size_bytes,
        }
        total_files += len(files)
        total_bytes += size_bytes

    return {
        "cache_base_dir": str(BASE_CACHE_DIR),
        "cache_policy": calculate_current_cache_cycle(),
        "total_json_file_count": total_files,
        "total_size_bytes": total_bytes,
        "total_size_mb": round(total_bytes / (1024 * 1024), 3),
        "folders": folders,
    }

def write_cache(
    category: str,
    key: str,
    payload: Any,
    refresh_day: int = DEFAULT_REFRESH_DAY,
) -> Any:
    path = get_cache_path(category, key)
    cycle = calculate_current_cache_cycle(refresh_day=refresh_day)

    envelope = {
        "metadata": {
            "cache_category": category,
            "cache_key": key,
            "cache_cycle": cycle["cache_cycle"],
            "refresh_day": cycle["refresh_day"],
            "next_refresh_date_utc": cycle["next_refresh_date_utc"],
            "created_at_utc": utc_now_iso(),
        },
        "payload": payload,
    }

    try:
        _atomic_write_json(path, envelope)
    except Exception:
        # Cache persistence should never break the API response.
        pass

    return payload


def is_cache_current(envelope: Optional[Dict[str, Any]], refresh_day: int = DEFAULT_REFRESH_DAY) -> bool:
    if not envelope:
        return False

    metadata = envelope.get("metadata", {})
    active_cycle = calculate_current_cache_cycle(refresh_day=refresh_day)["cache_cycle"]
    return metadata.get("cache_cycle") == active_cycle


def decorate_payload(
    payload: Any,
    metadata: Dict[str, Any],
    served_from_cache: bool,
    stale_cache_fallback: bool = False,
) -> Any:
    output = deepcopy(payload)

    if isinstance(output, dict):
        output["served_from_cache"] = served_from_cache
        output["cache_cycle"] = metadata.get("cache_cycle")
        output["cache_refresh_day"] = metadata.get("refresh_day")
        output["next_cache_refresh_date_utc"] = metadata.get("next_refresh_date_utc")
        output["cache_created_at_utc"] = metadata.get("created_at_utc")
        if stale_cache_fallback:
            output["stale_cache_fallback"] = True
            output["cache_warning"] = "Live refresh failed, so the most recent cached payload was returned."

    return output


def get_cached_or_build(
    category: str,
    key: str,
    builder: Callable[[], Any],
    refresh_day: int = DEFAULT_REFRESH_DAY,
    allow_stale_on_error: bool = True,
) -> Any:
    """
    Returns a current monthly cached payload or builds/writes a new payload.

    If live build fails and stale cache exists, stale cache is returned as a
    safety fallback so the dashboard remains usable.
    """

    cached = read_cache(category, key)

    if is_cache_current(cached, refresh_day=refresh_day):
        return decorate_payload(
            payload=cached.get("payload"),
            metadata=cached.get("metadata", {}),
            served_from_cache=True,
        )

    try:
        fresh_payload = builder()
        write_cache(category, key, fresh_payload, refresh_day=refresh_day)
        active_cycle = calculate_current_cache_cycle(refresh_day=refresh_day)
        metadata = {
            "cache_cycle": active_cycle["cache_cycle"],
            "refresh_day": active_cycle["refresh_day"],
            "next_refresh_date_utc": active_cycle["next_refresh_date_utc"],
            "created_at_utc": utc_now_iso(),
        }
        return decorate_payload(
            payload=fresh_payload,
            metadata=metadata,
            served_from_cache=False,
        )
    except Exception:
        if allow_stale_on_error and cached:
            return decorate_payload(
                payload=cached.get("payload"),
                metadata=cached.get("metadata", {}),
                served_from_cache=True,
                stale_cache_fallback=True,
            )
        raise

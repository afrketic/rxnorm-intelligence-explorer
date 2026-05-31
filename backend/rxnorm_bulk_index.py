"""
rxnorm_bulk_index.py
---------------------------------------------------------
Monthly lightweight RxNorm index builder for the RxNorm
Intelligence Explorer.

Purpose:
- Covers all RxNorm drugs at a lightweight searchable identity level.
- Avoids prewarming expensive NDC/graph/intelligence payloads for every drug.
- Keeps expensive payloads lazy + persistent for high-value or searched drugs.

Supported sources, in order:
1. Local NLM RxNorm monthly release ZIP path via RXNORM_RELEASE_ZIP_PATH
2. NLM RxNorm monthly release ZIP URL via RXNORM_RELEASE_ZIP_URL
3. RxTerms API fallback when no release file is configured

Expected persistent cache folder:
/var/data/rxnorm_cache/rxnorm_index
---------------------------------------------------------
"""

from __future__ import annotations

from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple
import csv
import hashlib
import json
import os
import re
import tempfile
import zipfile

import requests

try:
    from backend.cache_manager import calculate_current_cache_cycle
except ImportError:  # local/dev fallback
    try:
        from cache_manager import calculate_current_cache_cycle
    except ImportError:
        def calculate_current_cache_cycle(refresh_day: int = 15):
            now = datetime.now(timezone.utc)
            return {
                "cache_cycle": f"{now.year:04d}-{now.month:02d}",
                "refresh_day": refresh_day,
                "next_refresh_date_utc": None,
            }


REFRESH_DAY = int(os.getenv("MONTHLY_CACHE_REFRESH_DAY", "15"))
BASE_CACHE_DIR = Path(os.getenv("RXNORM_CACHE_DIR", "/var/data/rxnorm_cache"))
INDEX_DIR = BASE_CACHE_DIR / "rxnorm_index"
INDEX_FILE = INDEX_DIR / "rxnorm_lightweight_index.json"
INDEX_META_FILE = INDEX_DIR / "rxnorm_lightweight_index_meta.json"

RXNORM_RELEASE_ZIP_PATH = os.getenv("RXNORM_RELEASE_ZIP_PATH", "").strip()
RXNORM_RELEASE_ZIP_URL = os.getenv("RXNORM_RELEASE_ZIP_URL", "").strip()
RXTERMS_FALLBACK_URL = os.getenv(
    "RXTERMS_ALL_CONCEPTS_URL",
    "https://rxnav.nlm.nih.gov/REST/RxTerms/allconcepts.json",
)
REQUEST_TIMEOUT_SECONDS = int(os.getenv("RXNORM_INDEX_REQUEST_TIMEOUT_SECONDS", "60"))

# Drug-facing term types. This intentionally includes ingredients, brands,
# clinical drugs, branded drugs, dose-form groups, and packs.
DRUG_TTYS = {
    "IN", "MIN", "PIN",      # ingredients
    "BN",                    # brand names
    "SCD", "SBD",            # semantic clinical/branded drugs
    "SCDC", "SBDC",          # clinical/branded drug components
    "SCDF", "SBDF",          # clinical/branded drug forms
    "SCDG", "SBDG",          # clinical/branded dose-form groups
    "GPCK", "BPCK",          # generic/branded packs
}

TTY_IDENTITY_TYPES = {
    "IN": "Ingredient",
    "MIN": "Multiple Ingredient",
    "PIN": "Precise Ingredient",
    "BN": "Brand",
    "SCD": "Clinical Drug",
    "SBD": "Branded Drug",
    "SCDC": "Clinical Drug Component",
    "SBDC": "Branded Drug Component",
    "SCDF": "Clinical Drug Form",
    "SBDF": "Branded Drug Form",
    "SCDG": "Clinical Drug Group",
    "SBDG": "Branded Drug Group",
    "GPCK": "Generic Pack",
    "BPCK": "Branded Pack",
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _normalize_name(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())


def _search_key(name: str, rxcui: str = "", tty: str = "") -> str:
    return " ".join(
        part.lower()
        for part in [_normalize_name(name), str(rxcui or ""), str(tty or "")]
        if part
    )


def _safe_record(rxcui: Any, name: Any, tty: Any, source: str, code: Any = "") -> Optional[Dict[str, Any]]:
    clean_name = _normalize_name(name)
    clean_rxcui = str(rxcui or "").strip()
    clean_tty = str(tty or "").strip().upper()

    if not clean_name or not clean_rxcui:
        return None

    identity_type = TTY_IDENTITY_TYPES.get(clean_tty, "RxNorm Concept")
    return {
        "name": clean_name,
        "rxcui": clean_rxcui,
        "tty": clean_tty,
        "term_type": clean_tty,
        "identity_type": identity_type,
        "clinical_drug_identity": identity_type in {"Clinical Drug", "Branded Drug"},
        "ingredient_or_brand_identity": identity_type in {"Ingredient", "Multiple Ingredient", "Precise Ingredient", "Brand"},
        "source": source,
        "code": str(code or "").strip(),
        "search_key": _search_key(clean_name, clean_rxcui, clean_tty),
    }


def _dedupe_records(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: "OrderedDict[Tuple[str, str, str], Dict[str, Any]]" = OrderedDict()
    for record in records:
        key = (
            str(record.get("rxcui", "")),
            str(record.get("tty", "")),
            str(record.get("name", "")).lower(),
        )
        if key not in deduped:
            deduped[key] = record
    return list(deduped.values())


def _classify_counts(records: List[Dict[str, Any]]) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for record in records:
        label = record.get("identity_type") or "Unknown"
        counts[label] = counts.get(label, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: item[0]))


def _write_json_atomic(path: Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", delete=False, dir=str(path.parent), encoding="utf-8") as temp_file:
        json.dump(payload, temp_file, ensure_ascii=False, separators=(",", ":"))
        temp_name = temp_file.name
    Path(temp_name).replace(path)


def _read_json(path: Path) -> Optional[Dict[str, Any]]:
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return None


def _release_zip_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _download_release_zip(url: str) -> Path:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    target = INDEX_DIR / "rxnorm_release_download.zip"
    response = requests.get(url, timeout=REQUEST_TIMEOUT_SECONDS, stream=True)
    response.raise_for_status()
    with tempfile.NamedTemporaryFile("wb", delete=False, dir=str(INDEX_DIR)) as temp_file:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                temp_file.write(chunk)
        temp_name = temp_file.name
    Path(temp_name).replace(target)
    return target


def _find_rxnconso_member(zip_handle: zipfile.ZipFile) -> str:
    for name in zip_handle.namelist():
        if name.upper().endswith("RXNCONSO.RRF"):
            return name
    raise FileNotFoundError("RXNCONSO.RRF was not found inside the RxNorm release ZIP.")


def _build_from_rxnorm_release(zip_path: Path) -> Dict[str, Any]:
    records: List[Dict[str, Any]] = []
    rows_read = 0

    with zipfile.ZipFile(zip_path) as zip_handle:
        member = _find_rxnconso_member(zip_handle)
        with zip_handle.open(member) as raw_handle:
            text_handle = (line.decode("utf-8", errors="replace") for line in raw_handle)
            reader = csv.reader(text_handle, delimiter="|", quoting=csv.QUOTE_NONE)
            for row in reader:
                # RXNCONSO.RRF fields:
                # RXCUI|LAT|TS|LUI|STT|SUI|ISPREF|RXAUI|SAUI|SCUI|SDUI|SAB|TTY|CODE|STR|SRL|SUPPRESS|CVF|
                if len(row) < 17:
                    continue
                rows_read += 1
                rxcui = row[0]
                lat = row[1]
                sab = row[11]
                tty = row[12]
                code = row[13]
                name = row[14]
                suppress = row[16]

                if lat != "ENG":
                    continue
                if sab != "RXNORM":
                    continue
                if tty not in DRUG_TTYS:
                    continue
                if suppress not in {"N", ""}:
                    continue

                record = _safe_record(rxcui=rxcui, name=name, tty=tty, source="NLM RxNorm monthly release", code=code)
                if record:
                    records.append(record)

    final_records = _dedupe_records(records)
    return {
        "success": True,
        "source": "NLM RxNorm monthly release",
        "source_detail": str(zip_path),
        "release_zip_sha256": _release_zip_hash(zip_path),
        "rows_read": rows_read,
        "records": final_records,
    }


def _build_from_rxterms_api() -> Dict[str, Any]:
    response = requests.get(
        RXTERMS_FALLBACK_URL,
        timeout=REQUEST_TIMEOUT_SECONDS,
        headers={"User-Agent": "AlexKnowsAI-RxNormExplorer/1.0"},
    )
    response.raise_for_status()
    data = response.json()

    concepts = (
        data.get("minConceptGroup", {}).get("minConcept", [])
        or data.get("minConcept", [])
        or []
    )

    records: List[Dict[str, Any]] = []
    for item in concepts:
        rxcui = item.get("rxcui") or item.get("RXCUI")
        name = item.get("name") or item.get("fullName") or item.get("FULL_NAME")
        tty = item.get("tty") or item.get("termType") or item.get("TTY") or "RXTERM"
        record = _safe_record(rxcui=rxcui, name=name, tty=tty, source="RxTerms all concepts API fallback")
        if record:
            records.append(record)

    return {
        "success": True,
        "source": "RxTerms API fallback",
        "source_detail": RXTERMS_FALLBACK_URL,
        "records": _dedupe_records(records),
    }


def _get_configured_release_zip() -> Optional[Path]:
    if RXNORM_RELEASE_ZIP_PATH:
        path = Path(RXNORM_RELEASE_ZIP_PATH)
        if path.exists():
            return path
        raise FileNotFoundError(f"RXNORM_RELEASE_ZIP_PATH does not exist: {path}")
    if RXNORM_RELEASE_ZIP_URL:
        return _download_release_zip(RXNORM_RELEASE_ZIP_URL)
    return None


def load_rxnorm_index() -> Optional[Dict[str, Any]]:
    return _read_json(INDEX_FILE)


def get_rxnorm_index_stats() -> Dict[str, Any]:
    payload = load_rxnorm_index()
    meta = _read_json(INDEX_META_FILE) or {}
    return {
        "index_exists": bool(payload),
        "index_path": str(INDEX_FILE),
        "meta_path": str(INDEX_META_FILE),
        "cache_base_dir": str(BASE_CACHE_DIR),
        "record_count": len((payload or {}).get("records", []) or []),
        "source": (payload or {}).get("source"),
        "cache_policy": (payload or {}).get("cache_policy") or calculate_current_cache_cycle(refresh_day=REFRESH_DAY),
        "identity_type_counts": (payload or {}).get("identity_type_counts", {}),
        "created_at_utc": (payload or {}).get("created_at_utc"),
        "file_size_bytes": INDEX_FILE.stat().st_size if INDEX_FILE.exists() else 0,
        "meta": meta,
    }


def build_or_refresh_rxnorm_index(force: bool = False) -> Dict[str, Any]:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    cache_policy = calculate_current_cache_cycle(refresh_day=REFRESH_DAY)
    current_cycle = cache_policy.get("cache_cycle")

    existing = load_rxnorm_index()
    if not force and existing and existing.get("cache_policy", {}).get("cache_cycle") == current_cycle:
        return {
            "success": True,
            "status": "already_current",
            "message": "RxNorm lightweight index is already current for this monthly cache cycle.",
            "cache_policy": cache_policy,
            "record_count": len(existing.get("records", []) or []),
            "source": existing.get("source"),
            "index_path": str(INDEX_FILE),
        }

    release_zip = _get_configured_release_zip()
    if release_zip:
        build_result = _build_from_rxnorm_release(release_zip)
    else:
        build_result = _build_from_rxterms_api()

    records = build_result.pop("records", [])
    payload = {
        "success": True,
        "status": "built",
        "message": "RxNorm lightweight searchable index built successfully.",
        "created_at_utc": _utc_now_iso(),
        "cache_policy": cache_policy,
        "record_count": len(records),
        "identity_type_counts": _classify_counts(records),
        "records": records,
        **build_result,
    }

    _write_json_atomic(INDEX_FILE, payload)
    _write_json_atomic(INDEX_META_FILE, {k: v for k, v in payload.items() if k != "records"})
    return {k: v for k, v in payload.items() if k != "records"}


def search_rxnorm_index(query: str, limit: int = 8) -> Dict[str, Any]:
    clean_query = _normalize_name(query).lower()
    safe_limit = max(1, min(int(limit or 8), 25))
    payload = load_rxnorm_index()

    if not payload or not payload.get("records"):
        return {
            "success": False,
            "query": query,
            "suggestions": [],
            "message": "RxNorm lightweight index is not built yet.",
        }

    if len(clean_query) < 2:
        return {
            "success": True,
            "query": query,
            "suggestions": [],
            "message": "Enter at least 2 characters.",
            "served_from_rxnorm_index": True,
        }

    exact_prefix: List[Dict[str, Any]] = []
    contains: List[Dict[str, Any]] = []
    rxcui_matches: List[Dict[str, Any]] = []

    for record in payload.get("records", []):
        name = str(record.get("name", ""))
        search_key = str(record.get("search_key", ""))
        rxcui = str(record.get("rxcui", ""))
        if name.lower().startswith(clean_query):
            exact_prefix.append(record)
        elif clean_query in search_key:
            contains.append(record)
        elif clean_query in rxcui:
            rxcui_matches.append(record)

        if len(exact_prefix) >= safe_limit and len(contains) >= safe_limit:
            break

    ranked = _dedupe_records(exact_prefix + contains + rxcui_matches)[:safe_limit]
    return {
        "success": True,
        "query": query,
        "suggestions": ranked,
        "count": len(ranked),
        "served_from_rxnorm_index": True,
        "index_record_count": payload.get("record_count"),
        "cache_policy": payload.get("cache_policy"),
    }

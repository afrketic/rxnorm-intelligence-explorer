"""
trending_drugs.py
---------------------------------------------------------
Dynamic popular medication search support for the RxNorm
Intelligence Explorer.

Primary source:
- CMS Medicare Part D Prescribers - by Provider and Drug
- Latest CMS Data API dataset ID is maintained here as a single constant
- Metric: total claim count / prescription-fill volume equivalent

Design:
- Uses CMS data when available
- Caches results for roughly one month
- Falls back to a stable high-volume medication list if CMS is unavailable
---------------------------------------------------------
"""

from __future__ import annotations

from datetime import datetime, timezone
import os
import time
from typing import Any, Dict, List, Optional

import requests


CMS_PART_D_DATASET_ID = os.getenv(
    "CMS_PART_D_DATASET_ID",
    "9552739e-3d05-4c1b-8eff-ecabf391e2e5"
)

CMS_PART_D_DATA_API_URL = (
    f"https://data.cms.gov/data-api/v1/dataset/{CMS_PART_D_DATASET_ID}/data"
)

REQUEST_TIMEOUT_SECONDS = int(os.getenv("CMS_PART_D_TIMEOUT_SECONDS", "25"))
CACHE_TTL_SECONDS = int(os.getenv("TRENDING_DRUGS_CACHE_TTL_SECONDS", str(60 * 60 * 24 * 30)))
CMS_PAGE_SIZE = int(os.getenv("CMS_PART_D_PAGE_SIZE", "5000"))
CMS_MAX_PAGES = int(os.getenv("CMS_PART_D_MAX_PAGES", "3"))

FALLBACK_DRUGS = [
    "Atorvastatin",
    "Levothyroxine",
    "Metformin",
    "Lisinopril",
    "Amlodipine",
]

_CACHE: Dict[str, Any] = {
    "expires_at": 0,
    "payload": None,
}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _safe_int(value: Any) -> int:
    if value is None:
        return 0

    try:
        return int(float(str(value).replace(",", "").strip()))
    except (TypeError, ValueError):
        return 0


def _get_case_insensitive(record: Dict[str, Any], candidate_keys: List[str]) -> Optional[Any]:
    if not record:
        return None

    lower_map = {str(key).lower(): value for key, value in record.items()}

    for key in candidate_keys:
        value = lower_map.get(key.lower())
        if value not in (None, ""):
            return value

    return None


def _extract_drug_name(record: Dict[str, Any]) -> str:
    generic_name = _get_case_insensitive(
        record,
        [
            "Gnrc_Name",
            "gnrc_name",
            "generic_name",
            "drug_generic_name",
        ],
    )

    brand_name = _get_case_insensitive(
        record,
        [
            "Brnd_Name",
            "brnd_name",
            "brand_name",
            "drug_brand_name",
        ],
    )

    selected_name = generic_name or brand_name or ""
    return str(selected_name).strip().title()


def _extract_claim_count(record: Dict[str, Any]) -> int:
    claim_count = _get_case_insensitive(
        record,
        [
            "Tot_Clms",
            "tot_clms",
            "total_claim_count",
            "total_claims",
            "claim_count",
        ],
    )
    return _safe_int(claim_count)


def _fetch_cms_rows() -> List[Dict[str, Any]]:
    """
    Pulls a bounded set of high-claim CMS Part D provider/drug rows.

    CMS publishes this dataset at provider + drug grain. The endpoint below is
    intentionally bounded and cached because the complete annual dataset is very
    large. The app aggregates the returned records by generic drug name and uses
    the fallback list if CMS is unavailable.
    """

    rows: List[Dict[str, Any]] = []

    for page in range(max(1, CMS_MAX_PAGES)):
        params = {
            "size": CMS_PAGE_SIZE,
            "offset": page * CMS_PAGE_SIZE,
        }

        response = requests.get(
            CMS_PART_D_DATA_API_URL,
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
            headers={"User-Agent": "AlexKnowsAI-RxNormExplorer/1.0"},
        )
        response.raise_for_status()

        data = response.json()

        if isinstance(data, list):
            page_rows = data
        elif isinstance(data, dict):
            page_rows = data.get("data") or data.get("results") or []
        else:
            page_rows = []

        if not page_rows:
            break

        rows.extend(page_rows)

        if len(page_rows) < CMS_PAGE_SIZE:
            break

    return rows


def _aggregate_top_drugs(rows: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    totals: Dict[str, int] = {}

    for record in rows:
        drug_name = _extract_drug_name(record)
        claim_count = _extract_claim_count(record)

        if not drug_name or claim_count <= 0:
            continue

        totals[drug_name] = totals.get(drug_name, 0) + claim_count

    ranked = sorted(totals.items(), key=lambda item: item[1], reverse=True)[:limit]

    return [
        {
            "rank": index + 1,
            "drug_name": drug_name,
            "total_claim_count": claim_count,
        }
        for index, (drug_name, claim_count) in enumerate(ranked)
    ]


def _fallback_payload(limit: int, reason: str) -> Dict[str, Any]:
    safe_limit = max(1, min(int(limit or 5), 10))
    return {
        "success": False,
        "used_fallback": True,
        "display_label": "Popular Medication Searches",
        "source": "Fallback medication list",
        "source_url": "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
        "metric": "Fallback list; CMS Medicare Part D claim-volume API unavailable",
        "dataset_period": "Fallback",
        "last_refreshed_utc": _utc_now_iso(),
        "message": reason,
        "trending_drugs": [
            {
                "rank": index + 1,
                "drug_name": name,
                "total_claim_count": None,
            }
            for index, name in enumerate(FALLBACK_DRUGS[:safe_limit])
        ],
    }


def get_trending_drugs(limit: int = 5) -> Dict[str, Any]:
    """
    Returns the top popular medication search buttons for the dashboard.

    The dashboard treats these as "Popular Medication Searches" rather than a
    definitive national top-drug ranking because the public CMS dataset is Part D
    Medicare-specific and organized at provider + drug grain.
    """

    safe_limit = max(1, min(int(limit or 5), 10))
    now = time.time()

    cached_payload = _CACHE.get("payload")
    if cached_payload and now < _CACHE.get("expires_at", 0):
        payload = dict(cached_payload)
        payload["trending_drugs"] = payload.get("trending_drugs", [])[:safe_limit]
        payload["served_from_cache"] = True
        return payload

    try:
        rows = _fetch_cms_rows()
        ranked_drugs = _aggregate_top_drugs(rows, safe_limit)

        if not ranked_drugs:
            return _fallback_payload(safe_limit, "CMS returned data, but no usable claim-count rows were available.")

        payload = {
            "success": True,
            "used_fallback": False,
            "served_from_cache": False,
            "display_label": "Popular Medication Searches",
            "source": "CMS Medicare Part D Prescribers - by Provider and Drug",
            "source_url": "https://data.cms.gov/provider-summary-by-type-of-service/medicare-part-d-prescribers/medicare-part-d-prescribers-by-provider-and-drug",
            "metric": "Total claim count / prescription-fill volume equivalent",
            "dataset_period": "Latest available CMS Medicare Part D annual dataset",
            "last_refreshed_utc": _utc_now_iso(),
            "data_note": (
                "CMS Part D data is Medicare-specific and provider/drug-grain. "
                "The dashboard aggregates returned CMS rows by generic drug name and falls back safely if the CMS API is unavailable."
            ),
            "trending_drugs": ranked_drugs,
        }

        _CACHE["payload"] = payload
        _CACHE["expires_at"] = now + CACHE_TTL_SECONDS

        return payload

    except Exception as exc:
        return _fallback_payload(safe_limit, f"CMS Part D trend lookup failed: {exc}")

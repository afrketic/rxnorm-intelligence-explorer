"""
Release Candidate QA Script — RxNorm Intelligence Platform

Tests the key Sprint 17A–26B release endpoints for:
    - Semaglutide
    - Prednisolone
    - Dexamethasone
    - Ketoconazole
    - One low-scoring drug discovered from /explorer/bottom

Run while backend is live:
    python scripts/release_candidate_endpoint_qa.py --base-url http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any, Dict, List

import urllib.error
import urllib.parse
import urllib.request


TEST_DRUGS = {
    "semaglutide": "1991302",
    "prednisolone": "8638",
    "dexamethasone": "3264",
    "ketoconazole": "6135",
}

ENDPOINTS = [
    "/explorer/drug-detail/{rxcui}",
    "/readiness/{rxcui}",
    "/confidence/{rxcui}",
    "/pca/{rxcui}",
    "/methodology/{rxcui}",
    "/predictive/{rxcui}",
    "/production-candidates/{rxcui}",
    "/executive/{rxcui}",
    "/explainability/{rxcui}",
    "/recommendations/{rxcui}",
    "/opportunities/{rxcui}",
    "/portfolio-optimization/{rxcui}",
    "/copilot/{rxcui}",
    "/deployment/{rxcui}",
    "/website-demo/assets/{rxcui}",
    "/production-hardening/{rxcui}",
    "/validation/{rxcui}",
    "/methodology-selection/{rxcui}",
    "/publication-validation/{rxcui}",
    "/scientific-benchmark/{rxcui}",
]

GLOBAL_ENDPOINTS = [
    "/executive/leaderboards",
    "/publication-validation/top?limit=5",
    "/scientific-benchmark/top?limit=5",
    "/white-paper/metrics",
]


def get_json(url: str, timeout: int = 20) -> tuple[int, Any, str | None]:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            raw = response.read().decode("utf-8")
            return response.status, json.loads(raw), None
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return exc.code, None, body[:500]
    except Exception as exc:
        return 0, None, str(exc)


def discover_low_scoring_drug(base_url: str) -> tuple[str, str] | None:
    url = f"{base_url.rstrip('/')}/explorer/bottom?limit=1"
    status, payload, error = get_json(url)
    if status != 200 or not isinstance(payload, list) or not payload:
        print(f"WARNING: Unable to discover low-scoring drug from /explorer/bottom: {status} {error}")
        return None

    row = payload[0]
    rxcui = str(row.get("rxcui") or "").strip()
    name = str(row.get("display_name") or row.get("rxnorm_name") or row.get("name") or "low_scoring_drug")
    if not rxcui:
        return None
    return name, rxcui


def test_endpoint(base_url: str, endpoint: str, rxcui: str | None = None) -> Dict[str, Any]:
    path = endpoint.format(rxcui=urllib.parse.quote(str(rxcui))) if rxcui else endpoint
    url = f"{base_url.rstrip('/')}{path}"
    start = time.time()
    status, payload, error = get_json(url)
    elapsed_ms = round((time.time() - start) * 1000, 1)

    ok = status == 200 and payload is not None

    return {
        "endpoint": path,
        "status": status,
        "ok": ok,
        "elapsed_ms": elapsed_ms,
        "error": error,
        "payload_type": type(payload).__name__ if payload is not None else None,
    }


def run_qa(base_url: str) -> int:
    drugs = dict(TEST_DRUGS)
    low = discover_low_scoring_drug(base_url)
    if low:
        name, rxcui = low
        drugs[f"low_scoring__{name}"] = rxcui

    failures: List[Dict[str, Any]] = []

    print("\nRelease Candidate Endpoint QA")
    print("============================")
    print(f"Base URL: {base_url}")
    print(f"Drug count: {len(drugs)}")
    print(f"Endpoint count per drug: {len(ENDPOINTS)}")
    print("")

    for name, rxcui in drugs.items():
        print(f"\nTesting {name} ({rxcui})")
        print("-" * 80)

        for endpoint in ENDPOINTS:
            result = test_endpoint(base_url, endpoint, rxcui)
            marker = "PASS" if result["ok"] else "FAIL"
            print(f"{marker:4} {result['status']:>3} {result['elapsed_ms']:>7} ms  {result['endpoint']}")
            if not result["ok"]:
                failures.append({"drug": name, "rxcui": rxcui, **result})

    print("\nTesting global endpoints")
    print("-" * 80)
    for endpoint in GLOBAL_ENDPOINTS:
        result = test_endpoint(base_url, endpoint)
        marker = "PASS" if result["ok"] else "FAIL"
        print(f"{marker:4} {result['status']:>3} {result['elapsed_ms']:>7} ms  {result['endpoint']}")
        if not result["ok"]:
            failures.append({"drug": "GLOBAL", "rxcui": None, **result})

    print("\nSummary")
    print("=======")
    if failures:
        print(f"FAILURES: {len(failures)}")
        for failure in failures[:25]:
            print(json.dumps(failure, indent=2))
        return 1

    print("All release candidate endpoints passed.")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run RxNorm release candidate endpoint QA.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sys.exit(run_qa(args.base_url))


if __name__ == "__main__":
    main()

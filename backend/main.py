from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import math
import html
import re
from copy import deepcopy
from datetime import datetime, timezone

from app.rxnorm_client import (
    get_full_application_payload,
    get_therapeutic_class_explorer_package,
    get_ndc_crosswalk,
)


try:
    from backend.cache_manager import (
        get_cached_or_build,
        calculate_current_cache_cycle,
        read_status,
        write_status,
        get_cache_summary,
        utc_now_iso,
    )
except ImportError:
    from cache_manager import (
        get_cached_or_build,
        calculate_current_cache_cycle,
        read_status,
        write_status,
        get_cache_summary,
        utc_now_iso,
    )

try:
    from backend.trending_drugs import get_trending_drugs
except ImportError:
    try:
        from app.trending_drugs import get_trending_drugs
    except ImportError:
        def get_trending_drugs(limit: int = 5, use_memory_cache: bool = True):
            fallback = ["Atorvastatin", "Levothyroxine", "Metformin", "Lisinopril", "Amlodipine"]
            return {
                "success": False,
                "used_fallback": True,
                "display_label": "Popular Medication Searches",
                "source": "Fallback list",
                "metric": "Fallback",
                "dataset_period": "Unavailable",
                "trending_drugs": [
                    {"rank": i + 1, "drug_name": name, "total_claim_count": None}
                    for i, name in enumerate(fallback[:limit])
                ],
            }

try:
    from app.rxnorm_client import get_drug_name_suggestions
except ImportError:
    def get_drug_name_suggestions(query: str, max_results: int = 8):
        return {
            "success": False,
            "query": query,
            "suggestions": [],
            "message": "Autocomplete helper is unavailable in rxnorm_client.py."
        }


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def home():
    return {"message": "RxNorm Intelligence Explorer API Running"}



# =========================================================
# MONTHLY CACHE LAYER
# =========================================================

MONTHLY_CACHE_REFRESH_DAY = 15


def _cache_key(*parts):
    return "::".join(str(part).strip().lower() for part in parts if part is not None)


def _monthly_cache_metadata():
    return calculate_current_cache_cycle(refresh_day=MONTHLY_CACHE_REFRESH_DAY)


def _build_light_application_payload(drug_name: str):
    """
    Builds the first-load dashboard payload without constructing the expensive
    NDC crosswalk or graph payload. NDC and graph are lazy-loaded by their tabs.
    
    This payload is cached on the monthly source-data cycle.
    """

    package = get_therapeutic_class_explorer_package(drug_name)

    if not package.get("success"):
        return {
            "app_name": "RxNorm Intelligence Explorer",
            "subtitle": "Visualizing how medication data becomes standardized, interoperable, and AI-ready.",
            "success": False,
            "search": {
                "success": False,
                "search_term": drug_name,
                "primary_rxcui": "",
                "match_status": "Not Found",
                "message": package.get("message", "Medication lookup failed."),
                "source": "RxNorm / RxNav API",
            },
            "identity_card": {
                "card_title": "Medication Identity",
                "success": False,
                "search_term": drug_name,
                "primary_rxcui": "",
                "concept_name": "",
                "term_type": "",
                "term_type_description": "",
                "source": "RxNorm / RxNav API",
            },
            "related_concepts": {
                "section_title": "Related RxNorm Concepts",
                "success": False,
                "search_term": drug_name,
                "primary_rxcui": "",
                "related_concepts_count": 0,
                "related_concepts": [],
                "grouped_related_concepts": {},
                "source": "RxNorm / RxNav API",
            },
            "therapeutic_classes": {
                "section_title": "Therapeutic Class Explorer",
                "success": False,
                "search_term": drug_name,
                "primary_rxcui": "",
                "rxclass_count": 0,
                "atc_count": 0,
                "rxclass_records": [],
                "atc_records": [],
                "atc_hierarchy": [],
                "source": "RxClass / RxNav API",
            },
            "ndc_crosswalk": {
                "section_title": "NDC Crosswalk Intelligence",
                "success": False,
                "lazy_loaded": False,
                "ndc_count": None,
                "summary": {},
                "ndc_records": [],
                "message": "NDC records load when the NDC Intelligence tab is opened.",
            },
        }

    identity = package.get("identity", {})
    therapeutic = package.get("therapeutic_class_explorer", {})

    return {
        "app_name": "RxNorm Intelligence Explorer",
        "subtitle": "Visualizing how medication data becomes standardized, interoperable, and AI-ready.",
        "success": True,
        "lazy_payload": True,
        "monthly_cache_policy": _monthly_cache_metadata(),
        "search": {
            "success": identity.get("success", False),
            "search_term": identity.get("search_term", drug_name),
            "primary_rxcui": identity.get("primary_rxcui", ""),
            "match_status": identity.get("match_status", ""),
            "message": identity.get("message", ""),
            "source": "RxNorm / RxNav API",
        },
        "identity_card": {
            "card_title": "Medication Identity",
            "success": identity.get("success", False),
            "search_term": identity.get("search_term", drug_name),
            "primary_rxcui": identity.get("primary_rxcui", ""),
            "concept_name": identity.get("concept_name", ""),
            "term_type": identity.get("term_type", ""),
            "term_type_description": identity.get("term_type_description", ""),
            "synonym": identity.get("synonym", ""),
            "language": identity.get("language", ""),
            "suppress": identity.get("suppress", ""),
            "source_vocabulary": identity.get("source_vocabulary", "RXNORM"),
            "source": identity.get("source", "RxNorm / RxNav API"),
        },
        "related_concepts": {
            "section_title": "Related RxNorm Concepts",
            "success": package.get("success", False),
            "search_term": package.get("search_term", drug_name),
            "primary_rxcui": package.get("primary_rxcui", ""),
            "related_concepts_count": package.get("related_concepts_count", 0),
            "related_concepts": package.get("related_concepts", []),
            "grouped_related_concepts": package.get("grouped_related_concepts", {}),
            "source": "RxNorm / RxNav API",
        },
        "therapeutic_classes": {
            "section_title": "Therapeutic Class Explorer",
            "success": therapeutic.get("success", False),
            "search_term": package.get("search_term", drug_name),
            "primary_rxcui": package.get("primary_rxcui", ""),
            "rxclass_count": therapeutic.get("rxclass_count", 0),
            "atc_count": therapeutic.get("atc_count", 0),
            "rxclass_records": therapeutic.get("rxclass_records", []),
            "atc_records": therapeutic.get("atc_records", []),
            "atc_hierarchy": therapeutic.get("atc_hierarchy", []),
            "source": therapeutic.get("source", "RxClass / RxNav API"),
        },
        "ndc_crosswalk": {
            "section_title": "NDC Crosswalk Intelligence",
            "success": False,
            "lazy_loaded": False,
            "ndc_count": None,
            "summary": {},
            "ndc_records": [],
            "claims_intelligence_note": "NDC records load when the NDC Intelligence tab is opened.",
            "source": "RxNorm / RxNav API",
        },
        "interoperability_graph": {
            "lazy_loaded": False,
            "message": "Graph payload loads when the Knowledge Graph tab is opened.",
        },
    }


def _get_full_payload_cached(drug_name: str):
    key = _cache_key("full", drug_name)
    return get_cached_or_build(
        category="drug_payloads",
        key=key,
        builder=lambda: get_full_application_payload(drug_name),
        refresh_day=MONTHLY_CACHE_REFRESH_DAY,
    )


@app.get("/drug/{drug_name}")
def get_drug_intelligence(drug_name: str):
    key = _cache_key("light", drug_name)
    return get_cached_or_build(
        category="drug_payloads",
        key=key,
        builder=lambda: _build_light_application_payload(drug_name),
        refresh_day=MONTHLY_CACHE_REFRESH_DAY,
    )


@app.get("/ndc/{drug_name}")
def get_drug_ndc_intelligence(drug_name: str, limit: int = 50):
    safe_limit = max(1, min(int(limit or 50), 250))
    key = _cache_key("ndc", drug_name)

    payload = get_cached_or_build(
        category="ndc_payloads",
        key=key,
        builder=lambda: get_ndc_crosswalk(drug_name),
        refresh_day=MONTHLY_CACHE_REFRESH_DAY,
    )

    payload = deepcopy(payload)
    payload["lazy_loaded"] = True
    payload["render_limit"] = safe_limit
    full_records = payload.get("ndc_records", []) or []
    payload["ndc_count"] = payload.get("ndc_count", len(full_records))
    payload["ndc_records"] = full_records[:safe_limit]
    return payload


@app.get("/suggest/{query}")
def suggest_drug_names(query: str, max_results: int = 8):
    return get_drug_name_suggestions(query, max_results=max_results)


@app.get("/trending-drugs")
def trending_drugs(limit: int = 5):
    safe_limit = max(1, min(int(limit or 5), 10))
    key = _cache_key("cms-part-d", safe_limit)
    return get_cached_or_build(
        category="trending",
        key=key,
        builder=lambda: get_trending_drugs(limit=safe_limit, use_memory_cache=False),
        refresh_day=MONTHLY_CACHE_REFRESH_DAY,
    )


# =========================================================
# MONTHLY CACHE PREWARM ENDPOINT
# =========================================================

PREWARM_DEFAULT_DRUGS = [
    "Atorvastatin",
    "Levothyroxine",
    "Metformin",
    "Lisinopril",
    "Amlodipine",
    "Semaglutide",
    "Ozempic",
    "Humira",
    "Eliquis",
]


def _prewarm_one_drug(drug_name: str, ndc_limit: int = 50, max_detail_nodes: int = 4):
    """
    Builds the monthly cache entries for one medication.

    This intentionally calls the public endpoint handlers so the same cache
    keys, monthly cache cycle, lazy-loading behavior, and stale-fallback logic
    are used by normal dashboard traffic and scheduled prewarming.
    """

    result = {
        "drug_name": drug_name,
        "drug_payload": "not_started",
        "ndc_payload": "not_started",
        "graph_payload": "not_started",
        "errors": [],
    }

    try:
        get_drug_intelligence(drug_name)
        result["drug_payload"] = "warmed"
    except Exception as exc:
        result["drug_payload"] = "failed"
        result["errors"].append(f"drug_payload: {exc}")

    try:
        get_drug_ndc_intelligence(drug_name, limit=ndc_limit)
        result["ndc_payload"] = "warmed"
    except Exception as exc:
        result["ndc_payload"] = "failed"
        result["errors"].append(f"ndc_payload: {exc}")

    try:
        get_drug_graph(drug_name, max_detail_nodes=max_detail_nodes)
        result["graph_payload"] = "warmed"
    except Exception as exc:
        result["graph_payload"] = "failed"
        result["errors"].append(f"graph_payload: {exc}")

    result["success"] = len(result["errors"]) == 0
    return result


PREWARM_STATUS_KEY = "prewarm_status"
PREWARM_STALE_MINUTES = 90


def _default_prewarm_status():
    return {
        "status": "idle",
        "message": "Cache prewarm has not started yet.",
        "last_result": None,
        "cache_policy": _monthly_cache_metadata(),
    }


def _load_prewarm_status():
    return read_status(PREWARM_STATUS_KEY) or _default_prewarm_status()


def _persist_prewarm_status(**updates):
    current = _load_prewarm_status()
    current.update(updates)
    current.setdefault("cache_policy", _monthly_cache_metadata())
    return write_status(PREWARM_STATUS_KEY, current)


def _is_stale_running_status(status_payload):
    if status_payload.get("status") not in {"running", "started", "already_running"}:
        return False

    updated_at = status_payload.get("status_updated_at_utc") or status_payload.get("started_at_utc")
    if not updated_at:
        return True

    try:
        parsed = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
        age_seconds = (datetime.now(timezone.utc) - parsed).total_seconds()
        return age_seconds > PREWARM_STALE_MINUTES * 60
    except Exception:
        return True


CACHE_PREWARM_STATUS = _load_prewarm_status()


def _run_cache_prewarm_sync(limit: int = 5, ndc_limit: int = 50, max_detail_nodes: int = 4):
    """
    Synchronous worker used by the background prewarm endpoint.

    This performs the expensive CMS/RxNorm/RxClass/NDC warming work outside
    the HTTP response path so Render Cron receives a fast 200 response instead
    of waiting on many external API calls.
    """

    CACHE_PREWARM_STATUS.update(_persist_prewarm_status(
        status="running",
        message="Monthly cache prewarm is running in the background.",
        started_at_utc=utc_now_iso(),
        last_result=None,
        current_drug=None,
        drug_results_so_far=[],
        errors=[],
    ))

    safe_limit = max(1, min(int(limit or 5), 10))
    safe_ndc_limit = max(1, min(int(ndc_limit or 50), 250))
    safe_detail_limit = max(2, min(int(max_detail_nodes or 4), 8))
    cache_cycle = _monthly_cache_metadata()

    trending_result = None
    trending_drug_names = []
    errors = []

    try:
        print("[CACHE PREWARM] Warming CMS trending drugs...")
        trending_result = trending_drugs(limit=safe_limit)
        for item in trending_result.get("trending_drugs", []) or []:
            drug_name = str(item.get("drug_name", "")).strip()
            if drug_name:
                trending_drug_names.append(drug_name)
    except Exception as exc:
        errors.append(f"trending_drugs: {exc}")

    prewarm_drugs = []
    seen = set()

    for name in trending_drug_names + PREWARM_DEFAULT_DRUGS:
        cleaned = str(name or "").strip()
        key = cleaned.lower()
        if cleaned and key not in seen:
            seen.add(key)
            prewarm_drugs.append(cleaned)

    drug_results = []
    for name in prewarm_drugs:
        print(f"[CACHE PREWARM] Warming {name}...")
        CACHE_PREWARM_STATUS.update(_persist_prewarm_status(
            status="running",
            message=f"Monthly cache prewarm is warming {name}.",
            current_drug=name,
            drug_results_so_far=drug_results,
            errors=errors,
        ))
        drug_results.append(
            _prewarm_one_drug(
                drug_name=name,
                ndc_limit=safe_ndc_limit,
                max_detail_nodes=safe_detail_limit,
            )
        )
        CACHE_PREWARM_STATUS.update(_persist_prewarm_status(
            status="running",
            message=f"Monthly cache prewarm completed {name}.",
            current_drug=name,
            drug_results_so_far=drug_results,
            errors=errors,
        ))

    warmed_successfully = sum(1 for item in drug_results if item.get("success"))
    failed = [item for item in drug_results if not item.get("success")]

    result = {
        "success": len(errors) == 0 and len(failed) == 0,
        "status": "completed",
        "message": "Monthly cache prewarm completed.",
        "cache_policy": cache_cycle,
        "refresh_day": MONTHLY_CACHE_REFRESH_DAY,
        "trending_source_status": "warmed" if trending_result else "failed",
        "trending_result": trending_result,
        "drugs_requested": len(prewarm_drugs),
        "drugs_warmed_successfully": warmed_successfully,
        "drugs_failed": len(failed),
        "drug_results": drug_results,
        "errors": errors,
    }

    CACHE_PREWARM_STATUS.update(_persist_prewarm_status(
        status="completed" if result.get("success") else "completed_with_errors",
        message=result.get("message", "Monthly cache prewarm finished."),
        completed_at_utc=utc_now_iso(),
        current_drug=None,
        drug_results_so_far=drug_results,
        last_result=result,
        errors=errors,
    ))

    print("[CACHE PREWARM] Completed.")
    return result


@app.post("/cache/prewarm")
def prewarm_cache(background_tasks: BackgroundTasks, limit: int = 5, ndc_limit: int = 50, max_detail_nodes: int = 4):
    """
    Starts monthly cache prewarming in the background for Render Cron Jobs.

    Intended cron command:
    curl -X POST https://<render-backend-url>/cache/prewarm

    This returns immediately so Render Cron does not hang while CMS/RxNorm,
    RxClass, NDC, graph, and dashboard caches are being rebuilt.
    """

    current_status = _load_prewarm_status()
    if current_status.get("status") in {"running", "started"} and not _is_stale_running_status(current_status):
        return {
            "success": True,
            "status": "already_running",
            "message": "Cache prewarm is already running in the background.",
            "cache_policy": _monthly_cache_metadata(),
            "prewarm_status": current_status,
        }

    if _is_stale_running_status(current_status):
        _persist_prewarm_status(
            status="interrupted",
            message="Previous cache prewarm appeared stale or was interrupted by a restart; starting a new run.",
            interrupted_at_utc=utc_now_iso(),
            previous_status=current_status,
        )

    background_tasks.add_task(
        _run_cache_prewarm_sync,
        limit=limit,
        ndc_limit=ndc_limit,
        max_detail_nodes=max_detail_nodes,
    )

    CACHE_PREWARM_STATUS.update(_persist_prewarm_status(
        status="started",
        message="Cache prewarm was accepted and will run in the background.",
        accepted_at_utc=utc_now_iso(),
        last_result=None,
    ))

    return {
        "success": True,
        "status": "started",
        "message": "Cache prewarm accepted. Background warming has started.",
        "cache_policy": _monthly_cache_metadata(),
        "refresh_day": MONTHLY_CACHE_REFRESH_DAY,
    }


@app.get("/cache/prewarm/status")
def get_cache_prewarm_status():
    """Returns the latest persistent cache prewarm status for quick diagnostics."""
    status_payload = _load_prewarm_status()
    if _is_stale_running_status(status_payload):
        status_payload = _persist_prewarm_status(
            status="interrupted",
            message="Previous cache prewarm appears stale or was interrupted by a restart.",
            interrupted_at_utc=utc_now_iso(),
            previous_status=status_payload,
        )
    CACHE_PREWARM_STATUS.update(status_payload)
    return status_payload


@app.get("/cache/stats")
def get_cache_stats():
    """Returns disk-backed cache folder counts and storage diagnostics."""
    return get_cache_summary()


@app.post("/cache/prewarm/sync")
def prewarm_cache_sync(limit: int = 5, ndc_limit: int = 50, max_detail_nodes: int = 4):
    """Manual synchronous prewarm endpoint for local debugging only."""
    return _run_cache_prewarm_sync(limit=limit, ndc_limit=ndc_limit, max_detail_nodes=max_detail_nodes)


def _clean_tooltip_text(value):
    """
    Normalizes all graph tooltip text globally.

    This prevents raw HTML line-break strings such as <br> from appearing
    inside hover popups and converts them into real newline-separated text.
    """
    if value is None:
        return ""

    cleaned = html.unescape(str(value)).strip()
    cleaned = re.sub(r"<\s*br\s*/?\s*>", "\n", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s*\n\s*", "\n", cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)

    lines = [line.strip() for line in cleaned.split("\n") if line.strip()]
    return "\n".join(lines)


def _format_tooltip(*parts):
    lines = []
    for part in parts:
        cleaned = _clean_tooltip_text(part)
        if cleaned:
            lines.extend([line for line in cleaned.split("\n") if line.strip()])
    compact = "\n".join(lines[:6])
    return compact[:450]


def _fixed_node(node_id, label, group, title, x, y, size=24, role="detail"):
    return {
        "id": node_id,
        "label": label,
        "group": group,
        "title": _format_tooltip(title),
        "x": x,
        "y": y,
        "fixed": {"x": True, "y": True},
        "size": size,
        "layout_role": role,
    }


def _detail_node(node_id, display_text, group, description, x, y, size=18):
    """
    Creates an outer-ring detail node with no persistent visible label.
    Detail text is preserved in hover metadata to reduce graph clutter.
    """
    display_text = str(display_text or "").strip()
    description = str(description or "").strip()
    title = _format_tooltip(display_text, description) or "Related detail"

    node = _fixed_node(
        node_id=node_id,
        label="",
        group=group,
        title=title,
        x=x,
        y=y,
        size=size,
        role="detail",
    )
    node["hover_label"] = _format_tooltip(display_text)
    return node


def _edge(source, target, label, relationship_type=None, primary=False):
    relationship = _format_tooltip(relationship_type or label.title())
    clean_label = _format_tooltip(label)
    return {
        "from": source,
        "to": target,
        "label": clean_label,
        "title": _format_tooltip("Relationship Type:", relationship),
        "relationship_type": relationship,
        "show_label": False,
        "dashes": False if primary else [8, 7],
        "edge_role": "primary" if primary else "related",
    }


def _unique_by_key(records, key_name, limit):
    seen = set()
    output = []
    for record in records:
        value = str(record.get(key_name, "")).strip()
        if value and value not in seen:
            seen.add(value)
            output.append(record)
        if len(output) >= limit:
            break
    return output


def _radial_child_positions(cx, cy, radius, outward_deg, count, span_deg=120):
    """
    Places detail nodes evenly along the outer circumference of a category hub.
    """
    if count <= 0:
        return []

    if count == 1:
        angles = [outward_deg]
    else:
        start_deg = outward_deg - (span_deg / 2)
        step = span_deg / (count - 1)
        angles = [start_deg + i * step for i in range(count)]

    coords = []
    for angle in angles:
        radians = math.radians(angle)
        coords.append((
            round(cx + radius * math.cos(radians)),
            round(cy + radius * math.sin(radians))
        ))

    return coords


def _point_on_circle(cx, cy, radius, angle_deg):
    """Returns a fixed x/y coordinate on a concentric graph ring."""
    radians = math.radians(angle_deg)
    return (
        round(cx + radius * math.cos(radians)),
        round(cy + radius * math.sin(radians))
    )


def _short_node_label(value, max_chars=16):
    """Keeps visible circle labels compact while preserving full text in tooltips/details."""
    value = str(value or "").strip()
    if len(value) <= max_chars:
        return value
    return value[: max_chars - 1].rstrip() + "…"


def _normalize_graph_payload(nodes, edges):
    """
    Final graph-wide formatting pass.

    Applies graph behavior globally:
    - center searched drug remains a static separate layer,
    - detail/outer-ring labels stay hidden until hover,
    - tooltips use real line breaks,
    - edge labels stay hidden by default.
    """
    normalized_nodes = []

    for node in nodes:
        clean_node = dict(node)
        clean_node["title"] = _format_tooltip(clean_node.get("title", ""))

        if clean_node.get("layout_role") == "detail":
            visible_label = _format_tooltip(
                clean_node.get("hover_label")
                or clean_node.get("label")
                or clean_node.get("title")
            )
            clean_node["hover_label"] = visible_label
            clean_node["label"] = ""
            if not clean_node.get("title"):
                clean_node["title"] = visible_label

        normalized_nodes.append(clean_node)

    normalized_edges = []

    for edge in edges:
        clean_edge = dict(edge)
        relationship = _format_tooltip(
            clean_edge.get("relationship_type")
            or clean_edge.get("label")
            or "Relationship"
        )
        clean_edge["relationship_type"] = relationship
        clean_edge["title"] = _format_tooltip(
            clean_edge.get("title") or "Relationship Type:",
            relationship
        )
        clean_edge["label"] = _format_tooltip(clean_edge.get("label", ""))
        clean_edge["show_label"] = False
        normalized_edges.append(clean_edge)

    return normalized_nodes, normalized_edges


@app.get("/graph/{drug_name}")
def get_drug_graph(drug_name: str, max_detail_nodes: int = 4):
    safe_detail_limit = max(2, min(int(max_detail_nodes or 4), 8))
    key = _cache_key("graph", drug_name, safe_detail_limit)

    def _build_graph_payload():
        payload = _get_full_payload_cached(drug_name)

        identity = payload.get("identity_card", {})
        related = payload.get("related_concepts", {})
        therapeutic = payload.get("therapeutic_classes", {})
        ndc = payload.get("ndc_crosswalk", {})

        related_records = related.get("related_concepts", []) or []
        atc_records = therapeutic.get("atc_hierarchy", []) or []
        ndc_records = ndc.get("ndc_records", []) or []

        nodes = []
        edges = []

        search_term = identity.get("search_term", drug_name) or drug_name
        primary_rxcui = identity.get("primary_rxcui", "") or ""

        # Fixed dashboard direction:
        # center searched drug is static -> evenly spaced category ring -> detail rings.
        center = (0, 0)
        hub_radius = 315
        detail_radius = 130

        # The category ring is intentionally equidistant: six semantic hubs spaced
        # every 60 degrees around the searched drug, similar to the SaaS circle
        # diagram direction. Positive Y renders downward in vis-network.
        hub_specs = [
            ("atc_hub", "ATC", "atc", "Therapeutic class hierarchy used for clinical grouping.", 0),
            ("ndc_hub", "NDC", "ndc", "Claims-ready National Drug Code mappings. NDC package context is preserved in hover metadata without drawing noisy cross-link lines.", 60),
            ("analytics_hub", "Analytics", "analytics", "Downstream reporting, claims intelligence, and machine-learning use cases.", 120),
            ("drug_hub", "Drug", "drug", "Related drug-name concepts. The searched medication remains static in the center even when this branch is filtered.", 180),
            ("rxnorm_hub", "RxNorm", "rxnorm", "RxNorm semantic medication identity and related concept records.", 240),
            ("rxcui_hub", "RxCUI", "rxcui", "Standardized RxNorm Concept Unique Identifier.", 300),
        ]

        hubs = {}
        for hub_id, label, group, title, angle in hub_specs:
            x, y = _point_on_circle(center[0], center[1], hub_radius, angle)
            hubs[hub_id] = (label, group, title, x, y, angle)

        nodes.append(_fixed_node(
            "drug_center",
            _short_node_label(search_term, 16),
            "searched_drug",
            _format_tooltip(
                "Searched medication",
                search_term,
                "Static center node. Always visible while filters show or hide the surrounding categories."
            ),
            center[0],
            center[1],
            38,
            "center",
        ))
        nodes[-1]["node_type"] = "Drug (Searched)"
        nodes[-1]["rxcui"] = primary_rxcui
        nodes[-1]["description"] = "Static center node. Always visible while filters show or hide surrounding category branches."
        nodes[-1]["source"] = "RxNorm / RxNav"

        for hub_id, (label, group, title, x, y, outward_angle) in hubs.items():
            hub_node = _fixed_node(hub_id, label, group, title, x, y, 30, "hub")
            hub_node["node_type"] = f"{label} Category Hub"
            hub_node["description"] = title
            hub_node["source"] = "RxNorm Intelligence Explorer"
            nodes.append(hub_node)
            edges.append(_edge("drug_center", hub_id, "maps to", "Maps To", primary=True))

        # Drug-name details.
        drug_candidates = [
            r for r in related_records
            if str(r.get("term_type", "")).upper() in {"BN", "SBD", "SCD", "SBDF", "SCDF"}
            and str(r.get("name", "")).strip()
            and str(r.get("name", "")).strip().lower() != search_term.lower()
        ]
        drug_details = _unique_by_key(drug_candidates, "name", min(4, safe_detail_limit))
        for i, (record, (x, y)) in enumerate(zip(
            drug_details,
            _radial_child_positions(
                hubs["drug_hub"][3],
                hubs["drug_hub"][4],
                detail_radius,
                hubs["drug_hub"][5],
                len(drug_details),
                120,
            )
        )):
            node_id = f"drug_detail_{i}"
            drug_node = _detail_node(
                node_id,
                record.get("name", "Drug Concept"),
                "drug",
                record.get("term_type_description", "Related drug concept"),
                x,
                y,
                17,
            )
            drug_node["node_type"] = record.get("term_type_description", "Related Drug Concept")
            drug_node["description"] = record.get("name", "Related drug concept")
            drug_node["source"] = "RxNorm / RxNav"
            drug_node["additional_context"] = _format_tooltip(record.get("term_type", ""), record.get("rxcui", ""))
            nodes.append(drug_node)
            edges.append(_edge("drug_hub", node_id, "related concept", "Related Concept"))

        # RxCUI detail.
        if primary_rxcui:
            x, y = _radial_child_positions(
                hubs["rxcui_hub"][3],
                hubs["rxcui_hub"][4],
                detail_radius,
                hubs["rxcui_hub"][5],
                1,
            )[0]
            rxcui_node = _detail_node(
                "rxcui_primary",
                primary_rxcui,
                "rxcui",
                "Primary RxNorm Concept Unique Identifier.",
                x,
                y,
                19,
            )
            rxcui_node["node_type"] = "Primary RxCUI"
            rxcui_node["rxcui"] = primary_rxcui
            rxcui_node["description"] = "Primary RxNorm Concept Unique Identifier used as the normalized medication anchor."
            rxcui_node["source"] = "RxNorm / RxNav"
            nodes.append(rxcui_node)
            edges.append(_edge("rxcui_hub", "rxcui_primary", "resolves to", "Resolves To"))

        # RxNorm semantic relationship details.
        rxnorm_details = _unique_by_key(related_records, "term_type_description", safe_detail_limit)
        for i, (record, (x, y)) in enumerate(zip(
            rxnorm_details,
            _radial_child_positions(
                hubs["rxnorm_hub"][3],
                hubs["rxnorm_hub"][4],
                detail_radius,
                hubs["rxnorm_hub"][5],
                len(rxnorm_details),
                125,
            )
        )):
            node_id = f"rxnorm_detail_{i}"
            label = record.get("term_type", "RxNorm") or "RxNorm"
            relationship_type = record.get("term_type_description", "RxNorm concept")
            # Clean RxNorm hover tooltip: remove repetitive headers such as
            # "IN" + "RxNorm Relationship Type" and keep only the useful lines.
            title = _format_tooltip(
                relationship_type,
                record.get("term_type", ""),
                record.get("name", "")
            )
            rx_node = _detail_node(node_id, label, "rxnorm", title, x, y, 17)
            # Override generic detail-node title so RxNorm tooltips do not repeat the code twice.
            rx_node["title"] = title
            rx_node["node_type"] = relationship_type
            rx_node["description"] = record.get("name", "RxNorm semantic relationship")
            rx_node["source"] = "RxNorm / RxNav"
            rx_node["additional_context"] = _format_tooltip(record.get("term_type", ""), record.get("name", ""))
            nodes.append(rx_node)
            edges.append(_edge("rxnorm_hub", node_id, "semantic relationship", relationship_type))

        # ATC detail nodes.
        # Keep the graph to three visual rings: searched drug -> category hubs -> detail nodes.
        # ATC hierarchy context now lives inside the ATC detail node tooltip and Node Details panel
        # instead of rendering separate Level 1-4 circles.
        atc_details = _unique_by_key(atc_records, "full_class_id", safe_detail_limit)

        for i, (record, (x, y)) in enumerate(zip(
            atc_details,
            _radial_child_positions(
                hubs["atc_hub"][3],
                hubs["atc_hub"][4],
                detail_radius,
                hubs["atc_hub"][5],
                len(atc_details),
                125,
            )
        )):
            node_id = f"atc_detail_{i}"
            full_code = record.get("full_class_id", "ATC") or "ATC"
            full_name = record.get("full_class_name", "Therapeutic class") or "Therapeutic class"
            hierarchy_lines = _format_tooltip(
                f"{record.get('atc_level_1_code', '')} - ATC anatomical main group" if record.get("atc_level_1_code") else "",
                f"{record.get('atc_level_2_code', '')} - ATC therapeutic subgroup" if record.get("atc_level_2_code") else "",
                f"{record.get('atc_level_3_code', '')} - ATC pharmacological subgroup" if record.get("atc_level_3_code") else "",
                f"{record.get('atc_level_4_code', '')} - {full_name}" if record.get("atc_level_4_code") else "",
            )
            atc_title = _format_tooltip(full_code, full_name, hierarchy_lines)
            atc_node = _detail_node(
                node_id,
                full_code,
                "atc",
                atc_title,
                x,
                y,
                17,
            )
            # Override the generic detail-node title so the code is not duplicated at the top.
            atc_node["title"] = atc_title
            atc_node["node_type"] = "ATC Therapeutic Class"
            atc_node["description"] = _format_tooltip(full_code, full_name)
            atc_node["source"] = "RxClass / RxNav"
            atc_node["additional_context"] = hierarchy_lines
            nodes.append(atc_node)
            edges.append(_edge("atc_hub", node_id, "classified into", "Classified Into"))

        # NDC package / claims details. Cross-link context is retained in hover metadata
        # instead of rendering additional long diagonal edges.
        ndc_details = _unique_by_key(ndc_records, "ndc11", safe_detail_limit)
        for i, (record, (x, y)) in enumerate(zip(
            ndc_details,
            _radial_child_positions(
                hubs["ndc_hub"][3],
                hubs["ndc_hub"][4],
                detail_radius,
                hubs["ndc_hub"][5],
                len(ndc_details),
                120,
            )
        )):
            node_id = f"ndc_detail_{i}"
            clinical_rxcui = record.get("clinical_drug_rxcui") or record.get("rxcui") or ""
            ndc_node = _detail_node(
                node_id,
                record.get("ndc11", "NDC"),
                "ndc",
                _format_tooltip(
                    "Package / claims-level identifier",
                    "Cross-link to package / clinical drug concept",
                    f"Clinical Drug RxCUI: {clinical_rxcui}" if clinical_rxcui else ""
                ),
                x,
                y,
                16,
            )
            ndc_node["node_type"] = "NDC Package / Claims Identifier"
            ndc_node["rxcui"] = clinical_rxcui
            ndc_node["description"] = record.get("ndc11", "NDC")
            ndc_node["source"] = record.get("source", "RxNorm Related NDC")
            ndc_node["additional_context"] = _format_tooltip(
                "Package / claims-level identifier",
                f"NDC10: {record.get('ndc10', '')}" if record.get("ndc10") else "",
                f"NDC9: {record.get('ndc9', '')}" if record.get("ndc9") else "",
                f"Clinical Drug RxCUI: {clinical_rxcui}" if clinical_rxcui else ""
            )
            nodes.append(ndc_node)
            edges.append(_edge("ndc_hub", node_id, "maps to", "Maps To"))

        # Analytics details.
        analytics_details = [
            ("Claims Mapping", "Connects normalized medication identity to pharmacy claims workflows."),
            ("Utilization Analytics", "Supports utilization, trend, and therapeutic category analysis."),
            ("AI / ML Features", "Creates structured features for predictive modeling and AI-ready intelligence."),
        ]
        for i, ((label, title), (x, y)) in enumerate(zip(
            analytics_details,
            _radial_child_positions(
                hubs["analytics_hub"][3],
                hubs["analytics_hub"][4],
                detail_radius,
                hubs["analytics_hub"][5],
                len(analytics_details),
                115,
            )
        )):
            node_id = f"analytics_detail_{i}"
            analytics_node = _detail_node(node_id, label, "analytics", title, x, y, 17)
            analytics_node["node_type"] = "Analytics Use Case"
            analytics_node["description"] = title
            analytics_node["source"] = "RxNorm Intelligence Explorer"
            nodes.append(analytics_node)
            edges.append(_edge("analytics_hub", node_id, "enables", "Enables"))

        nodes, edges = _normalize_graph_payload(nodes, edges)

        graph_payload = {
            "drug_name": drug_name,
            "layout": "static_center_true_concentric_rings",
            "nodes": nodes,
            "edges": edges,
            "max_detail_nodes": safe_detail_limit,
        }

        return graph_payload

    return get_cached_or_build(
        category="graph_payloads",
        key=key,
        builder=_build_graph_payload,
        refresh_day=MONTHLY_CACHE_REFRESH_DAY,
    )

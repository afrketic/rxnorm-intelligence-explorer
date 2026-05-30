from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import math
import html
import os
import re
import time
from copy import deepcopy

from app.rxnorm_client import (
    get_full_application_payload,
    get_therapeutic_class_explorer_package,
    get_ndc_crosswalk,
)

try:
    from app.trending_drugs import get_trending_drugs
except ImportError:
    def get_trending_drugs(limit: int = 5):
        fallback = ["Atorvastatin", "Levothyroxine", "Metformin", "Lisinopril", "Amlodipine"]
        return {
            "success": False,
            "used_fallback": True,
            "display_label": "Popular Medication Searches",
            "source": "Fallback list",
            "metric": "Fallback",
            "dataset_period": "Unavailable",
            "trending_drugs": [{"rank": i + 1, "drug_name": name, "total_claim_count": None} for i, name in enumerate(fallback[:limit])]
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
# LIGHTWEIGHT CACHE LAYER
# =========================================================

DRUG_PAYLOAD_CACHE_TTL_SECONDS = int(os.getenv("DRUG_PAYLOAD_CACHE_TTL_SECONDS", str(60 * 60 * 24 * 7)))
GRAPH_CACHE_TTL_SECONDS = int(os.getenv("GRAPH_CACHE_TTL_SECONDS", str(60 * 60 * 24 * 7)))
NDC_CACHE_TTL_SECONDS = int(os.getenv("NDC_CACHE_TTL_SECONDS", str(60 * 60 * 24 * 7)))
TRENDING_ENDPOINT_CACHE_TTL_SECONDS = int(os.getenv("TRENDING_ENDPOINT_CACHE_TTL_SECONDS", str(60 * 60 * 24 * 30)))

_CACHE = {
    "drug": {},
    "graph": {},
    "ndc": {},
    "trending": {},
}


def _cache_key(*parts):
    return "::".join(str(part).strip().lower() for part in parts if part is not None)


def _cache_get(bucket: str, key: str):
    entry = _CACHE.get(bucket, {}).get(key)
    if not entry:
        return None

    if time.time() >= entry.get("expires_at", 0):
        _CACHE.get(bucket, {}).pop(key, None)
        return None

    payload = deepcopy(entry.get("payload"))
    if isinstance(payload, dict):
        payload["served_from_cache"] = True
    return payload


def _cache_set(bucket: str, key: str, payload, ttl_seconds: int):
    _CACHE.setdefault(bucket, {})[key] = {
        "expires_at": time.time() + ttl_seconds,
        "payload": deepcopy(payload),
    }
    return payload


def _build_light_application_payload(drug_name: str):
    """
    Builds the first-load dashboard payload without constructing the expensive
    NDC crosswalk or graph payload. NDC and graph are lazy-loaded by their tabs.
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
    cached = _cache_get("drug", key)
    if cached:
        return cached
    payload = get_full_application_payload(drug_name)
    return _cache_set("drug", key, payload, DRUG_PAYLOAD_CACHE_TTL_SECONDS)

@app.get("/drug/{drug_name}")
def get_drug_intelligence(drug_name: str):
    key = _cache_key("light", drug_name)
    cached = _cache_get("drug", key)
    if cached:
        return cached

    payload = _build_light_application_payload(drug_name)
    return _cache_set("drug", key, payload, DRUG_PAYLOAD_CACHE_TTL_SECONDS)


@app.get("/ndc/{drug_name}")
def get_drug_ndc_intelligence(drug_name: str, limit: int = 50):
    safe_limit = max(1, min(int(limit or 50), 250))
    key = _cache_key("ndc", drug_name)
    cached = _cache_get("ndc", key)

    if cached:
        cached["ndc_records"] = cached.get("ndc_records", [])[:safe_limit]
        cached["render_limit"] = safe_limit
        return cached

    payload = get_ndc_crosswalk(drug_name)
    payload["lazy_loaded"] = True
    payload["render_limit"] = safe_limit
    full_records = payload.get("ndc_records", []) or []
    payload["ndc_count"] = payload.get("ndc_count", len(full_records))

    cached_payload = deepcopy(payload)
    _cache_set("ndc", key, cached_payload, NDC_CACHE_TTL_SECONDS)

    payload["ndc_records"] = full_records[:safe_limit]
    return payload


@app.get("/suggest/{query}")
def suggest_drug_names(query: str, max_results: int = 8):
    return get_drug_name_suggestions(query, max_results=max_results)


@app.get("/trending-drugs")
def trending_drugs(limit: int = 5):
    safe_limit = max(1, min(int(limit or 5), 10))
    key = _cache_key("trending", safe_limit)
    cached = _cache_get("trending", key)
    if cached:
        return cached

    payload = get_trending_drugs(limit=safe_limit)
    return _cache_set("trending", key, payload, TRENDING_ENDPOINT_CACHE_TTL_SECONDS)


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
    cached = _cache_get("graph", key)
    if cached:
        return cached

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

    return _cache_set("graph", key, graph_payload, GRAPH_CACHE_TTL_SECONDS)

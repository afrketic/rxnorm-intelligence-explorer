from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import math
import html
import re

from app.rxnorm_client import get_full_application_payload

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


@app.get("/drug/{drug_name}")
def get_drug_intelligence(drug_name: str):
    return get_full_application_payload(drug_name)


@app.get("/suggest/{query}")
def suggest_drug_names(query: str, max_results: int = 8):
    return get_drug_name_suggestions(query, max_results=max_results)


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
    return "\n".join(lines)


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
def get_drug_graph(drug_name: str):
    payload = get_full_application_payload(drug_name)

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
    hub_radius = 325
    detail_radius = 135

    # The category ring is intentionally equidistant: six semantic hubs spaced
    # every 60 degrees around the searched drug, similar to the SaaS circle
    # diagram direction. Positive Y renders downward in vis-network.
    hub_specs = [
        # Six category hubs, exactly 60 degrees apart on the same category ring.
        # This preserves the SaaS-style circular layout and removes uneven gaps
        # between category clusters.
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
        search_term,
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
    drug_details = _unique_by_key(drug_candidates, "name", 4)
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
        nodes.append(_detail_node(
            node_id,
            record.get("name", "Drug Concept"),
            "drug",
            record.get("term_type_description", "Related drug concept"),
            x,
            y,
            17,
        ))
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
        nodes.append(_detail_node(
            "rxcui_primary",
            primary_rxcui,
            "rxcui",
            "Primary RxNorm Concept Unique Identifier.",
            x,
            y,
            19,
        ))
        edges.append(_edge("rxcui_hub", "rxcui_primary", "resolves to", "Resolves To"))

    # RxNorm semantic relationship details.
    rxnorm_details = _unique_by_key(related_records, "term_type_description", 5)
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
        rx_node["node_type"] = relationship_type
        rx_node["description"] = record.get("name", "RxNorm semantic relationship")
        rx_node["source"] = "RxNorm / RxNav"
        rx_node["additional_context"] = _format_tooltip(record.get("term_type", ""), record.get("name", ""))
        nodes.append(rx_node)
        edges.append(_edge("rxnorm_hub", node_id, "semantic relationship", relationship_type))

    # ATC hierarchy branch with click-to-expand levels.
    atc_details = _unique_by_key(atc_records, "full_class_id", 5)

    if atc_details:
        primary_atc = atc_details[0]
        atc_levels = [
            ("Level 1", primary_atc.get("atc_level_1_code", ""), "ATC anatomical main group."),
            ("Level 2", primary_atc.get("atc_level_2_code", ""), "ATC therapeutic subgroup."),
            ("Level 3", primary_atc.get("atc_level_3_code", ""), "ATC pharmacological subgroup."),
            ("Level 4", primary_atc.get("atc_level_4_code", ""), primary_atc.get("full_class_name", "Therapeutic class.")),
        ]

        # Expanded ATC levels use their own evenly spaced outer arc/ring
        # rather than a tight vertical stack. This keeps Level 1-4 readable.
        atc_level_positions = _radial_child_positions(
            hubs["atc_hub"][3],
            hubs["atc_hub"][4],
            235,
            hubs["atc_hub"][5],
            len([lvl for lvl in atc_levels if lvl[1]]),
            145,
        )
        previous_id = "atc_hub"
        visible_level_index = 0

        for level_index, (level_name, code, description) in enumerate(atc_levels):
            if not code:
                continue

            node_id = f"atc_level_{level_index + 1}"
            x, y = atc_level_positions[visible_level_index]
            visible_level_index += 1
            nodes.append(_fixed_node(
                node_id=node_id,
                label=code,
                group="atc",
                title=_format_tooltip(
                    level_name,
                    code,
                    description,
                    primary_atc.get("full_class_name", "")
                ),
                x=x,
                y=y,
                size=17,
                role="atc_level",
            ))
            nodes[-1]["hidden"] = True
            nodes[-1]["atc_hierarchy_node"] = True
            nodes[-1]["atc_level_name"] = level_name
            nodes[-1]["node_type"] = level_name
            nodes[-1]["description"] = description
            nodes[-1]["source"] = "RxClass / RxNav"
            nodes[-1]["additional_context"] = primary_atc.get("full_class_name", "")

            edge_id = f"atc_hierarchy_edge_{level_index + 1}"
            branch_edge = _edge(previous_id, node_id, "ATC hierarchy", level_name, primary=False)
            branch_edge["id"] = edge_id
            branch_edge["hidden"] = True
            branch_edge["atc_hierarchy_edge"] = True
            edges.append(branch_edge)
            previous_id = node_id

        additional_atc = atc_details[1:] if len(atc_details) > 1 else []
        for i, (record, (x, y)) in enumerate(zip(
            additional_atc,
            _radial_child_positions(
                hubs["atc_hub"][3],
                hubs["atc_hub"][4],
                detail_radius + 25,
                hubs["atc_hub"][5],
                len(additional_atc),
                220,
            )
        )):
            node_id = f"atc_detail_{i}"
            nodes.append(_detail_node(
                node_id,
                record.get("full_class_id", "ATC"),
                "atc",
                _format_tooltip(
                    "Additional ATC class",
                    record.get("full_class_id", "ATC"),
                    record.get("full_class_name", "Therapeutic class")
                ),
                x,
                y,
                17,
            ))
            edges.append(_edge("atc_hub", node_id, "classified into", "Classified Into"))

    for node in nodes:
        if node.get("id") == "atc_hub":
            node["title"] = _format_tooltip(
                "ATC",
                "Therapeutic class hierarchy used for clinical grouping.",
                "Click to expand or collapse ATC Levels 1-4."
            )
            node["expandable"] = True
            node["expanded_label"] = "ATC [-]"
            node["collapsed_label"] = "ATC [+]"
            node["label"] = "ATC [+]"

    # NDC package / claims details. Cross-link context is retained in hover metadata
    # instead of rendering additional long diagonal edges.
    ndc_details = _unique_by_key(ndc_records, "ndc11", 6)
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
        nodes.append(_detail_node(
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
        ))
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
        nodes.append(_detail_node(node_id, label, "analytics", title, x, y, 17))
        edges.append(_edge("analytics_hub", node_id, "enables", "Enables"))

    nodes, edges = _normalize_graph_payload(nodes, edges)

    return {
        "drug_name": drug_name,
        "layout": "static_center_true_concentric_rings",
        "nodes": nodes,
        "edges": edges,
    }

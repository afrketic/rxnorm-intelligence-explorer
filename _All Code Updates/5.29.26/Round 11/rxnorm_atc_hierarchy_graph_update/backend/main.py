from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.rxnorm_client import get_full_application_payload, get_drug_name_suggestions
import math
import html
import re

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
    Every node and edge title should pass through this function so future
    drug searches inherit the same tooltip formatting automatically.
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
    """
    Builds a clean multiline tooltip from one or more pieces of information.

    Example:
    _format_tooltip("50090594900", "Package / claims-level identifier")
    renders as:
    50090594900
    Package / claims-level identifier
    """
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

    The text is preserved in the hover tooltip so the graph stays clean while
    still allowing users to inspect each outer detail circle on hover.
    Multiple tooltip fields use newline characters so each item appears on
    its own line instead of showing raw HTML such as <br>.
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

    The category hubs sit on a ring around the searched medication. Each hub's
    children are placed on the next outward ring, centered on that hub's radial
    angle so detail nodes do not drift back toward the center or overlap the
    hub-to-center relationship line.
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
        coords.append((round(cx + radius * math.cos(radians)), round(cy + radius * math.sin(radians))))

    return coords


def _normalize_graph_payload(nodes, edges):
    """
    Final graph-wide formatting pass.

    This applies the Advil/Ozempic/Wegovy visual rules globally so every
    medication search inherits the same graph behavior:
    - fixed concentric/ring layout is preserved,
    - detail/outer-ring node labels stay hidden by default,
    - tooltip text is normalized into real line breaks,
    - relationship data remains available on hover,
    - edge labels remain hidden by default.
    """
    normalized_nodes = []

    for node in nodes:
        clean_node = dict(node)
        clean_node["title"] = _format_tooltip(clean_node.get("title", ""))

        if clean_node.get("layout_role") == "detail":
            visible_label = _format_tooltip(clean_node.get("hover_label") or clean_node.get("label") or clean_node.get("title"))
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
        clean_edge["title"] = _format_tooltip(clean_edge.get("title") or "Relationship Type:", relationship)
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
    concept_name = identity.get("concept_name", "RxNorm Concept") or "RxNorm Concept"
    primary_rxcui = identity.get("primary_rxcui", "") or ""

    # A fixed, standardized hub-and-spoke layout:
    # searched medication in the center -> semantic category hubs -> related detail nodes.
    center = (0, 0)
    hub_radius = 300

    # Hubs are intentionally placed on a clean 6-point ring around the searched drug.
    # The final value in each tuple is the hub's outward radial angle. Child/detail
    # nodes use that angle to form a second ring around the hub.
    hubs = {
        "drug_hub": ("Drug", "drug", "Original medication search and related drug-name concepts.", -hub_radius, 0, 180),
        "rxnorm_hub": ("RxNorm", "rxnorm", "RxNorm semantic medication identity and related concept records.", -150, -260, 240),
        "rxcui_hub": ("RxCUI", "rxcui", "Standardized RxNorm Concept Unique Identifier.", 150, -260, 300),
        "atc_hub": ("ATC", "atc", "Therapeutic class hierarchy used for clinical grouping.", hub_radius, 0, 0),
        "analytics_hub": ("Analytics", "analytics", "Downstream reporting, claims intelligence, and machine-learning use cases.", 150, 260, 60),
        "ndc_hub": ("NDC", "ndc", "Claims-ready National Drug Code mappings.", -150, 260, 120),
    }

    nodes.append(_fixed_node("drug_center", search_term, "drug", "Searched medication at the center of the knowledge graph.", center[0], center[1], 34, "center"))

    for hub_id, (label, group, title, x, y, outward_angle) in hubs.items():
        nodes.append(_fixed_node(hub_id, label, group, title, x, y, 30, "hub"))
        edges.append(_edge("drug_center", hub_id, "maps to", "Maps To", primary=True))

    # Drug-name details: keep this section compact and data-driven.
    drug_candidates = [
        r for r in related_records
        if str(r.get("term_type", "")).upper() in {"BN", "SBD", "SCD", "SBDF", "SCDF"}
        and str(r.get("name", "")).strip()
        and str(r.get("name", "")).strip().lower() != search_term.lower()
    ]
    drug_details = _unique_by_key(drug_candidates, "name", 3)
    for i, (record, (x, y)) in enumerate(zip(drug_details, _radial_child_positions(hubs["drug_hub"][3], hubs["drug_hub"][4], 125, hubs["drug_hub"][5], len(drug_details), 115))):
        node_id = f"drug_detail_{i}"
        nodes.append(_detail_node(
            node_id,
            record.get("name", "Drug Concept"),
            "drug",
            record.get("term_type_description", "Related drug concept"),
            x,
            y,
            18,
        ))
        edges.append(_edge("drug_hub", node_id, "related concept", "Related Concept"))

    # RxCUI detail.
    if primary_rxcui:
        nodes.append(_detail_node(
            "rxcui_primary",
            primary_rxcui,
            "rxcui",
            "Primary RxNorm Concept Unique Identifier.",
            *_radial_child_positions(hubs["rxcui_hub"][3], hubs["rxcui_hub"][4], 125, hubs["rxcui_hub"][5], 1)[0],
            19,
        ))
        edges.append(_edge("rxcui_hub", "rxcui_primary", "resolves to", "Resolves To"))

    # RxNorm semantic details.
    rxnorm_details = _unique_by_key(related_records, "term_type_description", 4)
    for i, (record, (x, y)) in enumerate(zip(rxnorm_details, _radial_child_positions(hubs["rxnorm_hub"][3], hubs["rxnorm_hub"][4], 125, hubs["rxnorm_hub"][5], len(rxnorm_details), 115))):
        node_id = f"rxnorm_detail_{i}"
        label = record.get("term_type", "RxNorm") or "RxNorm"
        relationship_type = record.get('term_type_description', 'RxNorm concept')
        title = _format_tooltip(
            "RxNorm Relationship Type",
            relationship_type,
            record.get('term_type', ''),
            record.get('name', '')
        )
        nodes.append(_detail_node(node_id, label, "rxnorm", title, x, y, 18))
        edges.append(_edge("rxnorm_hub", node_id, "semantic relationship", relationship_type))

    # ATC hierarchy branch.
    # The ATC hub now supports an expandable/collapsible hierarchy so the graph
    # can show Level 1 -> Level 2 -> Level 3 -> Level 4 clinical context without
    # cluttering the default collapsed view. The frontend toggles these nodes when
    # the user clicks the ATC hub.
    atc_details = _unique_by_key(atc_records, "full_class_id", 5)
    atc_hierarchy_node_ids = []
    atc_hierarchy_edge_ids = []

    if atc_details:
        # Use the first ATC signal as the primary hierarchy branch. This mirrors
        # the ATC Hierarchy panel while keeping the graph readable.
        primary_atc = atc_details[0]
        atc_levels = [
            ("Level 1", primary_atc.get("atc_level_1_code", ""), "ATC anatomical main group."),
            ("Level 2", primary_atc.get("atc_level_2_code", ""), "ATC therapeutic subgroup."),
            ("Level 3", primary_atc.get("atc_level_3_code", ""), "ATC pharmacological subgroup."),
            ("Level 4", primary_atc.get("atc_level_4_code", ""), primary_atc.get("full_class_name", "Therapeutic class.")),
        ]

        # Position expanded ATC levels as a clean vertical branch outside the ATC
        # category hub. These are hidden by default and revealed by clicking ATC.
        atc_x = hubs["atc_hub"][3] + 135
        atc_start_y = hubs["atc_hub"][4] - 135
        previous_id = "atc_hub"

        for level_index, (level_name, code, description) in enumerate(atc_levels):
            if not code:
                continue

            node_id = f"atc_level_{level_index + 1}"
            atc_hierarchy_node_ids.append(node_id)
            nodes.append(_fixed_node(
                node_id=node_id,
                label=code,
                group="atc",
                title=_format_tooltip(level_name, code, description, primary_atc.get("full_class_name", "")),
                x=atc_x,
                y=atc_start_y + (level_index * 80),
                size=17,
                role="atc_level",
            ))
            nodes[-1]["hidden"] = True
            nodes[-1]["atc_hierarchy_node"] = True
            nodes[-1]["atc_level_name"] = level_name

            edge_id = f"atc_hierarchy_edge_{level_index + 1}"
            atc_hierarchy_edge_ids.append(edge_id)
            branch_edge = _edge(previous_id, node_id, "ATC hierarchy", level_name, primary=False)
            branch_edge["id"] = edge_id
            branch_edge["hidden"] = True
            branch_edge["atc_hierarchy_edge"] = True
            edges.append(branch_edge)
            previous_id = node_id

        # Additional ATC classes still appear as outer detail circles, but only
        # on hover, preserving the clean visual design.
        additional_atc = atc_details[1:] if len(atc_details) > 1 else []
        for i, (record, (x, y)) in enumerate(zip(additional_atc, _radial_child_positions(hubs["atc_hub"][3], hubs["atc_hub"][4], 125, hubs["atc_hub"][5], len(additional_atc), 115))):
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
                18,
            ))
            edges.append(_edge("atc_hub", node_id, "classified into", "Classified Into"))

    # Mark the ATC hub as expandable for the frontend.
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

    # NDC details.
    ndc_details = _unique_by_key(ndc_records, "ndc11", 6)
    for i, (record, (x, y)) in enumerate(zip(ndc_details, _radial_child_positions(hubs["ndc_hub"][3], hubs["ndc_hub"][4], 125, hubs["ndc_hub"][5], len(ndc_details), 115))):
        node_id = f"ndc_detail_{i}"
        clinical_rxcui = record.get("clinical_drug_rxcui") or record.get("rxcui") or ""
        nodes.append(_detail_node(
            node_id,
            record.get("ndc11", "NDC"),
            "ndc",
            _format_tooltip(
                "Package / claims-level identifier",
                f"Clinical Drug RxCUI: {clinical_rxcui}" if clinical_rxcui else ""
            ),
            x,
            y,
            16,
        ))
        edges.append(_edge("ndc_hub", node_id, "maps to", "Maps To"))
        if clinical_rxcui:
            cross_edge = _edge(node_id, "rxnorm_hub", "package concept", "Cross-link to package / clinical drug concept")
            cross_edge["dashes"] = [2, 8]
            cross_edge["color"] = {"color": "rgba(148,163,184,.35)", "highlight": "#38bdf8"}
            cross_edge["edge_role"] = "crosslink"
            edges.append(cross_edge)

    # Analytics details.
    analytics_details = [
        ("Claims Mapping", "Connects normalized medication identity to pharmacy claims workflows."),
        ("Utilization Analytics", "Supports utilization, trend, and therapeutic category analysis."),
        ("AI / ML Features", "Creates structured features for predictive modeling and AI-ready intelligence."),
    ]
    for i, ((label, title), (x, y)) in enumerate(zip(analytics_details, _radial_child_positions(hubs["analytics_hub"][3], hubs["analytics_hub"][4], 125, hubs["analytics_hub"][5], len(analytics_details), 115))):
        node_id = f"analytics_detail_{i}"
        nodes.append(_detail_node(node_id, label, "analytics", title, x, y, 17))
        edges.append(_edge("analytics_hub", node_id, "enables", "Enables"))

    nodes, edges = _normalize_graph_payload(nodes, edges)

    return {
        "drug_name": drug_name,
        "layout": "fixed_concentric_category_rings",
        "nodes": nodes,
        "edges": edges,
    }

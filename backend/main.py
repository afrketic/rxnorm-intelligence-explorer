from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.rxnorm_client import get_full_application_payload
import math

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


def _fixed_node(node_id, label, group, title, x, y, size=24, role="detail"):
    return {
        "id": node_id,
        "label": label,
        "group": group,
        "title": title,
        "x": x,
        "y": y,
        "fixed": {"x": True, "y": True},
        "size": size,
        "layout_role": role,
    }


def _edge(source, target, label, relationship_type=None, primary=False):
    relationship = relationship_type or label.title()
    return {
        "from": source,
        "to": target,
        "label": label,
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


def _child_positions(cx, cy, radius, start_deg, end_deg, count):
    if count <= 0:
        return []
    if count == 1:
        angles = [(start_deg + end_deg) / 2]
    else:
        step = (end_deg - start_deg) / (count - 1)
        angles = [start_deg + i * step for i in range(count)]
    coords = []
    for angle in angles:
        radians = math.radians(angle)
        coords.append((round(cx + radius * math.cos(radians)), round(cy + radius * math.sin(radians))))
    return coords


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
    hubs = {
        "drug_hub": ("Drug", "drug", "Original medication search and related drug-name concepts.", -270, 0),
        "rxnorm_hub": ("RxNorm", "rxnorm", "RxNorm semantic medication identity and related concept records.", -170, -205),
        "rxcui_hub": ("RxCUI", "rxcui", "Standardized RxNorm Concept Unique Identifier.", 170, -205),
        "atc_hub": ("ATC", "atc", "Therapeutic class hierarchy used for clinical grouping.", 270, 0),
        "analytics_hub": ("Analytics", "analytics", "Downstream reporting, claims intelligence, and machine-learning use cases.", 170, 205),
        "ndc_hub": ("NDC", "ndc", "Claims-ready National Drug Code mappings.", -170, 205),
    }

    nodes.append(_fixed_node("drug_center", search_term, "drug", "Searched medication at the center of the knowledge graph.", center[0], center[1], 34, "center"))

    for hub_id, (label, group, title, x, y) in hubs.items():
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
    for i, (record, (x, y)) in enumerate(zip(drug_details, _child_positions(-270, 0, 120, 145, 215, len(drug_details)))):
        node_id = f"drug_detail_{i}"
        nodes.append(_fixed_node(node_id, record.get("name", "Drug Concept"), "drug", record.get("term_type_description", "Related drug concept"), x, y, 18, "detail"))
        edges.append(_edge("drug_hub", node_id, "related concept", "Related Concept"))

    # RxCUI detail.
    if primary_rxcui:
        nodes.append(_fixed_node("rxcui_primary", primary_rxcui, "rxcui", "Primary RxNorm Concept Unique Identifier.", 245, -305, 19, "detail"))
        edges.append(_edge("rxcui_hub", "rxcui_primary", "resolves to", "Resolves To"))

    # RxNorm semantic details.
    rxnorm_details = _unique_by_key(related_records, "term_type_description", 4)
    for i, (record, (x, y)) in enumerate(zip(rxnorm_details, _child_positions(-170, -205, 115, 205, 335, len(rxnorm_details)))):
        node_id = f"rxnorm_detail_{i}"
        label = record.get("term_type", "RxNorm") or "RxNorm"
        title = f"{record.get('term_type_description', 'RxNorm concept')} — {record.get('name', '')}".strip(" —")
        nodes.append(_fixed_node(node_id, label, "rxnorm", title, x, y, 18, "detail"))
        edges.append(_edge("rxnorm_hub", node_id, "semantic relationship", "Semantic Relationship"))

    # ATC details positioned outside the ATC category hub, never near the center.
    atc_details = _unique_by_key(atc_records, "full_class_id", 5)
    for i, (record, (x, y)) in enumerate(zip(atc_details, _child_positions(270, 0, 125, -50, 50, len(atc_details)))):
        node_id = f"atc_detail_{i}"
        nodes.append(_fixed_node(node_id, record.get("full_class_id", "ATC"), "atc", record.get("full_class_name", "Therapeutic class"), x, y, 18, "detail"))
        edges.append(_edge("atc_hub", node_id, "classified into", "Classified Into"))

    # NDC details.
    ndc_details = _unique_by_key(ndc_records, "ndc11", 6)
    for i, (record, (x, y)) in enumerate(zip(ndc_details, _child_positions(-170, 205, 125, 95, 205, len(ndc_details)))):
        node_id = f"ndc_detail_{i}"
        nodes.append(_fixed_node(node_id, record.get("ndc11", "NDC"), "ndc", "Package / claims-level identifier", x, y, 16, "detail"))
        edges.append(_edge("ndc_hub", node_id, "maps to", "Maps To"))

    # Analytics details.
    analytics_details = [
        ("Claims Mapping", "Connects normalized medication identity to pharmacy claims workflows."),
        ("Utilization Analytics", "Supports utilization, trend, and therapeutic category analysis."),
        ("AI / ML Features", "Creates structured features for predictive modeling and AI-ready intelligence."),
    ]
    for i, ((label, title), (x, y)) in enumerate(zip(analytics_details, _child_positions(170, 205, 120, 35, 95, len(analytics_details)))):
        node_id = f"analytics_detail_{i}"
        nodes.append(_fixed_node(node_id, label, "analytics", title, x, y, 17, "detail"))
        edges.append(_edge("analytics_hub", node_id, "enables", "Enables"))

    return {
        "drug_name": drug_name,
        "layout": "fixed_category_hub_spoke",
        "nodes": nodes,
        "edges": edges,
    }

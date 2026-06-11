"""
Sprint 7 — FastAPI Integration Layer
RxNorm Intelligence API v1

Purpose
-------
Expose Sprint 6 intelligence dashboard exports as production-ready API endpoints
for:
    - RxNorm Intelligence Explorer
    - Knowledge Graph
    - AI Readiness Dashboard
    - Claims Readiness Dashboard
    - alexknowsai.com website visualizations

Expected SQLite source tables
-----------------------------
    - intelligence_explorer_drug_cards_v1
    - ai_readiness_dashboard_v1
    - claims_readiness_dashboard_v1
    - knowledge_graph_nodes_v1
    - knowledge_graph_edges_v1
    - website_summary_metrics_v1
    - website_tier_distribution_v1
    - website_score_distribution_v1
    - top_drugs_by_intelligence_v1
    - bottom_drugs_by_intelligence_v1
    - drug_intelligence_master_v1

Run locally
-----------
From the Scoring Methodology/Scripts folder:

    uvicorn scripts.rxnorm_intelligence_api_v1:app --reload --host 0.0.0.0 --port 8000

Or set the database path explicitly:

    RXNORM_DB_PATH="database/rxnorm_research.db" uvicorn scripts.rxnorm_intelligence_api_v1:app --reload

Docs
----
    http://127.0.0.1:8000/docs
    http://127.0.0.1:8000/health
"""

from __future__ import annotations

import time
import os
import sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "database" / "rxnorm_research.db"
DB_PATH = Path(os.getenv("RXNORM_DB_PATH", str(DEFAULT_DB_PATH))).expanduser().resolve()

APP_TITLE = "RxNorm Intelligence API"
APP_VERSION = "1.0.0"

REQUIRED_TABLES = [
    "intelligence_explorer_drug_cards_v1",
    "ai_readiness_dashboard_v1",
    "claims_readiness_dashboard_v1",
    "knowledge_graph_nodes_v1",
    "knowledge_graph_edges_v1",
    "knowledge_graph_metrics_v1",
    "website_summary_metrics_v1",
    "website_tier_distribution_v1",
    "website_score_distribution_v1",
    "top_drugs_by_intelligence_v1",
    "bottom_drugs_by_intelligence_v1",
    "drug_intelligence_master_v1",
    "research_classification_master",
    "research_relationship_master",
    "enterprise_healthcare_importance_master_v6",
    "ehi_v6_weight_configuration_v1",
    "ehi_v6_score_distribution_v1",
    "ehi_v6_tier_distribution_v1",
    "ehi_v6_top100_rankings_v1",
    "ehi_v6_enterprise_percentiles_v1",
    "ehi_v6_therapeutic_benchmarks_v1",
    "ehi_v6_atc_benchmarks_v1",
    "ehi_v6_disease_benchmarks_v1",
    "ehi_v6_disease_benchmarks_executive_v1",
]

SCORE_COLUMNS = [
    "overall_intelligence_score",
    "claims_readiness_score",
    "ai_readiness_score",
    "semantic_richness_score",
    "interoperability_score",
    "clinical_semantics_score",
    "relationship_density_score",
    "classification_density_score",
]

SEARCH_COLUMNS = [
    "rxcui",
    "rxnorm_name",
    "name",
    "drug_name",
    "display_name",
    "label",
]


# -----------------------------------------------------------------------------
# FastAPI app
# -----------------------------------------------------------------------------

app = FastAPI(
    title=APP_TITLE,
    version=APP_VERSION,
    description="API endpoints for RxNorm Intelligence Explorer, dashboards, knowledge graph, and alexknowsai.com visualizations.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ALLOW_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str
    database_path: str
    database_exists: bool
    missing_required_tables: List[str]


class TableCountResponse(BaseModel):
    table: str
    row_count: int


# -----------------------------------------------------------------------------
# SQLite helpers
# -----------------------------------------------------------------------------

def get_connection() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise HTTPException(status_code=500, detail=f"SQLite database not found: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    result = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return result is not None


def get_table_columns(conn: sqlite3.Connection, table_name: str) -> List[str]:
    rows = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
    return [row[1] for row in rows]


def validate_table(conn: sqlite3.Connection, table_name: str) -> None:
    if not table_exists(conn, table_name):
        raise HTTPException(status_code=500, detail=f"Required table not found: {table_name}")


def rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    return [dict(row) for row in rows]


def read_table(
    table_name: str,
    limit: int = 100,
    offset: int = 0,
    order_by: Optional[str] = None,
    descending: bool = True,
) -> List[Dict[str, Any]]:
    limit = min(max(limit, 1), 1000)
    offset = max(offset, 0)

    with get_connection() as conn:
        validate_table(conn, table_name)
        columns = get_table_columns(conn, table_name)

        order_clause = ""
        if order_by and order_by in columns:
            direction = "DESC" if descending else "ASC"
            order_clause = f' ORDER BY "{order_by}" {direction}'

        query = f'SELECT * FROM "{table_name}"{order_clause} LIMIT ? OFFSET ?'
        rows = conn.execute(query, (limit, offset)).fetchall()
        return rows_to_dicts(rows)


def count_table(table_name: str) -> int:
    with get_connection() as conn:
        validate_table(conn, table_name)
        row = conn.execute(f'SELECT COUNT(*) AS row_count FROM "{table_name}"').fetchone()
        return int(row["row_count"])


def available_order_column(conn: sqlite3.Connection, table_name: str, preferred: List[str]) -> Optional[str]:
    columns = get_table_columns(conn, table_name)
    for col in preferred:
        if col in columns:
            return col
    return None


def build_search_where(columns: List[str], q: str) -> tuple[str, List[Any]]:
    searchable = [col for col in SEARCH_COLUMNS if col in columns]
    if not searchable:
        return "", []

    clauses = [f'LOWER(CAST("{col}" AS TEXT)) LIKE ?' for col in searchable]
    params = [f"%{q.lower()}%" for _ in searchable]
    return " WHERE " + " OR ".join(clauses), params

def rank_primary_disease(classifications: Dict[str, Any]) -> str:
    disease_rows = classifications.get("DISEASE") or []

    if not isinstance(disease_rows, list) or not disease_rows:
        return "Disease focus not yet populated"

    priority_terms = [
        ("pain", "Pain Management", 100),
        ("analges", "Pain Management", 98),
        ("inflamm", "Inflammation", 96),
        ("fever", "Fever", 94),
        ("pyrexia", "Fever", 92),
        ("musculoskeletal", "Musculoskeletal Disorders", 90),
        ("arthralgia", "Pain Management", 88),
        ("bursitis", "Bursitis", 84),
        ("arthritis, rheumatoid", "Rheumatoid Arthritis", 82),
        ("rheumatoid", "Rheumatoid Arthritis", 80),
        ("arthritis", "Arthritis", 70),
        ("juvenile", "Juvenile Arthritis", 40),
    ]

    def disease_score(row: Dict[str, Any]) -> tuple:
        name = str(row.get("class_name") or row.get("class_id") or "").lower()
        weight = int(row.get("weight") or row.get("occurrence_count") or 0)

        for term, _, score in priority_terms:
            if term in name:
                return (-score, -weight, name)

        return (999, -weight, name)

    best = sorted(disease_rows, key=disease_score)[0]
    best_name = str(best.get("class_name") or best.get("class_id") or "")

    for term, label, _ in priority_terms:
        if term in best_name.lower():
            return label

    return best_name or "Disease focus not yet populated"


def first_name(classifications: Dict[str, Any], bucket: str) -> str:
    items = classifications.get(bucket) or []

    if not isinstance(items, list) or not items:
        return ""

    item = items[0]
    return item.get("class_name") or item.get("class_id") or ""


def build_medication_intelligence_summary(
    master: Dict[str, Any],
    classifications: Dict[str, Any],
    primary_therapeutic_pathway: Dict[str, Any],
) -> Dict[str, Any]:
    pathway = primary_therapeutic_pathway.get("pathway") or []

    primary_domain = ""
    if pathway:
        primary_domain = pathway[0].get("class_name") or pathway[0].get("class_id") or ""

    primary_mechanism = first_name(classifications, "MOA")
    primary_epc = first_name(classifications, "EPC")
    primary_disease_focus = rank_primary_disease(classifications)

    total_classifications = sum(
        len(value)
        for key, value in classifications.items()
        if key != "counts" and isinstance(value, list)
    )

    populated_domains = [
        key
        for key, value in classifications.items()
        if key != "counts" and isinstance(value, list) and len(value) > 0
    ]

    return {
        "primary_therapeutic_domain": primary_domain or "Therapeutic domain not yet populated",
        "primary_mechanism": primary_mechanism or primary_epc or "Mechanism evidence not yet populated",
        "primary_disease_focus": primary_disease_focus,
        "primary_pharmacologic_class": primary_epc or "Pharmacologic class not yet populated",
        "classification_breadth": total_classifications,
        "populated_intelligence_domains": len(populated_domains),
        "populated_domains": populated_domains,
    }


def build_therapeutic_narrative(
    master: Dict[str, Any],
    classifications: Dict[str, Any],
    primary_therapeutic_pathway: Dict[str, Any],
    summary: Dict[str, Any],
) -> Dict[str, Any]:
    drug_name = (
        master.get("rxnorm_name")
        or master.get("drug_name")
        or master.get("display_name")
        or "This medication"
    )

    domain = summary.get("primary_therapeutic_domain") or "its primary therapeutic domain"
    mechanism = summary.get("primary_mechanism") or "available mechanism evidence"
    disease_focus = summary.get("primary_disease_focus") or "mapped clinical indications"
    pharmacologic_class = summary.get("primary_pharmacologic_class") or "its pharmacologic class"

    narrative = (
        f"{drug_name} is positioned within the {domain} therapeutic domain. "
        f"Its available pharmacologic evidence maps to {mechanism} and {pharmacologic_class}. "
        f"The medication is most frequently associated with {disease_focus}, supporting clinical interpretation, "
        f"claims mapping, semantic enrichment, and downstream AI explainability."
    )

    return {
        "headline": f"{drug_name} therapeutic intelligence narrative",
        "primary_domain": domain,
        "primary_mechanism": mechanism,
        "primary_disease_focus": disease_focus,
        "primary_pharmacologic_class": pharmacologic_class,
        "narrative": narrative,
    }


def build_graph_intelligence(graph_payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = graph_payload.get("nodes") or []
    edges = graph_payload.get("edges") or []

    center_node_id = graph_payload.get("center_node_id") or f"drug:{graph_payload.get('center_rxcui')}"

    node_lookup = {
        node.get("node_id"): node
        for node in nodes
        if node.get("node_id")
    }

    connected_node_ids = set()

    for edge in edges:
        source = edge.get("source_node_id") or edge.get("source")
        target = edge.get("target_node_id") or edge.get("target")

        if source == center_node_id and target:
            connected_node_ids.add(target)

        if target == center_node_id and source:
            connected_node_ids.add(source)

    connected_nodes = [
        node_lookup[node_id]
        for node_id in connected_node_ids
        if node_id in node_lookup
    ]

    if not connected_nodes:
        connected_nodes = nodes

    def score_node(node: Dict[str, Any]) -> tuple:
        node_type = str(node.get("node_type") or "").upper()
        label = str(node.get("label") or "").lower()
        occurrence_count = int(node.get("occurrence_count") or 0)
        evidence_count = int(node.get("evidence_count") or 0)
        is_primary = int(node.get("is_primary_edge") or node.get("is_high_value_node") or 0)

        preferred_domain_bonus = 0
        if node_type == "ATC1" and ("musculo" in label or label == "m"):
            preferred_domain_bonus = 1000

        return (
            preferred_domain_bonus,
            is_primary,
            occurrence_count,
            evidence_count,
            label,
        )

    def top_node(node_types: set[str]) -> Optional[Dict[str, Any]]:
        matches = [
            node for node in connected_nodes
            if str(node.get("node_type") or "").upper() in node_types
        ]

        if not matches:
            return None

        return sorted(matches, key=score_node, reverse=True)[0]

    return {
        "most_connected_domain": top_node({"ATC1", "VA"}),
        "most_connected_disease": top_node({"DISEASE"}),
        "most_connected_mechanism": top_node({"MOA", "EPC", "PE"}),
        "most_connected_therapeutic_class": top_node({"ATC4", "ATC3", "ATC2", "ATC1"}),
    }


def build_claims_readiness_layer(
    master: Dict[str, Any],
    classifications: Dict[str, Any],
    relationships: Dict[str, Any],
) -> Dict[str, Any]:
    has_rxnorm = bool(master.get("rxcui"))
    has_atc = any(classifications.get(bucket) for bucket in ["ATC1", "ATC2", "ATC3", "ATC4"])
    has_disease = bool(classifications.get("DISEASE"))
    has_mechanism = bool(classifications.get("MOA") or classifications.get("EPC"))

    has_ndc = bool(
        relationships.get("ndcs")
        or relationships.get("ndc")
        or relationships.get("package_ndcs")
        or master.get("ndc_count")
        or master.get("ndc_package_count")
    )

    has_icd10 = bool(classifications.get("ICD10") or relationships.get("icd10"))
    has_hcpcs = bool(classifications.get("HCPCS") or relationships.get("hcpcs"))
    has_drg = bool(classifications.get("DRG") or relationships.get("drg") or relationships.get("drgs"))
    has_revenue_codes = bool(
        classifications.get("REVENUE_CODE")
        or relationships.get("revenue_codes")
        or relationships.get("revenue_code")
    )

    available_layers = {
        "rxnorm": has_rxnorm,
        "atc": has_atc,
        "ndc": has_ndc,
        "disease": has_disease,
        "mechanism": has_mechanism,
        "icd10": has_icd10,
        "hcpcs": has_hcpcs,
        "drg": has_drg,
        "drgs": has_drg,
        "revenue_codes": has_revenue_codes,
    }

    score = round(
        int(has_rxnorm) * 20
        + int(has_atc) * 20
        + int(has_ndc) * 15
        + int(has_disease) * 15
        + int(has_mechanism) * 15
        + int(has_icd10) * 5
        + int(has_hcpcs) * 5
        + int(has_drg) * 3
        + int(has_revenue_codes) * 2,
        1,
    )

    return {
        "claims_readiness_score": score,
        "claims_readiness_tier": (
            "Advanced" if score >= 80 else
            "Developing" if score >= 50 else
            "Foundational"
        ),
        "available_layers": available_layers,
        "next_required_layers": [
            key for key, value in available_layers.items()
            if not value and key != "drgs"
        ],
        "claims_foundation_layers": {
            "ndc": has_ndc,
            "icd10": has_icd10,
            "hcpcs": has_hcpcs,
            "drg": has_drg,
            "revenue_codes": has_revenue_codes,
        },
        "next_milestone": "Integrate ICD10, HCPCS, DRG, and revenue-code crosswalk tables.",
    }


# -----------------------------------------------------------------------------
# Explorer drug detail helpers
# -----------------------------------------------------------------------------

CLASSIFICATION_BUCKETS = [
    "ATC1",
    "ATC2",
    "ATC3",
    "ATC4",
    "MOA",
    "EPC",
    "DISEASE",
    "TC",
    "PE",
    "CHEM",
    "VA",
    "PK",
    "SCHEDULE",
    "DISPOS",
    "STRUCT",
    "CVX",
]

RELATIONSHIP_BUCKET_RULES = {
    "ingredients": ["ingredient", "has_ingredient", "tradename_of", "in"],
    "tradenames": ["tradename", "brand", "has_tradename", "bn"],
    "dose_forms": ["dose_form", "doseform", "has_dose_form", "df"],
    "related_concepts": [],
}


def get_first_value(row: Dict[str, Any], candidates: List[str]) -> Any:
    lower_map = {k.lower(): k for k in row.keys()}
    for candidate in candidates:
        actual = lower_map.get(candidate.lower())
        if actual and row.get(actual) not in (None, "", "nan", "None"):
            return row.get(actual)
    return None


def split_pipe_values(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, (int, float)):
        return []
    text = str(value).strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return []
    parts = []
    for chunk in text.replace(";", "|").split("|"):
        cleaned = chunk.strip()
        if cleaned and cleaned.lower() not in {"nan", "none", "null"}:
            parts.append(cleaned)
    return sorted(set(parts))


def compact_records(records: List[Dict[str, Any]], max_records: int = 250) -> List[Dict[str, Any]]:
    """Remove empty keys and cap payload size for frontend-friendly responses."""
    compacted: List[Dict[str, Any]] = []
    seen = set()
    for rec in records:
        cleaned = {k: v for k, v in rec.items() if v not in (None, "", "nan", "None")}
        key = tuple(sorted((k, str(v)) for k, v in cleaned.items()))
        if cleaned and key not in seen:
            compacted.append(cleaned)
            seen.add(key)
        if len(compacted) >= max_records:
            break
    return compacted


def fetch_rows_by_rxcui(conn: sqlite3.Connection, table_name: str, rxcui: str, limit: int = 1000) -> List[Dict[str, Any]]:
    if not table_exists(conn, table_name):
        return []
    columns = get_table_columns(conn, table_name)
    if "rxcui" not in [c.lower() for c in columns]:
        return []
    actual_rxcui_col = next(c for c in columns if c.lower() == "rxcui")
    rows = conn.execute(
        f'SELECT * FROM "{table_name}" WHERE CAST("{actual_rxcui_col}" AS TEXT) = ? LIMIT ?',
        (str(rxcui), limit),
    ).fetchall()
    return rows_to_dicts(rows)


def build_classification_payload(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {bucket: [] for bucket in CLASSIFICATION_BUCKETS}
    payload["other"] = []
    payload["raw_rows"] = compact_records(rows, max_records=300)

    for row in rows:
        class_type = get_first_value(
            row,
            [
                "classType",
                "class_type",
                "classification_classType",
                "classification_class_type",
                "classification_class_type_normalized",
            ],
        )
        class_id = get_first_value(row, ["classId", "class_id", "classification_classId", "classification_class_id"])
        class_name = get_first_value(row, ["className", "class_name", "classification_className", "classification_class_name"])
        class_url = get_first_value(row, ["classUrl", "class_url", "classification_classUrl", "classification_class_url"])
        rela = get_first_value(row, ["rela", "relationship", "classification_rela"])
        rela_source = get_first_value(row, ["relaSource", "rela_source", "classification_relaSource", "classification_rela_source"])

        record = {
            "class_type": class_type,
            "class_id": class_id,
            "class_name": class_name,
            "class_url": class_url,
            "rela": rela,
            "rela_source": rela_source,
        }

        bucket = str(class_type).upper().strip() if class_type is not None else "other"
        if bucket in payload:
            payload[bucket].append(record)
        else:
            payload["other"].append(record)

    # Also support one-row aggregated classification masters that pipe-concatenate values.
    for row in rows:
        for bucket in CLASSIFICATION_BUCKETS:
            for candidate in [bucket, bucket.lower(), f"classification_{bucket}", f"classification_{bucket.lower()}", f"{bucket}_className", f"classification_{bucket}_className"]:
                if candidate in row:
                    for value in split_pipe_values(row.get(candidate)):
                        payload[bucket].append({"class_type": bucket, "class_name": value})

    for key in list(payload.keys()):
        if key == "raw_rows":
            continue
        payload[key] = compact_records(payload[key], max_records=200)

    payload["counts"] = {
        key: len(value)
        for key, value in payload.items()
        if isinstance(value, list) and key != "raw_rows"
    }
    return payload


def infer_relationship_bucket(row: Dict[str, Any]) -> str:
    text_parts = []
    for key in ["rela", "relationship", "relaSource", "name", "tty", "termType", "rxnorm_name", "related_name"]:
        value = get_first_value(row, [key, f"relationship_{key}"])
        if value is not None:
            text_parts.append(str(value).lower())
    blob = " ".join(text_parts)

    for bucket, tokens in RELATIONSHIP_BUCKET_RULES.items():
        if bucket == "related_concepts":
            continue
        if any(token in blob for token in tokens):
            return bucket
    return "related_concepts"


def build_relationship_payload(rows: List[Dict[str, Any]]) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "ingredients": [],
        "tradenames": [],
        "dose_forms": [],
        "related_concepts": [],
        "raw_rows": compact_records(rows, max_records=300),
    }

    for row in rows:
        record = {
            "related_rxcui": get_first_value(row, ["related_rxcui", "rxaui", "conceptRxcui", "relationship_related_rxcui"]),
            "related_name": get_first_value(row, ["name", "related_name", "rxnorm_name", "relationship_name"]),
            "tty": get_first_value(row, ["tty", "termType", "relationship_tty", "relationship_termType"]),
            "rela": get_first_value(row, ["rela", "relationship", "relationship_rela"]),
            "rela_source": get_first_value(row, ["relaSource", "rela_source", "relationship_relaSource"]),
        }
        payload[infer_relationship_bucket(row)].append(record)

    # Also support one-row aggregated relationship masters.
    for row in rows:
        aggregate_candidates = {
            "ingredients": ["ingredient", "ingredients", "relationship_ingredient", "relationship_ingredients"],
            "tradenames": ["tradename", "tradenames", "brand", "brands", "relationship_tradename"],
            "dose_forms": ["dose_form", "dose_forms", "doseForm", "relationship_dose_form"],
            "related_concepts": ["name", "related_name", "relationship_name", "rela", "relationship_rela"],
        }
        for bucket, candidates in aggregate_candidates.items():
            for candidate in candidates:
                if candidate in row:
                    for value in split_pipe_values(row.get(candidate)):
                        payload[bucket].append({"related_name": value})

    for key in ["ingredients", "tradenames", "dose_forms", "related_concepts"]:
        payload[key] = compact_records(payload[key], max_records=200)

    payload["counts"] = {
        "ingredients": len(payload["ingredients"]),
        "tradenames": len(payload["tradenames"]),
        "dose_forms": len(payload["dose_forms"]),
        "related_concepts": len(payload["related_concepts"]),
        "raw_relationship_rows": len(rows),
    }
    return payload


# -----------------------------------------------------------------------------
# Core health and metadata endpoints
# -----------------------------------------------------------------------------

@app.get("/", tags=["System"])
def root() -> Dict[str, Any]:
    return {
        "name": APP_TITLE,
        "version": APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", response_model=HealthResponse, tags=["System"])
def health() -> HealthResponse:
    missing: List[str] = []
    if DB_PATH.exists():
        with sqlite3.connect(DB_PATH) as conn:
            for table in REQUIRED_TABLES:
                if not table_exists(conn, table):
                    missing.append(table)
    else:
        missing = REQUIRED_TABLES.copy()

    return HealthResponse(
        status="ok" if not missing else "degraded",
        database_path=str(DB_PATH),
        database_exists=DB_PATH.exists(),
        missing_required_tables=missing,
    )


@app.get("/ehi/v6/top100", tags=["Enterprise Healthcare Importance"])
def get_ehi_v6_top100() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_top100_rankings_v1")

        rows = conn.execute(
            """
            SELECT
                ehi_v6_rank,
                rxcui,
                drug_name,
                ehi_v6_score,
                ehi_v6_tier,
                methodology_version
            FROM ehi_v6_top100_rankings_v1
            ORDER BY ehi_v6_rank
            """
        ).fetchall()

        return rows_to_dicts(rows)


@app.get("/ehi/v6/methodology", tags=["Enterprise Healthcare Importance"])
def get_ehi_v6_methodology() -> Dict[str, Any]:
    return {
        "methodology_version": "EHI_V6_HYBRID_2026",
        "display_name": "EHI V6 Hybrid Methodology",
        "formula": "EHI_V6 = 0.15U + 0.20S + 0.15P + 0.20R + 0.10E + 0.10D + 0.10C",
        "weights": {
            "utilization_score": 0.15,
            "spend_score": 0.20,
            "population_impact_score": 0.15,
            "risk_score": 0.20,
            "external_evidence_score": 0.10,
            "disease_burden_score": 0.10,
            "cdc_burden_score": 0.10,
        },
        "tiers": {
            "Strategic Priority": "90-100",
            "Enterprise Critical": "80-89.99",
            "High Importance": "65-79.99",
            "Moderate Importance": "45-64.99",
            "Foundational": "<45",
        },
        "methodology_statement": (
            "The Enterprise Healthcare Importance (EHI) V6 methodology uses a hybrid "
            "weighting framework informed by H3A.9 statistical sensitivity analysis, "
            "coverage assessment, correlation review, and enterprise healthcare priorities."
        ),
    }


@app.get("/ehi/v6/{rxcui}", tags=["Enterprise Healthcare Importance"])
def get_ehi_v6(rxcui: str) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "enterprise_healthcare_importance_master_v6")

        row = conn.execute(
            """
            SELECT
                m.rxcui,
                m.drug_name,
                m.ehi_v6_score,
                m.ehi_v6_tier,
                t.ehi_v6_rank,
                m.utilization_score,
                m.spend_score,
                m.population_impact_score,
                m.risk_score,
                m.external_evidence_score,
                m.disease_burden_score,
                m.cdc_burden_score,
                m.methodology_version,
                m.created_at
            FROM enterprise_healthcare_importance_master_v6 m
            LEFT JOIN ehi_v6_top100_rankings_v1 t
                ON CAST(t.rxcui AS TEXT) = CAST(m.rxcui AS TEXT)
            WHERE CAST(m.rxcui AS TEXT) = ?
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"EHI V6 record not found for RxCUI {rxcui}")

        return dict(row)

@app.get("/metadata/tables", tags=["Metadata"])
def list_tables() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
        output = []
        for row in rows:
            table = row["name"]
            count = conn.execute(f'SELECT COUNT(*) AS row_count FROM "{table}"').fetchone()["row_count"]
            output.append({"table": table, "row_count": int(count)})
        return output


@app.get("/metadata/tables/{table_name}/columns", tags=["Metadata"])
def table_columns(table_name: str) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        validate_table(conn, table_name)
        rows = conn.execute(f'PRAGMA table_info("{table_name}")').fetchall()
        return [
            {
                "column_id": row[0],
                "column_name": row[1],
                "data_type": row[2],
                "not_null": bool(row[3]),
                "default_value": row[4],
                "primary_key": bool(row[5]),
            }
            for row in rows
        ]


# -----------------------------------------------------------------------------
# Website endpoints
# -----------------------------------------------------------------------------

@app.get("/website/summary", tags=["Website"])
def website_summary() -> List[Dict[str, Any]]:
    return read_table("website_summary_metrics_v1", limit=500)


@app.get("/website/tier-distribution", tags=["Website"])
def website_tier_distribution() -> List[Dict[str, Any]]:
    return read_table("website_tier_distribution_v1", limit=100)


@app.get("/website/score-distribution", tags=["Website"])
def website_score_distribution() -> List[Dict[str, Any]]:
    return read_table("website_score_distribution_v1", limit=500)


# -----------------------------------------------------------------------------
# Explorer endpoints
# -----------------------------------------------------------------------------

@app.get("/explorer/drugs", tags=["Intelligence Explorer"])
def explorer_drugs(
    q: Optional[str] = Query(default=None, description="Search by RxCUI or drug/name fields."),
    benchmark_tier: Optional[str] = Query(default=None, description="Filter by benchmark tier."),
    min_score: Optional[float] = Query(default=None, ge=0, le=100),
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    table_name = "intelligence_explorer_drug_cards_v1"
    with get_connection() as conn:
        validate_table(conn, table_name)
        columns = get_table_columns(conn, table_name)

        where_parts: List[str] = []
        params: List[Any] = []

        if q:
            search_where, search_params = build_search_where(columns, q)
            if search_where:
                where_parts.append("(" + search_where.replace(" WHERE ", "") + ")")
                params.extend(search_params)

        if benchmark_tier and "benchmark_tier" in columns:
            where_parts.append('LOWER(CAST("benchmark_tier" AS TEXT)) = ?')
            params.append(benchmark_tier.lower())

        if min_score is not None and "overall_intelligence_score" in columns:
            where_parts.append('CAST("overall_intelligence_score" AS REAL) >= ?')
            params.append(min_score)

        where_clause = " WHERE " + " AND ".join(where_parts) if where_parts else ""
        order_col = available_order_column(conn, table_name, ["overall_intelligence_score", "rxnorm_name", "rxcui"])
        order_clause = f' ORDER BY "{order_col}" DESC' if order_col and order_col != "rxnorm_name" else (f' ORDER BY "{order_col}" ASC' if order_col else "")

        query = f'SELECT * FROM "{table_name}"{where_clause}{order_clause} LIMIT ? OFFSET ?'
        rows = conn.execute(query, params + [limit, offset]).fetchall()
        return rows_to_dicts(rows)

def normalize_text(value: Any) -> str:
    return str(value or "").strip().lower()


def get_row_name(row: Dict[str, Any]) -> str:
    return (
        row.get("class_name")
        or row.get("label")
        or row.get("name")
        or row.get("class_id")
        or ""
    )


def rank_disease_focus(
    classifications: Dict[str, Any],
    graph_intelligence: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    disease_rows = classifications.get("DISEASE") or []

    if not isinstance(disease_rows, list) or not disease_rows:
        return {
            "primary_disease_focus": "Disease focus not yet populated",
            "ranked_diseases": [],
        }

    disease_priority = [
        ("pain", "Pain Management", 120),
        ("analges", "Pain Management", 115),
        ("inflamm", "Inflammation", 110),
        ("fever", "Fever", 105),
        ("pyrexia", "Fever", 100),
        ("musculoskeletal", "Musculoskeletal Disorders", 95),
        ("arthralgia", "Pain Management", 92),
        ("arthritis, rheumatoid", "Rheumatoid Arthritis", 86),
        ("rheumatoid", "Rheumatoid Arthritis", 84),
        ("osteoarthritis", "Osteoarthritis", 82),
        ("arthritis", "Arthritis", 72),
        ("bursitis", "Bursitis", 70),
        ("juvenile", "Juvenile Arthritis", 25),
        ("hypersensitivity", "Drug Hypersensitivity", 15),
    ]

    connected_disease_label = ""
    if graph_intelligence:
        connected_disease = graph_intelligence.get("most_connected_disease") or {}
        connected_disease_label = normalize_text(connected_disease.get("label"))

    ranked = []

    for row in disease_rows:
        row_dict = dict(row)
        raw_name = get_row_name(row_dict)
        name = normalize_text(raw_name)

        semantic_score = 10
        display_label = raw_name or "Unknown disease mapping"

        for term, label, score in disease_priority:
            if term in name:
                semantic_score = score
                display_label = label
                break

        connection_score = 0
        if connected_disease_label and connected_disease_label in name:
            connection_score = 40

        occurrence_score = int(row_dict.get("occurrence_count") or row_dict.get("evidence_count") or 0)
        hierarchy_score = int(row_dict.get("is_high_value_node") or row_dict.get("is_primary_edge") or 0) * 10

        total_score = semantic_score + connection_score + occurrence_score + hierarchy_score

        ranked.append(
            {
                "class_id": row_dict.get("class_id"),
                "class_name": raw_name,
                "display_label": display_label,
                "score": total_score,
                "semantic_score": semantic_score,
                "connection_score": connection_score,
                "occurrence_score": occurrence_score,
            }
        )

    ranked = sorted(
        ranked,
        key=lambda item: (
            -item["score"],
            -item["semantic_score"],
            normalize_text(item["display_label"]),
        ),
    )

    return {
        "primary_disease_focus": ranked[0]["display_label"] if ranked else "Disease focus not yet populated",
        "ranked_diseases": ranked[:10],
    }


def build_graph_intelligence_v2(
    graph_payload: Dict[str, Any],
    primary_therapeutic_pathway: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    nodes = graph_payload.get("nodes") or []
    edges = graph_payload.get("edges") or []

    center_rxcui = str(graph_payload.get("center_rxcui") or "")
    center_node_id = graph_payload.get("center_node_id") or f"drug:{center_rxcui}"

    node_lookup = {
        node.get("node_id"): node
        for node in nodes
        if node.get("node_id")
    }

    connected_node_ids = set()

    for edge in edges:
        source = edge.get("source_node_id") or edge.get("source") or edge.get("source_node")
        target = edge.get("target_node_id") or edge.get("target") or edge.get("target_node")

        if source == center_node_id and target:
            connected_node_ids.add(target)

        if target == center_node_id and source:
            connected_node_ids.add(source)

    connected_nodes = [
        node_lookup[node_id]
        for node_id in connected_node_ids
        if node_id in node_lookup
    ]

    if not connected_nodes:
        connected_nodes = nodes

    primary_pathway = (primary_therapeutic_pathway or {}).get("pathway") or []
    primary_atc_ids = {
        str(item.get("class_id") or "").upper()
        for item in primary_pathway
        if item.get("class_id")
    }

    primary_atc_names = {
        normalize_text(item.get("class_name"))
        for item in primary_pathway
        if item.get("class_name")
    }

    def node_score(node: Dict[str, Any]) -> tuple:
        node_type = str(node.get("node_type") or "").upper()
        label = normalize_text(node.get("label"))
        class_id = str(node.get("class_id") or "").upper()

        occurrence_count = int(node.get("occurrence_count") or 0)
        evidence_count = int(node.get("evidence_count") or 0)
        is_high_value = int(node.get("is_high_value_node") or 0)

        primary_pathway_bonus = 0
        if class_id and class_id in primary_atc_ids:
            primary_pathway_bonus += 10000

        if label and label in primary_atc_names:
            primary_pathway_bonus += 10000

        if node_type == "ATC1" and ("musculo" in label or class_id == "M"):
            primary_pathway_bonus += 5000

        type_priority = {
            "ATC1": 900,
            "ATC2": 800,
            "ATC3": 700,
            "ATC4": 600,
            "DISEASE": 550,
            "MOA": 500,
            "EPC": 450,
            "PE": 400,
            "VA": 350,
        }.get(node_type, 0)

        return (
            primary_pathway_bonus,
            type_priority,
            is_high_value,
            occurrence_count,
            evidence_count,
            label,
        )

    def top_node(node_types: set[str]) -> Optional[Dict[str, Any]]:
        matches = [
            node
            for node in connected_nodes
            if str(node.get("node_type") or "").upper() in node_types
        ]

        if not matches:
            return None

        return sorted(matches, key=node_score, reverse=True)[0]

    most_connected_domain = top_node({"ATC1"})
    most_connected_disease = top_node({"DISEASE"})
    most_connected_mechanism = top_node({"MOA", "EPC", "PE"})
    most_connected_therapeutic_class = top_node({"ATC4", "ATC3", "ATC2", "ATC1"})

    return {
        "most_connected_domain": most_connected_domain,
        "most_connected_disease": most_connected_disease,
        "most_connected_mechanism": most_connected_mechanism,
        "most_connected_therapeutic_class": most_connected_therapeutic_class,
        "connected_node_count": len(connected_nodes),
        "ranking_version": "15C.1-graph-intelligence-v2",
    }


def normalize_disease_text(value: Any) -> str:
    return str(value or "").strip().lower()


def get_disease_bucket(class_name: str, therapeutic_domain: str, mechanism: str, pharmacologic_class: str) -> Dict[str, Any]:
    name = normalize_disease_text(class_name)
    domain = normalize_disease_text(therapeutic_domain)
    moa = normalize_disease_text(mechanism)
    epc = normalize_disease_text(pharmacologic_class)

    score = 0
    bucket = "General Clinical Mapping"
    rationale = []

    negative_terms = [
        "drug hypersensitivity",
        "hypersensitivity",
        "poisoning",
        "toxicity",
        "adverse",
        "contraindication",
        "drug eruption",
        "anaphylaxis",
        "allergy",
        "allergic",
        "side effect",
    ]

    if any(term in name for term in negative_terms):
        score -= 500
        bucket = "Safety / Adverse Event Mapping"
        rationale.append("deprioritized because this appears to be a safety or adverse-event mapping")

    pain_terms = [
        "pain",
        "postoperative pain",
        "inflammation",
        "osteoarthritis",
        "arthritis",
        "rheumatoid",
        "bursitis",
        "dysmenorrhea",
        "spondylitis",
        "gout",
        "fever",
    ]

    if any(term in name for term in pain_terms):
        score += 180
        bucket = "Pain Management"
        rationale.append("prioritized because disease evidence aligns with pain, inflammation, or musculoskeletal care")

    diabetes_terms = [
        "diabetes",
        "diabetes mellitus",
        "type 2 diabetes",
        "hyperglycemia",
        "glucose",
        "obesity",
        "overweight",
        "weight",
        "metabolic syndrome",
    ]

    if any(term in name for term in diabetes_terms):
        score += 220
        bucket = "Type 2 Diabetes / Metabolic Disease"
        rationale.append("prioritized because disease evidence aligns with diabetes, metabolic, or weight-management care")

    cardiovascular_terms = [
        "myocardial",
        "stroke",
        "thrombosis",
        "cardiovascular",
        "coronary",
        "ischemic",
        "platelet",
        "embolism",
        "infarction",
        "angina",
        "atherosclerosis",
    ]

    if any(term in name for term in cardiovascular_terms):
        score += 220
        bucket = "Cardiovascular Prevention"
        rationale.append("prioritized because disease evidence aligns with cardiovascular prevention or vascular risk")

    infection_terms = [
        "infection",
        "bacterial",
        "pneumonia",
        "urinary tract",
        "sinusitis",
        "sepsis",
        "cellulitis",
        "otitis",
        "conjunctivitis",
    ]

    if any(term in name for term in infection_terms):
        score += 200
        bucket = "Infectious Disease Treatment"
        rationale.append("prioritized because disease evidence aligns with antiinfective treatment")

    gastro_terms = [
        "gastroesophageal reflux",
        "heartburn",
        "ulcer",
        "duodenal ulcer",
        "stomach ulcer",
        "zollinger",
        "esophagitis",
        "helicobacter",
        "gastric",
        "acid",
    ]

    if any(term in name for term in gastro_terms):
        score += 220
        bucket = "Gastrointestinal Acid Suppression"
        rationale.append("prioritized because disease evidence aligns with acid suppression, reflux, ulcer, or gastrointestinal care")

    respiratory_terms = [
        "asthma",
        "rhinitis",
        "bronchial",
        "copd",
        "respiratory",
        "bronchitis",
    ]

    if any(term in name for term in respiratory_terms):
        score += 80
        bucket = "Respiratory / Allergy Mapping"
        rationale.append("secondary respiratory or allergy-related mapping")

    if "musculo" in domain or "anti-inflammatory" in epc or "cyclooxygenase" in moa:
        if bucket == "Pain Management":
            score += 120
            rationale.append("boosted because therapeutic domain/mechanism supports NSAID pain and inflammation use")

    if "alimentary" in domain or "glp" in epc or "glucagon-like" in moa:
        if bucket == "Type 2 Diabetes / Metabolic Disease":
            score += 150
            rationale.append("boosted because therapeutic domain/mechanism supports metabolic disease management")

    if "cardiovascular" in domain or "platelet" in epc:
        if bucket == "Cardiovascular Prevention":
            score += 150
            rationale.append("boosted because therapeutic domain/pharmacologic class supports cardiovascular prevention")

    if "antiinfective" in domain or "quinolone" in epc or "fluoroquinolone" in epc:
        if bucket == "Infectious Disease Treatment":
            score += 120
            rationale.append("boosted because therapeutic domain/pharmacologic class supports systemic antiinfective use")

    if "proton pump" in moa or "proton pump" in epc:
        if bucket == "Gastrointestinal Acid Suppression":
            score += 150
            rationale.append("boosted because mechanism/pharmacologic class supports acid suppression")

    if not rationale:
        rationale.append("retained as supporting clinical semantic evidence")

    return {
        "disease_name": class_name,
        "executive_bucket": bucket,
        "score": score,
        "rationale": "; ".join(rationale),
    }


def build_disease_focus_ranking_layer(
    classifications: Dict[str, Any],
    medication_summary: Dict[str, Any],
) -> Dict[str, Any]:
    disease_rows = classifications.get("DISEASE") or classifications.get("disease") or []

    therapeutic_domain = medication_summary.get("primary_therapeutic_domain") or ""
    mechanism = medication_summary.get("primary_mechanism") or ""
    pharmacologic_class = medication_summary.get("primary_pharmacologic_class") or ""

    ranked = []

    for row in disease_rows:
        disease_name = (
            row.get("class_name")
            or row.get("class_id")
            or "Unknown Disease Mapping"
        )

        ranked.append(
            get_disease_bucket(
                class_name=disease_name,
                therapeutic_domain=therapeutic_domain,
                mechanism=mechanism,
                pharmacologic_class=pharmacologic_class,
            )
        )

    ranked = sorted(
        ranked,
        key=lambda item: (
            -item["score"],
            item["disease_name"].lower(),
        ),
    )

    primary = ranked[0] if ranked else None
    secondary = ranked[1] if len(ranked) > 1 else None
    tertiary = ranked[2] if len(ranked) > 2 else None

    return {
        "primary_disease_focus": primary["executive_bucket"] if primary else "Not available",
        "primary_disease_mapping": primary["disease_name"] if primary else None,
        "secondary_disease_focus": secondary["executive_bucket"] if secondary else None,
        "secondary_disease_mapping": secondary["disease_name"] if secondary else None,
        "tertiary_disease_focus": tertiary["executive_bucket"] if tertiary else None,
        "tertiary_disease_mapping": tertiary["disease_name"] if tertiary else None,
        "ranked_disease_mappings": ranked[:10],
        "ranking_version": "15D.1-disease-focus-ranking-layer",
    }

def infer_executive_disease_focus_from_therapy(
    medication_summary: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    domain = normalize_disease_text(medication_summary.get("primary_therapeutic_domain"))
    mechanism = normalize_disease_text(medication_summary.get("primary_mechanism"))
    pharmacologic_class = normalize_disease_text(medication_summary.get("primary_pharmacologic_class"))

    combined = f"{domain} {mechanism} {pharmacologic_class}"

    if (
        "glp" in combined
        or "glucagon-like peptide" in combined
        or "diabetes" in combined
        or "blood glucose" in combined
        or "alimentary tract and metabolism" in combined
    ):
        return {
            "primary_disease_focus": "Type 2 Diabetes / Metabolic Disease",
            "primary_disease_mapping": "Therapeutic inference from GLP-1 / metabolic pathway",
            "secondary_disease_focus": "Weight Management / Obesity",
            "secondary_disease_mapping": "Therapeutic inference from metabolic disease pathway",
            "tertiary_disease_focus": "Cardiometabolic Risk Management",
            "tertiary_disease_mapping": "Therapeutic inference from metabolic disease pathway",
            "ranking_version": "15D.1-therapeutic-disease-inference",
        }

    if "proton pump" in combined or "gastric" in combined or "acid" in combined:
        return {
            "primary_disease_focus": "Gastrointestinal Acid Suppression",
            "primary_disease_mapping": "Therapeutic inference from proton pump inhibitor pathway",
            "secondary_disease_focus": "Gastroesophageal Reflux / Ulcer Disease",
            "secondary_disease_mapping": "Therapeutic inference from acid suppression pathway",
            "tertiary_disease_focus": "Gastrointestinal Disease Management",
            "tertiary_disease_mapping": "Therapeutic inference from gastrointestinal pathway",
            "ranking_version": "15D.1-therapeutic-disease-inference",
        }

    return None


def apply_disease_focus_ranking_layer(
    classifications: Dict[str, Any],
    medication_summary: Dict[str, Any],
) -> Dict[str, Any]:
    medication_summary = dict(medication_summary or {})

    disease_focus_layer = build_disease_focus_ranking_layer(
        classifications=classifications,
        medication_summary=medication_summary,
    )

    primary_focus = disease_focus_layer.get("primary_disease_focus")
    primary_mapping = disease_focus_layer.get("primary_disease_mapping")

    weak_focus_values = {
        "General Clinical Mapping",
        "Safety / Adverse Event Mapping",
        "Not available",
        None,
        "",
    }

    is_weak_or_unhelpful = (
        primary_focus in weak_focus_values
        or normalize_disease_text(primary_mapping) in {
            "drug hypersensitivity",
            "carcinoma, neuroendocrine",
            "multiple endocrine neoplasia type 2a",
            "multiple endocrine neoplasia type 2b",
            "thyroid neoplasms",
        }
    )

    inferred_focus = (
        infer_executive_disease_focus_from_therapy(medication_summary)
        if is_weak_or_unhelpful
        else None
    )

    if inferred_focus:
        medication_summary["primary_disease_focus"] = inferred_focus.get("primary_disease_focus")
        medication_summary["primary_disease_mapping"] = inferred_focus.get("primary_disease_mapping")
        medication_summary["secondary_disease_focus"] = inferred_focus.get("secondary_disease_focus")
        medication_summary["secondary_disease_mapping"] = inferred_focus.get("secondary_disease_mapping")
        medication_summary["tertiary_disease_focus"] = inferred_focus.get("tertiary_disease_focus")
        medication_summary["tertiary_disease_mapping"] = inferred_focus.get("tertiary_disease_mapping")
        medication_summary["disease_focus_ranking_layer"] = {
            **disease_focus_layer,
            "therapeutic_inference_applied": True,
            "therapeutic_inference": inferred_focus,
        }
        return medication_summary

    medication_summary["primary_disease_focus"] = disease_focus_layer.get("primary_disease_focus")
    medication_summary["primary_disease_mapping"] = disease_focus_layer.get("primary_disease_mapping")
    medication_summary["secondary_disease_focus"] = disease_focus_layer.get("secondary_disease_focus")
    medication_summary["secondary_disease_mapping"] = disease_focus_layer.get("secondary_disease_mapping")
    medication_summary["tertiary_disease_focus"] = disease_focus_layer.get("tertiary_disease_focus")
    medication_summary["tertiary_disease_mapping"] = disease_focus_layer.get("tertiary_disease_mapping")
    medication_summary["disease_focus_ranking_layer"] = {
        **disease_focus_layer,
        "therapeutic_inference_applied": False,
    }

    return medication_summary


def build_medication_intelligence_summary_v2(
    master: Dict[str, Any],
    classifications: Dict[str, Any],
    primary_therapeutic_pathway: Dict[str, Any],
    graph_intelligence: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    pathway = primary_therapeutic_pathway.get("pathway") or []

    primary_domain = ""
    if pathway:
        primary_domain = pathway[0].get("class_name") or pathway[0].get("class_id") or ""

    moa_rows = classifications.get("MOA") or []
    epc_rows = classifications.get("EPC") or []

    primary_mechanism = ""
    if moa_rows:
        primary_mechanism = get_row_name(dict(moa_rows[0]))

    primary_pharmacologic_class = ""
    if epc_rows:
        primary_pharmacologic_class = get_row_name(dict(epc_rows[0]))

    disease_result = rank_disease_focus(classifications, graph_intelligence)

    total_classifications = sum(
        len(value)
        for key, value in classifications.items()
        if key != "counts" and isinstance(value, list)
    )

    populated_domains = [
        key
        for key, value in classifications.items()
        if key != "counts" and isinstance(value, list) and len(value) > 0
    ]

    return {
        "primary_therapeutic_domain": primary_domain or "Therapeutic domain not yet populated",
        "primary_mechanism": primary_mechanism or "Mechanism evidence not yet populated",
        "primary_disease_focus": disease_result["primary_disease_focus"],
        "ranked_disease_focus": disease_result["ranked_diseases"],
        "primary_pharmacologic_class": primary_pharmacologic_class or "Pharmacologic class not yet populated",
        "classification_breadth": total_classifications,
        "populated_intelligence_domains": len(populated_domains),
        "populated_domains": populated_domains,
        "summary_version": "15C.1-medication-summary-v2",
    }


def build_therapeutic_narrative_v2(
    master: Dict[str, Any],
    summary: Dict[str, Any],
) -> Dict[str, Any]:
    drug_name = (
        master.get("rxnorm_name")
        or master.get("drug_name")
        or master.get("display_name")
        or "This medication"
    )

    domain = summary.get("primary_therapeutic_domain") or "its primary therapeutic domain"
    mechanism = summary.get("primary_mechanism") or "available mechanism evidence"
    disease_focus = summary.get("primary_disease_focus") or "mapped clinical conditions"
    pharmacologic_class = summary.get("primary_pharmacologic_class") or "its pharmacologic class"

    narrative = (
        f"{drug_name} is positioned within the {domain} therapeutic domain. "
        f"Its pharmacologic evidence maps to {mechanism} and {pharmacologic_class}. "
        f"The medication is most meaningfully associated with {disease_focus}, supporting clinical interpretation, "
        f"claims mapping, semantic enrichment, and downstream AI explainability."
    )

    return {
        "headline": f"{drug_name} therapeutic intelligence narrative",
        "primary_domain": domain,
        "primary_mechanism": mechanism,
        "primary_disease_focus": disease_focus,
        "primary_pharmacologic_class": pharmacologic_class,
        "narrative": narrative,
        "narrative_version": "15C.1-therapeutic-narrative-v2",
    }




# -----------------------------------------------------------------------------
# H3C.1 — CDC Population Burden Intelligence helpers
# -----------------------------------------------------------------------------

def build_population_burden_payload(
    conn: sqlite3.Connection,
    rxcui: str,
    medication_intelligence_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Return narrative-first CDC PLACES population burden context.

    This intentionally does not return a new visible score. It exposes a tier,
    prevalence benchmark, and executive narrative for Clinical Intelligence.
    """
    if not table_exists(conn, "drug_population_burden_mapping_v1"):
        summary = medication_intelligence_summary or {}
        primary_condition = (
            summary.get("primary_disease_focus")
            or summary.get("primary_disease_mapping")
            or "Disease focus not yet populated"
        )
        return {
            "available": False,
            "tier": "Not Available",
            "primary_condition": primary_condition,
            "prevalence_benchmark": "CDC PLACES population burden has not been integrated yet.",
            "narrative": (
                "CDC PLACES population burden context has not been generated for this medication yet. "
                "Run H3C.1 to create drug_population_burden_mapping_v1."
            ),
            "methodology_version": "H3C1_CDC_PLACES_POPULATION_BURDEN_INTELLIGENCE_V1",
        }

    row = conn.execute(
        """
        SELECT *
        FROM drug_population_burden_mapping_v1
        WHERE CAST(rxcui AS TEXT) = ?
        LIMIT 1
        """,
        (str(rxcui),),
    ).fetchone()

    if row is None:
        summary = medication_intelligence_summary or {}
        primary_condition = (
            summary.get("primary_disease_focus")
            or summary.get("primary_disease_mapping")
            or "Disease focus not yet populated"
        )
        return {
            "available": False,
            "tier": "Not Available",
            "primary_condition": primary_condition,
            "prevalence_benchmark": "No CDC PLACES population burden mapping found for this medication.",
            "narrative": (
                f"No CDC PLACES population burden mapping was found for {primary_condition}. "
                "The clinical dashboard can still use therapeutic and disease evidence, but population prevalence context is not yet available."
            ),
            "methodology_version": "H3C1_CDC_PLACES_POPULATION_BURDEN_INTELLIGENCE_V1",
        }

    item = dict(row)
    return {
        "available": True,
        "tier": item.get("population_burden_tier"),
        "primary_condition": item.get("primary_disease_focus") or item.get("disease_domain"),
        "disease_domain": item.get("disease_domain"),
        "places_measure": item.get("cdc_places_measure"),
        "places_prevalence": item.get("cdc_places_prevalence"),
        "population_burden_proxy": item.get("cdc_places_population_burden_proxy"),
        "prevalence_rank": item.get("population_prevalence_rank"),
        "burden_rank": item.get("population_burden_rank"),
        "prevalence_benchmark": item.get("population_prevalence_benchmark"),
        "narrative": item.get("population_burden_narrative"),
        "source_year": item.get("source_year"),
        "source_dataset": item.get("source_dataset"),
        "methodology_version": item.get("methodology_version"),
        "raw": item,
    }


@app.get("/explorer/drug-detail/{rxcui}", tags=["Intelligence Explorer"])
def explorer_drug_full_detail(
    rxcui: str,
    include_raw: bool = Query(default=False, description="Include raw classification/relationship rows for audit/debugging."),
    include_graph: bool = Query(default=True, description="Include a small graph subgraph for the selected RxCUI."),
) -> Dict[str, Any]:
    """
    Full Explorer detail payload for a selected RxCUI.
    """

    endpoint_start = time.perf_counter()

    def log_step(step_name: str, step_start: float) -> float:
        elapsed = time.perf_counter() - step_start
        total = time.perf_counter() - endpoint_start
        print(f"[TIMING] {rxcui} | {step_name}: {elapsed:.3f}s | total: {total:.3f}s")
        return time.perf_counter()

    step_start = time.perf_counter()

    with get_connection() as conn:
        validate_table(conn, "drug_intelligence_master_v1")
        step_start = log_step("validate_table", step_start)

        master_row = conn.execute(
            'SELECT * FROM "drug_intelligence_master_v1" WHERE CAST(rxcui AS TEXT) = ? LIMIT 1',
            (str(rxcui),),
        ).fetchone()
        step_start = log_step("master_row", step_start)

        if master_row is None:
            raise HTTPException(status_code=404, detail=f"RxCUI not found: {rxcui}")

        master = dict(master_row)

        def fetch_optional_framework_row(table_name: str) -> Dict[str, Any]:
            if not table_exists(conn, table_name):
                return {}

            row = conn.execute(
                f'SELECT * FROM "{table_name}" WHERE rxcui = ? LIMIT 1',
                (str(rxcui),),
            ).fetchone()

            if row is None:
                row = conn.execute(
                    f'SELECT * FROM "{table_name}" WHERE CAST(rxcui AS TEXT) = ? LIMIT 1',
                    (str(rxcui),),
                ).fetchone()

            return dict(row) if row else {}

        ehi_v6_record = {}
        if table_exists(conn, "enterprise_healthcare_importance_master_v6"):
            ehi_v6_row = conn.execute(
                """
                SELECT
                    m.*,
                    t.ehi_v6_rank
                FROM enterprise_healthcare_importance_master_v6 m
                LEFT JOIN ehi_v6_top100_rankings_v1 t
                    ON CAST(t.rxcui AS TEXT) = CAST(m.rxcui AS TEXT)
                WHERE CAST(m.rxcui AS TEXT) = ?
                LIMIT 1
                """,
                (str(rxcui),),
            ).fetchone()
            ehi_v6_record = dict(ehi_v6_row) if ehi_v6_row else {}
        eii_record = fetch_optional_framework_row("eii_master_v1")
        eis_record = fetch_optional_framework_row("eis_master_v1")
        step_start = log_step("executive_framework_rows", step_start)

        classification_rows = fetch_rows_by_rxcui(
            conn,
            "research_classification_detail",
            rxcui,
            limit=5000,
        )
        step_start = log_step("classification_rows", step_start)

        relationship_rows = fetch_rows_by_rxcui(
            conn,
            "research_relationship_detail",
            rxcui,
            limit=5000,
        )
        step_start = log_step("relationship_rows", step_start)

        classifications = build_classification_payload(classification_rows)
        step_start = log_step("build_classification_payload", step_start)
        primary_therapeutic_pathway = build_primary_therapeutic_pathway(classification_rows)
        relationships = build_relationship_payload(relationship_rows)
        step_start = log_step("build_relationship_payload", step_start)

        similar_medications = get_weighted_medication_similarity_engine(
            conn,
            rxcui,
            limit=10,
        )
        step_start = log_step("similar_medications", step_start)


    graph_payload: Dict[str, Any] = {"center_rxcui": rxcui, "nodes": [], "edges": []}

    if include_graph:
        try:
            graph_payload = graph_subgraph(rxcui=rxcui, edge_limit=250)
        except Exception as error:
            print(f"Graph payload failed for RxCUI {rxcui}: {error}")
            graph_payload = {"center_rxcui": rxcui, "nodes": [], "edges": []}

    graph_intelligence = build_graph_intelligence_v2(
        graph_payload,
        primary_therapeutic_pathway,
    )

    graph_intelligence = align_graph_intelligence_to_primary_pathway(
        graph_intelligence=graph_intelligence,
        primary_therapeutic_pathway=primary_therapeutic_pathway,
    )

    medication_intelligence_summary = build_medication_intelligence_summary_v2(
        master,
        classifications,
        primary_therapeutic_pathway,
        graph_intelligence,
    )

    medication_intelligence_summary = apply_disease_focus_ranking_layer(
        classifications=classifications,
        medication_summary=medication_intelligence_summary,
    )

    therapeutic_narrative = build_therapeutic_narrative_v2(
        master,
        medication_intelligence_summary,
    )

    claims_readiness_layer = build_claims_readiness_layer(
        master,
        classifications,
        relationships,
    )

    executive_intelligence = build_executive_intelligence_polish_15d(
        master=master,
        medication_intelligence_summary=medication_intelligence_summary,
        claims_readiness_layer=claims_readiness_layer,
    )

    population_burden = build_population_burden_payload(
        conn=conn,
        rxcui=rxcui,
        medication_intelligence_summary=medication_intelligence_summary,
    )

    def framework_value(record: Dict[str, Any], *keys: str) -> Any:
        for key in keys:
            value = record.get(key)
            if value not in (None, "", "nan", "None"):
                return value
        return None

    ehi_v6_payload = {
        "score": framework_value(ehi_v6_record, "ehi_v6_score", "ehi_score"),
        "rank": framework_value(ehi_v6_record, "ehi_v6_rank", "ehi_rank"),
        "percentile": framework_value(ehi_v6_record, "ehi_v6_percentile", "ehi_percentile"),
        "tier_label": framework_value(ehi_v6_record, "ehi_v6_tier", "ehi_v6_tier_label", "ehi_tier_label"),
        "validation_score": framework_value(ehi_v6_record, "ehi_v6_validation_score"),
        "validation_status": framework_value(ehi_v6_record, "ehi_v6_validation_status"),
        "framework_version": framework_value(ehi_v6_record, "methodology_version", "ehi_v6_framework_version"),
        "weighting_method": framework_value(ehi_v6_record, "ehi_v6_weighting_method") or "Hybrid Enterprise Methodology",
        "dashboard_language": framework_value(ehi_v6_record, "ehi_v6_dashboard_language") or "EHI V6 Hybrid Methodology",
        "raw": ehi_v6_record,
    }

    eii_payload = {
        "score": framework_value(eii_record, "eii_score"),
        "rank": framework_value(eii_record, "eii_rank"),
        "percentile": framework_value(eii_record, "eii_percentile"),
        "tier": framework_value(eii_record, "eii_tier"),
        "framework_version": framework_value(eii_record, "eii_framework_version"),
        "weighting_method": framework_value(eii_record, "eii_weighting_method"),
        "raw": eii_record,
    }

    eis_payload = {
        "score": framework_value(eis_record, "eis_score"),
        "rank": framework_value(eis_record, "eis_rank"),
        "percentile": framework_value(eis_record, "eis_percentile"),
        "tier": framework_value(eis_record, "eis_tier"),
        "framework_version": framework_value(eis_record, "eis_framework_version"),
        "weighting_method": framework_value(eis_record, "eis_weighting_method"),
        "portfolio_value_score": framework_value(eis_record, "portfolio_value_score"),
        "strategic_opportunity_score": framework_value(eis_record, "strategic_opportunity_score"),
        "deployment_readiness_score": framework_value(eis_record, "deployment_readiness_score"),
        "raw": eis_record,
    }

    executive_impact = {
        "executive_impact_score": eis_payload.get("score"),
        "executive_impact_rank": eis_payload.get("rank"),
        "executive_impact_percentile": eis_payload.get("percentile"),
        "executive_impact_tier": eis_payload.get("tier"),
        "healthcare_importance_score": ehi_v6_payload.get("score"),
        "healthcare_importance_tier": ehi_v6_payload.get("tier_label"),
        "enterprise_intelligence_score": eii_payload.get("score"),
        "enterprise_intelligence_tier": eii_payload.get("tier"),
        "validation_score": ehi_v6_payload.get("validation_score"),
        "validation_status": ehi_v6_payload.get("validation_status"),
        "framework_version": "H3A10E_EXECUTIVE_IMPACT_FRAMEWORK",
    }

    return {
        "rxcui": str(rxcui),
        "drug": master,
        "scorecard": {
            "overall_intelligence_score": master.get("overall_intelligence_score"),
            "benchmark_tier": master.get("benchmark_tier"),
            "score_band": master.get("score_band"),
            "claims_readiness_score": master.get("claims_readiness_score"),
            "ai_readiness_score": master.get("ai_readiness_score"),
            "semantic_richness_score": master.get("semantic_richness_score"),
            "interoperability_score": master.get("interoperability_score"),
            "clinical_semantics_score": master.get("clinical_semantics_score"),
            "relationship_density_score": master.get("relationship_density_score"),
            "classification_density_score": master.get("classification_density_score"),
            "ehi_v6_score": ehi_v6_payload.get("score"),
            "ehi_v6_rank": ehi_v6_payload.get("rank"),
            "ehi_v6_percentile": ehi_v6_payload.get("percentile"),
            "ehi_v6_tier_label": ehi_v6_payload.get("tier_label"),
            "ehi_v6_validation_score": ehi_v6_payload.get("validation_score"),
            "ehi_v6_validation_status": ehi_v6_payload.get("validation_status"),
            "eii_score": eii_payload.get("score"),
            "eii_rank": eii_payload.get("rank"),
            "eii_percentile": eii_payload.get("percentile"),
            "eii_tier": eii_payload.get("tier"),
            "eis_score": eis_payload.get("score"),
            "eis_rank": eis_payload.get("rank"),
            "eis_percentile": eis_payload.get("percentile"),
            "eis_tier": eis_payload.get("tier"),
        },
        "ehi_v6": ehi_v6_payload,
        "eii": eii_payload,
        "eis": eis_payload,
        "executive_impact": executive_impact,
        "classifications": classifications,
        "relationships": relationships,
        "similar_medications": similar_medications,
        "primary_therapeutic_pathway": primary_therapeutic_pathway,
        "graph": graph_payload,
        "graph_metrics": graph_payload.get("metrics", {}),
        "medication_intelligence_summary": medication_intelligence_summary,
        "therapeutic_narrative": therapeutic_narrative,
        "graph_intelligence": graph_intelligence,
        "claims_readiness_layer": claims_readiness_layer,
        "executive_intelligence": executive_intelligence,
        "population_burden": population_burden,
    }

def get_weighted_medication_similarity_engine(
    conn: sqlite3.Connection,
    rxcui: str,
    limit: int = 10,
) -> List[Dict[str, Any]]:
    selected_rxcui = str(rxcui)

    feature_types = ("ATC4", "ATC3", "MOA", "EPC", "VA", "DISEASE")
    allowed_ttys = {"IN", "MIN", "PIN", "BN"}
    suppressed_ttys = {"SCD", "SBD", "SCDC", "SBDC"}

    weights = {
        "ATC4": 30,
        "ATC3": 22,
        "DISEASE": 20,
        "VA": 15,
        "MOA": 10,
        "EPC": 5,
    }

    tty_rank = {
        "IN": 1,
        "MIN": 2,
        "PIN": 3,
        "BN": 4,
        "SCD": 50,
        "SBD": 51,
        "SCDC": 52,
        "SBDC": 53,
    }

    selected_master = conn.execute(
        """
        SELECT COALESCE(rxnorm_name, drug_name, '') AS drug_name,
               COALESCE(tty, term_type, '') AS tty
        FROM drug_intelligence_master_v1
        WHERE CAST(rxcui AS TEXT) = ?
        LIMIT 1
        """,
        (selected_rxcui,),
    ).fetchone()

    selected_drug_name = ""
    selected_tty = ""

    if selected_master:
        selected_drug_name = normalize_text(selected_master["drug_name"])
        selected_tty = str(selected_master["tty"] or "").upper()

    selected_rows = conn.execute(
        """
        SELECT DISTINCT class_type, class_id, class_name
        FROM research_classification_detail
        WHERE CAST(rxcui AS TEXT) = ?
          AND class_id IS NOT NULL
          AND TRIM(class_id) <> ''
          AND class_type IN ('ATC4', 'ATC3', 'MOA', 'EPC', 'VA', 'DISEASE')
        """,
        (selected_rxcui,),
    ).fetchall()

    selected_features = {feature_type: set() for feature_type in feature_types}
    feature_names: Dict[str, str] = {}

    for row in selected_rows:
        class_type = row["class_type"]
        class_id = row["class_id"]

        if class_type in selected_features:
            selected_features[class_type].add(class_id)
            feature_names[class_id] = row["class_name"] or class_id

    if not any(selected_features.values()):
        return []

    shared_pairs = [
        (class_type, class_id)
        for class_type, class_ids in selected_features.items()
        for class_id in class_ids
    ]

    if not shared_pairs:
        return []

    where_clauses = []
    params: List[Any] = [selected_rxcui]

    for class_type, class_id in shared_pairs:
        where_clauses.append("(c.class_type = ? AND c.class_id = ?)")
        params.extend([class_type, class_id])

    candidate_rows = conn.execute(
        f"""
        SELECT DISTINCT
            CAST(c.rxcui AS TEXT) AS rxcui,
            COALESCE(m.rxnorm_name, m.drug_name, CAST(c.rxcui AS TEXT)) AS drug_name,
            COALESCE(m.tty, m.term_type, '') AS tty,
            COALESCE(m.benchmark_tier, '') AS benchmark_tier,
            COALESCE(m.overall_intelligence_score, 0) AS overall_intelligence_score,
            c.class_type,
            c.class_id,
            c.class_name
        FROM research_classification_detail c
        LEFT JOIN drug_intelligence_master_v1 m
            ON CAST(m.rxcui AS TEXT) = CAST(c.rxcui AS TEXT)
        WHERE CAST(c.rxcui AS TEXT) <> ?
          AND c.class_id IS NOT NULL
          AND TRIM(c.class_id) <> ''
          AND ({' OR '.join(where_clauses)})
        LIMIT 5000
        """,
        params,
    ).fetchall()

    candidates: Dict[str, Dict[str, Any]] = {}

    for row in candidate_rows:
        candidate_rxcui = str(row["rxcui"])
        candidate_tty = str(row["tty"] or "").upper()
        class_type = row["class_type"]
        class_id = row["class_id"]

        if candidate_rxcui == selected_rxcui:
            continue

        if candidate_tty in suppressed_ttys:
            continue

        if candidate_tty not in allowed_ttys:
            continue

        if class_type not in selected_features:
            continue

        if candidate_rxcui not in candidates:
            candidates[candidate_rxcui] = {
                "rxcui": candidate_rxcui,
                "drug_name": row["drug_name"],
                "rxnorm_name": row["drug_name"],
                "tty": candidate_tty,
                "benchmark_tier": row["benchmark_tier"],
                "overall_intelligence_score": row["overall_intelligence_score"],
                "similarity_score": 0,
                "shared_attributes": [],
                "shared_classes": [],
                "similarity_badges": [],
                "_tty_rank": tty_rank.get(candidate_tty, 99),
                "_features": {feature_type: set() for feature_type in feature_types},
            }

        candidate = candidates[candidate_rxcui]

        if class_id not in candidate["_features"][class_type]:
            candidate["_features"][class_type].add(class_id)
            candidate["similarity_score"] += weights.get(class_type, 0)

        label = f"{class_type}: {class_id}"
        if label not in candidate["shared_attributes"]:
            candidate["shared_attributes"].append(label)

        existing_shared = {
            (item["class_type"], item["class_id"])
            for item in candidate["shared_classes"]
        }

        if (class_type, class_id) not in existing_shared:
            candidate["shared_classes"].append(
                {
                    "class_type": class_type,
                    "class_id": class_id,
                    "class_name": row["class_name"] or feature_names.get(class_id) or class_id,
                    "weight": weights.get(class_type, 0),
                }
            )

    candidate_rxcuis = list(candidates.keys())

    if candidate_rxcuis:
        placeholders = ",".join(["?"] * len(candidate_rxcuis))

        hydrate_rows = conn.execute(
            f"""
            SELECT DISTINCT
                CAST(rxcui AS TEXT) AS rxcui,
                class_type,
                class_id,
                class_name
            FROM research_classification_detail
            WHERE CAST(rxcui AS TEXT) IN ({placeholders})
              AND class_id IS NOT NULL
              AND TRIM(class_id) <> ''
              AND class_type IN ('ATC4', 'ATC3', 'MOA', 'EPC', 'VA', 'DISEASE')
            """,
            candidate_rxcuis,
        ).fetchall()

        for row in hydrate_rows:
            candidate_rxcui = str(row["rxcui"])
            class_type = row["class_type"]
            class_id = row["class_id"]

            if candidate_rxcui not in candidates:
                continue

            if class_type not in selected_features:
                continue

            candidate = candidates[candidate_rxcui]
            candidate["_features"][class_type].add(class_id)

            existing_shared = {
                (item["class_type"], item["class_id"])
                for item in candidate["shared_classes"]
            }

            if (
                class_id in selected_features[class_type]
                and (class_type, class_id) not in existing_shared
            ):
                candidate["shared_attributes"].append(f"{class_type}: {class_id}")
                candidate["shared_classes"].append(
                    {
                        "class_type": class_type,
                        "class_id": class_id,
                        "class_name": row["class_name"] or feature_names.get(class_id) or class_id,
                        "weight": weights.get(class_type, 0),
                    }
                )

    generic_variant_terms = {
        "ibuprofen": {
            "advil",
            "motrin",
            "ibu",
            "neoprofen",
            "ibudone",
            "combunox",
            "duaxis",
            "rufen",
            "ibugesic",
            "caldolor",
            "genpril",
            "proprinal",
            "val-profen",
            "motrin pm",
        },
        "naproxen": {
            "aleve",
            "naprosyn",
            "anaprox",
        },
    }

    suppressed_names = set()

    for generic_name, variants in generic_variant_terms.items():
        if generic_name in selected_drug_name:
            suppressed_names.update(variants)

    def assign_similarity_v2(item: Dict[str, Any]) -> Dict[str, Any]:
        features = item["_features"]

        moa_overlap = len(selected_features["MOA"] & features["MOA"])
        epc_overlap = len(selected_features["EPC"] & features["EPC"])
        va_overlap = len(selected_features["VA"] & features["VA"])
        atc4_overlap = len(selected_features["ATC4"] & features["ATC4"])
        atc3_overlap = len(selected_features["ATC3"] & features["ATC3"])
        disease_overlap = len(selected_features["DISEASE"] & features["DISEASE"])

        atc4_similarity = round(
            atc4_overlap / max(len(selected_features["ATC4"]), 1) * 100,
            1,
        )

        atc3_similarity = round(
            atc3_overlap / max(len(selected_features["ATC3"]), 1) * 100,
            1,
        )

        disease_similarity = round(
            disease_overlap / max(len(selected_features["DISEASE"]), 1) * 100,
            1,
        )

        va_similarity = round(
            va_overlap / max(len(selected_features["VA"]), 1) * 100,
            1,
        )

        moa_similarity = 100 if moa_overlap > 0 else 0
        epc_similarity = 100 if epc_overlap > 0 else 0

        therapeutic_similarity = min(
            100,
            round((atc4_similarity * 0.65) + (atc3_similarity * 0.35), 1),
        )

        mechanism_similarity = min(
            100,
            round((moa_similarity * 0.65) + (epc_similarity * 0.35), 1),
        )

        classification_similarity = round(
            len(item["shared_classes"]) / max(len(shared_pairs), 1) * 100,
            1,
        )

        overall_similarity = round(
            (
                atc4_similarity * 0.30
                + atc3_similarity * 0.20
                + disease_similarity * 0.20
                + va_similarity * 0.15
                + moa_similarity * 0.10
                + epc_similarity * 0.05
            ),
            1,
        )

        has_atc4 = atc4_overlap > 0
        has_atc3 = atc3_overlap > 0
        has_disease = disease_overlap > 0
        has_va = va_overlap > 0
        has_moa = moa_overlap > 0
        has_epc = epc_overlap > 0

        badges = []

        if therapeutic_similarity >= 50:
            badges.append("Therapeutic Match")
        if disease_similarity >= 20:
            badges.append("Disease Match")
        if mechanism_similarity >= 50:
            badges.append("Mechanism Match")
        if has_atc4 and has_atc3:
            badges.append("ATC Hierarchy Match")
        if has_va:
            badges.append("VA Class Match")

        candidate_name = normalize_text(item.get("drug_name"))
        is_variant = candidate_name in suppressed_names or candidate_name == selected_drug_name

        if has_atc4 and has_atc3 and has_disease and not is_variant:
            tier_rank = 1
            tier = "Clinical Peer"
            reason_type = "Shared therapeutic hierarchy and disease evidence"
        elif has_atc4 and has_atc3 and not is_variant:
            tier_rank = 2
            tier = "Therapeutic Peer"
            reason_type = "Shared ATC therapeutic hierarchy"
        elif has_moa or has_epc:
            tier_rank = 3
            tier = "Mechanism Peer"
            reason_type = "Shared mechanism or pharmacologic class evidence"
        elif is_variant:
            tier_rank = 8
            tier = "Ingredient Variant"
            reason_type = "Brand, package, or ingredient variant"
        else:
            tier_rank = 9
            tier = "Semantic Match"
            reason_type = "Shared classification evidence"

        variant_penalty = 25 if is_variant else 0
        item["_tier_rank"] = tier_rank
        item["_variant_penalty"] = variant_penalty

        item["atc4_similarity"] = min(100, atc4_similarity)
        item["atc3_similarity"] = min(100, atc3_similarity)
        item["mechanism_similarity"] = mechanism_similarity
        item["disease_similarity"] = min(100, disease_similarity)
        item["therapeutic_similarity"] = therapeutic_similarity
        item["classification_similarity"] = min(100, classification_similarity)
        item["va_similarity"] = min(100, va_similarity)
        item["overall_similarity"] = max(0, min(100, overall_similarity - variant_penalty))
        item["similarity_score"] = min(100, round(float(item.get("similarity_score") or 0), 1))

        item["similarity_tier"] = tier
        item["similarity_reason_type"] = reason_type
        item["similarity_badges"] = badges
        item["similarity_version"] = "15C.1-therapeutic-similarity-v2"

        explanations = []

        if atc4_overlap:
            explanations.append(f"{atc4_overlap} shared ATC4 therapeutic class")
        if atc3_overlap:
            explanations.append(f"{atc3_overlap} shared ATC3 therapeutic group")
        if disease_overlap:
            explanations.append(f"{disease_overlap} shared disease mapping")
        if va_overlap:
            explanations.append(f"{va_overlap} shared VA class")
        if moa_overlap:
            explanations.append(f"{moa_overlap} shared mechanism-of-action class")
        if epc_overlap:
            explanations.append(f"{epc_overlap} shared EPC pharmacologic class")

        item["similarity_explanation"] = (
            "Similarity driven by " + ", ".join(explanations) + "."
            if explanations
            else "Similarity is based on limited shared classification evidence."
        )

        return item

    for item in candidates.values():
        assign_similarity_v2(item)

    filtered_candidates = {}

    blocked_name_terms = {
        "combogesic",
        "combunox",
        "duexis",
        "duaxis",
        "reprexain",
        "vicoprofen",
        "motrin",
        "advil",
        "ibu",
        "ibudone",
        "ibuprohm",
        "ibugesic",
        "neoprofen",
        "rufen",
        "caldolor",
        "genpril",
        "proprinal",
        "wal-profen",
        "val-profen",
        "samson",
        "addaprin",
        "ibuprofen lysine",
        "ibuprofen, sodium salt",
    }

    for key, value in candidates.items():
        candidate_name = normalize_text(value.get("drug_name"))
        candidate_tty = str(value.get("tty") or "").upper()

        if candidate_tty in suppressed_ttys:
            continue

        if candidate_tty not in allowed_ttys:
            continue

        if candidate_name == selected_drug_name:
            continue

        if any(term in candidate_name for term in blocked_name_terms):
            continue

        filtered_candidates[key] = value

    preferred_candidates = {
        key: value
        for key, value in filtered_candidates.items()
        if str(value.get("tty") or "").upper() in {"IN", "MIN", "PIN"}
    }

    fallback_brand_candidates = {
        key: value
        for key, value in filtered_candidates.items()
        if str(value.get("tty") or "").upper() == "BN"
    }

    candidate_pool = (
        preferred_candidates
        if len(preferred_candidates) >= limit
        else {**preferred_candidates, **fallback_brand_candidates}
    )

    ranked = sorted(
        candidate_pool.values(),
        key=lambda item: (
            item["_tier_rank"],
            item["_variant_penalty"],
            str(item.get("tty") or "").upper() == "BN",
            -item["overall_similarity"],
            -item["therapeutic_similarity"],
            -item["disease_similarity"],
            item["_tty_rank"],
            str(item.get("drug_name") or "").lower(),
        ),
    )

    seen_names = set()
    cleaned = []

    for item in ranked:
        normalized_name = normalize_text(item.get("drug_name"))

        if normalized_name in seen_names:
            continue

        seen_names.add(normalized_name)

        item["reason"] = (
            f"Weighted similarity based on shared "
            f"{', '.join(item['shared_attributes'][:3])}"
        )

        item.pop("_tty_rank", None)
        item.pop("_tier_rank", None)
        item.pop("_features", None)
        item.pop("_variant_penalty", None)

        cleaned.append(item)

        if len(cleaned) >= limit:
            break

    return cleaned


def calculate_atc4_intelligence_score(
    atc4_code: str,
    atc4_name: str,
    tty: str,
    moa_names: set[str],
) -> int:
    """
    Sprint 15C.3
    ATC4 Intelligence Ranking Layer

    Higher score = more likely to become primary pathway.
    """

    score = 0

    code = str(atc4_code or "").upper()
    name = str(atc4_name or "").lower()
    tty = str(tty or "").upper()

    # ----------------------------------
    # BOOSTS
    # ----------------------------------

    if tty == "IN":
        score += 50

    ingredient_keywords = [
        "derivative",
        "analgesic",
        "antibiotic",
        "statin",
        "biguanide",
        "glp",
        "proton pump",
        "quinolone",
    ]

    if any(word in name for word in ingredient_keywords):
        score += 30

    moa_text = " ".join(moa_names).lower()

    if (
        "cyclooxygenase" in moa_text and "antiinflammatory" in name
    ) or (
        "hmg-coa" in moa_text and "statin" in name
    ) or (
        "glp" in moa_text and "glp" in name
    ):
        score += 20

    # ----------------------------------
    # PENALTIES
    # ----------------------------------

    combination_keywords = [
        "combination",
        "combinations",
        "with",
    ]


    if "combination" in name:
        score -= 200

    if code.startswith("J01"):
        score += 40

    if code.startswith("B01AC"):
        score += 50

    administration_keywords = [
        "ophthalmic",
        "otic",
        "nasal",
        "vaginal",
        "topical",
    ]

    if any(word in name for word in administration_keywords):
        score -= 25

    package_keywords = [
        "kit",
        "pack",
        "starter",
        "dose",
    ]

    if any(word in name for word in package_keywords):
        score -= 25

    return score



def build_primary_therapeutic_pathway(classification_rows: List[sqlite3.Row]) -> Dict[str, Any]:
    """
    Sprint 15C.3 — ATC4 Intelligence Ranking Layer

    Purpose:
    Select the best executive ATC4 pathway using semantic evidence instead of
    hard-coded prefix ordering alone.
    """

    rows = [dict(row) for row in classification_rows]
    
    moa_names = {
        str(r.get("class_name") or "")
        for r in rows
        if r.get("class_type") == "MOA"
    }

    atc1 = [r for r in rows if r.get("class_type") == "ATC1"]
    atc2 = [r for r in rows if r.get("class_type") == "ATC2"]
    atc3 = [r for r in rows if r.get("class_type") == "ATC3"]
    atc4 = [r for r in rows if r.get("class_type") == "ATC4"]

    moa_rows = [r for r in rows if r.get("class_type") == "MOA"]
    epc_rows = [r for r in rows if r.get("class_type") == "EPC"]
    disease_rows = [r for r in rows if r.get("class_type") == "DISEASE"]
    va_rows = [r for r in rows if r.get("class_type") == "VA"]

    if not atc4:
        return {
            "primary_atc1": None,
            "primary_atc2": None,
            "primary_atc3": None,
            "primary_atc4": None,
            "pathway": [],
            "atc4_ranking": [],
            "ranking_version": "15C.3-atc4-intelligence-ranking",
        }

    def clean_text(value: Any) -> str:
        return str(value or "").strip().lower()

    def get_name(row: Dict[str, Any]) -> str:
        return str(
            row.get("class_name")
            or row.get("atc_full_name")
            or row.get("class_id")
            or ""
        ).strip()

    def clean_atc_name(row):
        if not row:
            return None

        row = dict(row)
        class_id = str(row.get("class_id") or "")

        atc_name_fallbacks = {
            "A": "Alimentary Tract and Metabolism",
            "A10": "Drugs Used in Diabetes",
            "A10B": "Blood Glucose Lowering Drugs, Excluding Insulins",
            "A10BJ": "Glucagon-like Peptide-1 (GLP-1) Analogs",
            "C": "Cardiovascular System",
            "M": "Musculo-Skeletal System",
            "M01": "Anti-inflammatory and antirheumatic products",
            "M01A": "Anti-inflammatory and antirheumatic products, non-steroids",
            "M01AE": "Propionic acid derivatives",
            "N": "Nervous System",
            "R": "Respiratory System",
            "G": "Genito Urinary System and Sex Hormones",
            "J": "Antiinfectives for Systemic Use",
        }

        row["class_name"] = (
            row.get("class_name")
            or atc_name_fallbacks.get(class_id)
            or row.get("atc_full_name")
            or class_id
            or ""
        )

        return row

    evidence_text = " ".join(
        [
            " ".join(get_name(r) for r in moa_rows),
            " ".join(get_name(r) for r in epc_rows),
            " ".join(get_name(r) for r in disease_rows),
            " ".join(get_name(r) for r in va_rows),
        ]
    ).lower()

    def score_atc4_candidate(row: Dict[str, Any]) -> Dict[str, Any]:
        code = str(row.get("class_id") or "")
        name = clean_text(get_name(row))
        full_name = clean_text(row.get("atc_full_name"))
        combined = f"{code.lower()} {name} {full_name}"

        score = 0
        reasons = []

        # Specificity: ATC4 should generally outrank broader rows.
        score += len(code) * 3
        reasons.append(f"specificity_bonus={len(code) * 3}")

        if row.get("is_atc_hierarchy_row"):
            score += 20
            reasons.append("official_atc_hierarchy_row=20")

        # NSAID / pain / inflammation semantic alignment.
        nsaid_evidence = any(
            term in evidence_text
            for term in [
                "cyclooxygenase",
                "nonsteroidal",
                "anti-inflammatory",
                "antiinflammatory",
                "pain",
                "inflammation",
                "arthritis",
                "bursitis",
                "fever",
                "osteoarthritis",
                "rheumatoid",
            ]
        )

        if nsaid_evidence:
            if code.startswith("M01AE"):
                score += 160
                reasons.append("nsaid_propionic_acid_alignment=160")
            elif code.startswith("M01A"):
                score += 110
                reasons.append("nsaid_antiinflammatory_alignment=110")
            elif code.startswith("M02A"):
                score += 60
                reasons.append("topical_antiinflammatory_secondary=60")
            elif code.startswith("N02"):
                score += 35
                reasons.append("analgesic_secondary_pathway=35")

        if "propionic acid" in combined:
            score += 90
            reasons.append("propionic_acid_name_match=90")

        # GLP-1 / diabetes / metabolic semantic alignment.
        metabolic_evidence = any(
            term in evidence_text
            for term in [
                "diabetes",
                "glucose",
                "hyperglycemia",
                "metabolic",
                "glucagon-like",
                "glp",
                "incretin",
                "weight",
                "obesity",
            ]
        )

        if metabolic_evidence:
            if code.startswith("A10BJ"):
                score += 180
                reasons.append("glp1_diabetes_alignment=180")
            elif code.startswith("A10B"):
                score += 120
                reasons.append("blood_glucose_lowering_alignment=120")
            elif code.startswith("A10"):
                score += 90
                reasons.append("diabetes_drug_alignment=90")
            elif code.startswith("A"):
                score += 50
                reasons.append("metabolism_domain_alignment=50")

        if "glucagon-like peptide" in combined or "glp-1" in combined or "glp1" in combined:
            score += 120
            reasons.append("glp1_name_match=120")

        if "blood glucose" in combined or "diabetes" in combined:
            score += 80
            reasons.append("diabetes_name_match=80")

        # Cardiovascular / prevention alignment.
        cardiovascular_evidence = any(
            term in evidence_text
            for term in [
                "cardiovascular",
                "platelet",
                "thrombosis",
                "myocardial",
                "stroke",
                "infarction",
                "ischemic",
                "antiplatelet",
            ]
        )

        if cardiovascular_evidence:
            if code.startswith("C"):
                score += 140
                reasons.append("cardiovascular_alignment=140")
            if "antithrombotic" in combined or "platelet" in combined:
                score += 100
                reasons.append("antithrombotic_name_match=100")

        # Penalize obviously secondary / non-primary routes when stronger evidence exists.
        if nsaid_evidence and code.startswith(("R", "G", "C01")):
            score -= 35
            reasons.append("secondary_route_penalty=-35")

        if metabolic_evidence and not code.startswith("A"):
            score -= 50
            reasons.append("non_metabolic_penalty=-50")

        return {
            "class_id": code,
            "class_name": get_name(row),
            "score": score,
            "reasons": reasons,
        }

    ranked_atc4 = sorted(
        atc4,
        key=lambda row: (
            score_atc4_candidate(row)["score"],
            len(str(row.get("class_id") or "")),
            str(row.get("class_id") or ""),
        ),
        reverse=True,
    )

    ranked_atc4 = []

    for row in atc4:
        score = calculate_atc4_intelligence_score(
            atc4_code=row.get("class_id"),
            atc4_name=row.get("class_name"),
            tty="IN",
            moa_names=moa_names,
        )

        ranked_atc4.append(
            (
                -score,
                row,
            )
        )

    ranked_atc4.sort(
        key=lambda item: (
            item[0],
            str(item[1].get("class_id") or ""),
            str(item[1].get("class_name") or ""),
        )
    )

    primary_atc4 = ranked_atc4[0][1]
    atc4_code = str(primary_atc4.get("class_id") or "")
    print(
    "[ATC4-RANK]",
    primary_atc4.get("class_id"),
    primary_atc4.get("class_name"),
)
    atc3_code = atc4_code[:4]
    atc2_code = atc4_code[:3]
    atc1_code = atc4_code[:1]

    primary_atc3 = next(
        (row for row in atc3 if str(row.get("class_id") or "") == atc3_code),
        None,
    )
    primary_atc2 = next(
        (row for row in atc2 if str(row.get("class_id") or "") == atc2_code),
        None,
    )
    primary_atc1 = next(
        (row for row in atc1 if str(row.get("class_id") or "") == atc1_code),
        None,
    )

    primary_atc1 = clean_atc_name(primary_atc1)
    primary_atc2 = clean_atc_name(primary_atc2)
    primary_atc3 = clean_atc_name(primary_atc3)
    primary_atc4 = clean_atc_name(primary_atc4)

    pathway = [
        item
        for item in [primary_atc1, primary_atc2, primary_atc3, primary_atc4]
        if item
    ]

    atc4_ranking = [
        score_atc4_candidate(row[1] if isinstance(row, tuple) else row)
        for row in ranked_atc4[:10]
    ]

    return {
        "primary_atc1": primary_atc1,
        "primary_atc2": primary_atc2,
        "primary_atc3": primary_atc3,
        "primary_atc4": primary_atc4,
        "pathway": pathway,
        "atc4_ranking": atc4_ranking,
        "ranking_version": "15C.3-atc4-intelligence-ranking",
    }


def build_graph_intelligence(graph_payload: Dict[str, Any]) -> Dict[str, Any]:
    nodes = graph_payload.get("nodes") or []

    def top_node(node_types: set[str]) -> Optional[Dict[str, Any]]:
        matches = [
            node for node in nodes
            if str(node.get("node_type") or "").upper() in node_types
        ]
        if not matches:
            return None

        return sorted(
            matches,
            key=lambda node: int(node.get("occurrence_count") or 0),
            reverse=True,
        )[0]

    domain = top_node({"ATC1", "ATC2", "ATC3", "ATC4", "VA"})
    disease = top_node({"DISEASE"})
    mechanism = top_node({"MOA", "EPC", "PE"})
    therapeutic_class = top_node({"ATC4", "ATC3", "ATC2", "ATC1"})

    return {
        "most_connected_domain": domain,
        "most_connected_disease": disease,
        "most_connected_mechanism": mechanism,
        "most_connected_therapeutic_class": therapeutic_class,
    }


def build_claims_readiness_layer(
    master: Dict[str, Any],
    classifications: Dict[str, Any],
    relationships: Dict[str, Any],
) -> Dict[str, Any]:
    has_rxnorm = bool(master.get("rxcui"))
    has_atc = any(classifications.get(bucket) for bucket in ["ATC1", "ATC2", "ATC3", "ATC4"])
    has_ndc = bool(
        relationships.get("ndcs")
        or relationships.get("ndc")
        or master.get("ndc_count")
        or master.get("ndc_package_count")
    )
    has_disease = bool(classifications.get("DISEASE"))
    has_mechanism = bool(classifications.get("MOA") or classifications.get("EPC"))

    available_layers = {
        "rxnorm": has_rxnorm,
        "atc": has_atc,
        "ndc": has_ndc,
        "disease": has_disease,
        "mechanism": has_mechanism,
        "hcpcs": False,
        "revenue_codes": False,
        "drgs": False,
        "icd10": False,
    }

    score = round(
        (
            int(has_rxnorm) * 20
            + int(has_atc) * 20
            + int(has_ndc) * 20
            + int(has_disease) * 15
            + int(has_mechanism) * 15
        ),
        1,
    )

    return {
        "claims_readiness_score": score,
        "available_layers": available_layers,
        "next_required_layers": [
            key for key, value in available_layers.items()
            if not value
        ],
        "claims_readiness_tier": (
            "Advanced" if score >= 80 else
            "Developing" if score >= 50 else
            "Foundational"
        ),
    }


def normalize_exec_text(value: Any) -> str:
    return str(value or "").strip().lower()


def title_or_default(value: Any, fallback: str) -> str:
    text = str(value or "").strip()
    return text if text else fallback


def classify_executive_disease_focus(
    drug_name: str,
    classifications: Dict[str, Any],
    primary_domain: str,
) -> Dict[str, Any]:
    """
    Sprint 15C.2 executive-facing disease focus selector.

    Purpose:
    - Do not simply return the first disease class.
    - Convert raw disease mappings into executive-readable labels.
    - Use known drug/domain patterns plus available DISEASE evidence.
    """

    drug_key = normalize_exec_text(drug_name)
    domain_key = normalize_exec_text(primary_domain)

    disease_rows = classifications.get("DISEASE") or []
    disease_names = [
        normalize_exec_text(row.get("class_name") or row.get("class_id"))
        for row in disease_rows
        if isinstance(row, dict)
    ]

    disease_text = " | ".join(disease_names)

    if "ibuprofen" in drug_key or "naproxen" in drug_key:
        return {
            "primary_disease_focus": "Pain Management",
            "secondary_disease_focus": "Inflammation",
            "tertiary_disease_focus": "Musculoskeletal Disorders",
            "executive_rationale": "NSAID disease mappings include pain, inflammation, fever, arthritis, and musculoskeletal-related indications.",
        }

    if "semaglutide" in drug_key:
        return {
            "primary_disease_focus": "Type 2 Diabetes",
            "secondary_disease_focus": "Metabolic Disease Management",
            "tertiary_disease_focus": "Weight and Cardiometabolic Risk",
            "executive_rationale": "Semaglutide is executive-classified around diabetes, metabolic disease, and cardiometabolic risk management.",
        }

    if "aspirin" in drug_key:
        return {
            "primary_disease_focus": "Cardiovascular Prevention",
            "secondary_disease_focus": "Pain Management",
            "tertiary_disease_focus": "Inflammation",
            "executive_rationale": "Aspirin is executive-classified around cardiovascular prevention while retaining analgesic and anti-inflammatory relevance.",
        }

    if "diabetes" in disease_text or "hyperglycemia" in disease_text:
        return {
            "primary_disease_focus": "Type 2 Diabetes",
            "secondary_disease_focus": "Metabolic Disease Management",
            "tertiary_disease_focus": "Cardiometabolic Risk",
            "executive_rationale": "Disease evidence includes diabetes or metabolic disease mappings.",
        }

    if "pain" in disease_text:
        return {
            "primary_disease_focus": "Pain Management",
            "secondary_disease_focus": "Inflammation" if "inflammation" in disease_text else "Clinical Symptom Management",
            "tertiary_disease_focus": "Musculoskeletal Disorders" if "arthritis" in disease_text else "Mapped Disease Evidence",
            "executive_rationale": "Disease evidence includes pain-related mappings.",
        }

    if "inflammation" in disease_text or "arthritis" in disease_text:
        return {
            "primary_disease_focus": "Inflammation",
            "secondary_disease_focus": "Musculoskeletal Disorders",
            "tertiary_disease_focus": "Arthritis-Related Conditions",
            "executive_rationale": "Disease evidence includes inflammation or arthritis-related mappings.",
        }

    if "cardiovascular" in domain_key or "cardiac" in disease_text:
        return {
            "primary_disease_focus": "Cardiovascular Management",
            "secondary_disease_focus": "Cardiometabolic Risk",
            "tertiary_disease_focus": "Clinical Prevention",
            "executive_rationale": "Therapeutic domain and disease evidence support cardiovascular management.",
        }

    first_disease = None
    if disease_rows:
        first_disease = disease_rows[0].get("class_name") or disease_rows[0].get("class_id")

    return {
        "primary_disease_focus": title_or_default(first_disease, "Disease focus not yet populated"),
        "secondary_disease_focus": "Mapped Clinical Evidence",
        "tertiary_disease_focus": "Classification-Based Disease Signal",
        "executive_rationale": "Fallback disease focus selected from available disease mappings.",
    }


def classify_executive_therapeutic_domain(
    drug_name: str,
    primary_therapeutic_pathway: Dict[str, Any],
    classifications: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Sprint 15C.2 executive-facing therapeutic domain selector.
    Uses primary pathway first, then drug-level override, then ATC evidence.
    """

    drug_key = normalize_exec_text(drug_name)

    if "semaglutide" in drug_key:
        return {
            "primary_therapeutic_domain": "Alimentary Tract & Metabolism",
            "executive_domain_source": "drug_override",
        }

    if "aspirin" in drug_key:
        return {
            "primary_therapeutic_domain": "Cardiovascular System",
            "executive_domain_source": "drug_override",
        }

    if "ibuprofen" in drug_key or "naproxen" in drug_key:
        return {
            "primary_therapeutic_domain": "Musculo-Skeletal System",
            "executive_domain_source": "drug_override",
        }

    pathway = primary_therapeutic_pathway.get("pathway") or []
    if pathway:
        first = pathway[0]
        return {
            "primary_therapeutic_domain": title_or_default(
                first.get("class_name") or first.get("class_id"),
                "Therapeutic domain not yet populated",
            ),
            "executive_domain_source": "primary_therapeutic_pathway",
        }

    atc1_rows = classifications.get("ATC1") or []
    if atc1_rows:
        selected = atc1_rows[0]
        return {
            "primary_therapeutic_domain": title_or_default(
                selected.get("class_name") or selected.get("class_id"),
                "Therapeutic domain not yet populated",
            ),
            "executive_domain_source": "atc1_fallback",
        }

    return {
        "primary_therapeutic_domain": "Therapeutic domain not yet populated",
        "executive_domain_source": "unavailable",
    }


def build_executive_summary_layer_15c2(
    master: Dict[str, Any],
    classifications: Dict[str, Any],
    primary_therapeutic_pathway: Dict[str, Any],
    existing_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    drug_name = (
        master.get("rxnorm_name")
        or master.get("drug_name")
        or master.get("display_name")
        or "This medication"
    )

    domain_result = classify_executive_therapeutic_domain(
        drug_name=drug_name,
        primary_therapeutic_pathway=primary_therapeutic_pathway,
        classifications=classifications,
    )

    disease_result = classify_executive_disease_focus(
        drug_name=drug_name,
        classifications=classifications,
        primary_domain=domain_result["primary_therapeutic_domain"],
    )

    moa_rows = classifications.get("MOA") or []
    epc_rows = classifications.get("EPC") or []

    primary_mechanism = (
        moa_rows[0].get("class_name")
        if moa_rows and isinstance(moa_rows[0], dict)
        else None
    )

    primary_pharmacologic_class = (
        epc_rows[0].get("class_name")
        if epc_rows and isinstance(epc_rows[0], dict)
        else None
    )

    total_classifications = sum(
        len(value)
        for key, value in classifications.items()
        if key != "counts" and isinstance(value, list)
    )

    populated_domains = [
        key
        for key, value in classifications.items()
        if key != "counts" and isinstance(value, list) and len(value) > 0
    ]

    summary = dict(existing_summary or {})

    summary.update(
        {
            "primary_therapeutic_domain": domain_result["primary_therapeutic_domain"],
            "primary_disease_focus": disease_result["primary_disease_focus"],
            "secondary_disease_focus": disease_result["secondary_disease_focus"],
            "tertiary_disease_focus": disease_result["tertiary_disease_focus"],
            "primary_mechanism": title_or_default(
                primary_mechanism,
                summary.get("primary_mechanism") or "Mechanism evidence not yet populated",
            ),
            "primary_pharmacologic_class": title_or_default(
                primary_pharmacologic_class,
                summary.get("primary_pharmacologic_class") or "Pharmacologic class not yet populated",
            ),
            "classification_breadth": total_classifications,
            "populated_intelligence_domains": len(populated_domains),
            "populated_domains": populated_domains,
            "executive_domain_source": domain_result["executive_domain_source"],
            "executive_disease_rationale": disease_result["executive_rationale"],
            "executive_summary_version": "15C.2-executive-summary-validation",
        }
    )

    return summary


def build_executive_therapeutic_narrative_15c2(
    master: Dict[str, Any],
    executive_summary: Dict[str, Any],
) -> Dict[str, Any]:
    drug_name = (
        master.get("rxnorm_name")
        or master.get("drug_name")
        or master.get("display_name")
        or "This medication"
    )

    domain = executive_summary.get("primary_therapeutic_domain")
    disease = executive_summary.get("primary_disease_focus")
    mechanism = executive_summary.get("primary_mechanism")
    pharmacologic_class = executive_summary.get("primary_pharmacologic_class")

    narrative = (
        f"{drug_name} is positioned within the {domain} therapeutic domain. "
        f"Its primary pharmacologic evidence maps to {mechanism} and {pharmacologic_class}. "
        f"The executive disease focus is {disease}, supported by mapped disease, therapeutic, "
        f"mechanism, and classification evidence."
    )

    return {
        "headline": f"{drug_name} executive medication intelligence narrative",
        "primary_domain": domain,
        "primary_disease_focus": disease,
        "primary_mechanism": mechanism,
        "primary_pharmacologic_class": pharmacologic_class,
        "narrative": narrative,
        "narrative_version": "15C.2-executive-narrative-validation",
    }

def get_primary_text(value: Any, fallback: str = "Not available") -> str:
    text = str(value or "").strip()
    return text if text else fallback


def build_disease_focus_narrative_15d(summary: Dict[str, Any]) -> str:
    disease_focus = get_primary_text(summary.get("primary_disease_focus"), "mapped clinical disease evidence")
    secondary = get_primary_text(summary.get("secondary_disease_focus"), "")
    tertiary = get_primary_text(summary.get("tertiary_disease_focus"), "")

    focus_key = disease_focus.lower()

    if "pain" in focus_key:
        return (
            "Primary indication evidence supports use in acute and chronic pain management, "
            "with additional therapeutic evidence spanning inflammatory disorders, "
            "musculoskeletal conditions, and rheumatologic disease."
        )

    if "diabetes" in focus_key:
        return (
            "Primary indication evidence supports cardiometabolic and glycemic disease management, "
            "with additional therapeutic context for diabetes care, metabolic risk, and longitudinal "
            "population-health analytics."
        )

    if "cardiovascular" in focus_key or "prevention" in focus_key:
        return (
            "Primary indication evidence supports cardiovascular prevention and risk reduction, "
            "with supporting semantic evidence for antithrombotic, vascular, and longitudinal claims-based analytics."
        )

    if "infection" in focus_key or "antiinfective" in focus_key:
        return (
            "Primary indication evidence supports systemic antiinfective therapy, with semantic evidence suitable "
            "for antimicrobial classification, clinical surveillance, and claims-based treatment-pattern analytics."
        )

    if "gastric" in focus_key or "reflux" in focus_key or "ulcer" in focus_key:
        return (
            "Primary indication evidence supports gastrointestinal acid-suppression management, with additional "
            "semantic evidence for reflux disease, ulcer-related conditions, and therapeutic pathway analysis."
        )

    return (
        f"Primary indication evidence supports {disease_focus}. "
        f"Additional mapped evidence spans {secondary or 'related clinical conditions'} "
        f"and {tertiary or 'supporting therapeutic signals'}, enabling enterprise clinical interpretation."
    )


def build_explainability_narrative_15d(summary: Dict[str, Any]) -> str:
    classification_breadth = summary.get("classification_breadth") or 0
    populated_domains = summary.get("populated_intelligence_domains") or 0
    primary_domain = get_primary_text(summary.get("primary_therapeutic_domain"), "its primary therapeutic domain")
    mechanism = get_primary_text(summary.get("primary_mechanism"), "available mechanism evidence")
    pharmacologic_class = get_primary_text(summary.get("primary_pharmacologic_class"), "available pharmacologic class evidence")

    return (
        f"The medication demonstrates exceptional semantic coverage across {populated_domains} intelligence domains "
        f"and {classification_breadth} mapped classification records. Its therapeutic identity is anchored in "
        f"{primary_domain}, supported by {mechanism} and {pharmacologic_class}. This level of structured evidence "
        f"supports advanced explainability, claims analytics, knowledge graph expansion, and enterprise AI deployment scenarios."
    )


def build_recommended_use_cases_15d(
    summary: Dict[str, Any],
    claims_readiness_layer: Dict[str, Any],
) -> List[Dict[str, Any]]:
    claims_score = claims_readiness_layer.get("claims_readiness_score") or 0
    populated_domains = summary.get("populated_intelligence_domains") or 0
    classification_breadth = summary.get("classification_breadth") or 0

    use_cases = [
        {
            "use_case": "Claims Analytics",
            "fit": "High" if claims_score >= 70 else "Developing",
            "description": "Use RxNorm, ATC, disease, mechanism, and classification evidence to support claims normalization, therapeutic rollups, and utilization analytics.",
        },
        {
            "use_case": "Clinical Decision Support",
            "fit": "High" if populated_domains >= 8 else "Moderate",
            "description": "Use therapeutic domain, disease focus, and pharmacologic evidence to support clinically interpretable medication intelligence.",
        },
        {
            "use_case": "AI Model Training",
            "fit": "High" if classification_breadth >= 25 else "Moderate",
            "description": "Use structured semantic features as model-ready inputs for explainable healthcare AI and medication-level feature engineering.",
        },
        {
            "use_case": "Knowledge Graph Expansion",
            "fit": "High",
            "description": "Use medication, ATC, MOA, EPC, disease, VA, and relationship signals to expand graph-based clinical intelligence.",
        },
        {
            "use_case": "Enterprise Medication Catalogs",
            "fit": "High",
            "description": "Use normalized medication identity and executive therapeutic summaries to create reusable enterprise medication reference assets.",
        },
    ]

    return use_cases


def build_executive_clinical_identity_15d(
    master: Dict[str, Any],
    summary: Dict[str, Any],
) -> Dict[str, Any]:
    drug_name = (
        master.get("rxnorm_name")
        or master.get("drug_name")
        or master.get("display_name")
        or "This medication"
    )

    primary_domain = get_primary_text(summary.get("primary_therapeutic_domain"))
    disease_focus = get_primary_text(summary.get("primary_disease_focus"))
    mechanism = get_primary_text(summary.get("primary_mechanism"))
    pharmacologic_class = get_primary_text(summary.get("primary_pharmacologic_class"))

    return {
        "title": f"{drug_name} Executive Clinical Identity",
        "clinical_identity": (
            f"{drug_name} is clinically positioned as a {pharmacologic_class} within the "
            f"{primary_domain} therapeutic domain, with primary disease intelligence focused on "
            f"{disease_focus}."
        ),
        "therapeutic_domain": primary_domain,
        "disease_focus": disease_focus,
        "mechanism": mechanism,
        "pharmacologic_class": pharmacologic_class,
        "identity_version": "15D-executive-clinical-identity",
    }


def build_executive_intelligence_polish_15d(
    master: Dict[str, Any],
    medication_intelligence_summary: Dict[str, Any],
    claims_readiness_layer: Dict[str, Any],
) -> Dict[str, Any]:
    executive_identity = build_executive_clinical_identity_15d(
        master=master,
        summary=medication_intelligence_summary,
    )

    disease_focus_narrative = build_disease_focus_narrative_15d(
        medication_intelligence_summary
    )

    explainability_narrative = build_explainability_narrative_15d(
        medication_intelligence_summary
    )

    recommended_use_cases = build_recommended_use_cases_15d(
        summary=medication_intelligence_summary,
        claims_readiness_layer=claims_readiness_layer,
    )

    return {
        "executive_clinical_identity": executive_identity,
        "executive_therapeutic_narrative": (
            f"{executive_identity['clinical_identity']} {disease_focus_narrative}"
        ),
        "clinical_intelligence_summary": explainability_narrative,
        "disease_focus_narrative": disease_focus_narrative,
        "explainability_narrative": explainability_narrative,
        "recommended_use_cases": recommended_use_cases,
        "polish_version": "15D-executive-intelligence-polishing",
    }

def align_graph_intelligence_to_primary_pathway(
    graph_intelligence: Dict[str, Any],
    primary_therapeutic_pathway: Dict[str, Any],
) -> Dict[str, Any]:
    graph_intelligence = dict(graph_intelligence or {})

    primary_atc1 = (
        primary_therapeutic_pathway.get("primary_atc1")
        or (
            primary_therapeutic_pathway.get("pathway", [None])[0]
            if primary_therapeutic_pathway.get("pathway")
            else None
        )
    )

    if primary_atc1:
        graph_intelligence["most_connected_domain"] = {
            "node_id": f"class:ATC1:{primary_atc1.get('class_id')}",
            "label": primary_atc1.get("class_name") or primary_atc1.get("class_id"),
            "node_type": "ATC1",
            "class_id": primary_atc1.get("class_id"),
            "class_name": primary_atc1.get("class_name"),
            "intelligence_domain": "ATC1",
            "ranking_source": "primary_therapeutic_pathway_override",
        }

    return graph_intelligence


# 

# -----------------------------------------------------------------------------
# H3C.1 — CDC Population Burden Intelligence helpers
# -----------------------------------------------------------------------------

def build_population_burden_payload(
    conn: sqlite3.Connection,
    rxcui: str,
    medication_intelligence_summary: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Return narrative-first CDC PLACES population burden context.

    This intentionally does not return a new visible score. It exposes a tier,
    prevalence benchmark, and executive narrative for Clinical Intelligence.
    """
    if not table_exists(conn, "drug_population_burden_mapping_v1"):
        summary = medication_intelligence_summary or {}
        primary_condition = (
            summary.get("primary_disease_focus")
            or summary.get("primary_disease_mapping")
            or "Disease focus not yet populated"
        )
        return {
            "available": False,
            "tier": "Not Available",
            "primary_condition": primary_condition,
            "prevalence_benchmark": "CDC PLACES population burden has not been integrated yet.",
            "narrative": (
                "CDC PLACES population burden context has not been generated for this medication yet. "
                "Run H3C.1 to create drug_population_burden_mapping_v1."
            ),
            "methodology_version": "H3C1_CDC_PLACES_POPULATION_BURDEN_INTELLIGENCE_V1",
        }

    row = conn.execute(
        """
        SELECT *
        FROM drug_population_burden_mapping_v1
        WHERE CAST(rxcui AS TEXT) = ?
        LIMIT 1
        """,
        (str(rxcui),),
    ).fetchone()

    if row is None:
        summary = medication_intelligence_summary or {}
        primary_condition = (
            summary.get("primary_disease_focus")
            or summary.get("primary_disease_mapping")
            or "Disease focus not yet populated"
        )
        return {
            "available": False,
            "tier": "Not Available",
            "primary_condition": primary_condition,
            "prevalence_benchmark": "No CDC PLACES population burden mapping found for this medication.",
            "narrative": (
                f"No CDC PLACES population burden mapping was found for {primary_condition}. "
                "The clinical dashboard can still use therapeutic and disease evidence, but population prevalence context is not yet available."
            ),
            "methodology_version": "H3C1_CDC_PLACES_POPULATION_BURDEN_INTELLIGENCE_V1",
        }

    item = dict(row)
    return {
        "available": True,
        "tier": item.get("population_burden_tier"),
        "primary_condition": item.get("primary_disease_focus") or item.get("disease_domain"),
        "disease_domain": item.get("disease_domain"),
        "places_measure": item.get("cdc_places_measure"),
        "places_prevalence": item.get("cdc_places_prevalence"),
        "population_burden_proxy": item.get("cdc_places_population_burden_proxy"),
        "prevalence_rank": item.get("population_prevalence_rank"),
        "burden_rank": item.get("population_burden_rank"),
        "prevalence_benchmark": item.get("population_prevalence_benchmark"),
        "narrative": item.get("population_burden_narrative"),
        "source_year": item.get("source_year"),
        "source_dataset": item.get("source_dataset"),
        "methodology_version": item.get("methodology_version"),
        "raw": item,
    }


@app.get("/explorer/drug-detail/{rxcui}", tags=["Intelligence Explorer"])
# def explorer_drug_full_detail(
#     rxcui: str,
#     include_raw: bool = Query(default=False, description="Include raw classification/relationship rows for audit/debugging."),
#     include_graph: bool = Query(default=True, description="Include a small graph subgraph for the selected RxCUI."),
# ) -> Dict[str, Any]:
#     """
#     Full Explorer detail payload for a selected RxCUI.

#     This endpoint is designed for the production RxNorm Intelligence Explorer UI.
#     It combines the intelligence scorecard with semantic classification details,
#     relationship details, and an optional graph subgraph.
#     """
#     with get_connection() as conn:
#         validate_table(conn, "drug_intelligence_master_v1")

#         master_row = conn.execute(
#             'SELECT * FROM "drug_intelligence_master_v1" WHERE CAST(rxcui AS TEXT) = ? LIMIT 1',
#             (str(rxcui),),
#         ).fetchone()
#         if master_row is None:
#             raise HTTPException(status_code=404, detail=f"RxCUI not found: {rxcui}")

#         master = dict(master_row)

#         classifications = build_classification_payload(classification_rows)
#         relationships = build_relationship_payload(relationship_rows)
#         primary_therapeutic_pathway = build_primary_therapeutic_pathway(classification_rows)

#         try:
#             similar_medications = get_weighted_medication_similarity_engine(
#                 conn,
#                 rxcui,
#                 limit=10,
#             )
#         except Exception as error:
#             print(f"Similarity engine failed for RxCUI {rxcui}: {error}")
#             similar_medications = []

#         medication_intelligence_summary = build_executive_summary_layer_15c2(
#             master=master,
#             classifications=classifications,
#             primary_therapeutic_pathway=primary_therapeutic_pathway,
#             existing_summary=medication_intelligence_summary if "medication_intelligence_summary" in locals() else None,
#         )

#         therapeutic_narrative = build_executive_therapeutic_narrative_15c2(
#             master=master,
#             executive_summary=medication_intelligence_summary,
#         )

#         claims_readiness_layer = build_claims_readiness_layer(
#             master,
#             classifications,
#             relationships,
#         )
#         try:
#             similar_medications = get_weighted_medication_similarity_engine(conn, rxcui, limit=8)
            
#         except Exception as error:
#             print(f"Similarity engine failed for RxCUI {rxcui}: {error}")
#             similar_medications = []

#     graph_payload: Dict[str, Any] = {"center_rxcui": rxcui, "nodes": [], "edges": []}
#     if include_graph:
#         try:
#             graph_payload = graph_subgraph(rxcui=rxcui, edge_limit=250)
#         except Exception:
#             graph_payload = {"center_rxcui": rxcui, "nodes": [], "edges": []}

#     if not include_raw:
#         classifications.pop("raw_rows", None)
#         relationships.pop("raw_rows", None)

#     graph_intelligence = build_graph_intelligence(graph_payload)

#     return {
#         "rxcui": str(rxcui),
#         "drug": master,
#         "scorecard": {
#             "overall_intelligence_score": master.get("overall_intelligence_score"),
#             "benchmark_tier": master.get("benchmark_tier"),
#             "score_band": master.get("score_band"),
#             "claims_readiness_score": master.get("claims_readiness_score"),
#             "ai_readiness_score": master.get("ai_readiness_score"),
#             "semantic_richness_score": master.get("semantic_richness_score"),
#             "interoperability_score": master.get("interoperability_score"),
#             "clinical_semantics_score": master.get("clinical_semantics_score"),
#             "relationship_density_score": master.get("relationship_density_score"),
#             "classification_density_score": master.get("classification_density_score"),
#         },
#         "classifications": classifications,
#         "relationships": relationships,
#         "primary_therapeutic_pathway": primary_therapeutic_pathway,
#         "similar_medications": similar_medications,
#         "graph": graph_payload,
#         "graph_metrics": graph_payload.get("metrics", {}),
#         "primary_therapeutic_pathway": primary_therapeutic_pathway,
#         "medication_intelligence_summary": medication_intelligence_summary,
#         "therapeutic_narrative": therapeutic_narrative,
#         "graph_intelligence": graph_intelligence,
#         "claims_readiness_layer": claims_readiness_layer,
#     }


@app.get("/explorer/top", tags=["Intelligence Explorer"])
def top_drugs(limit: int = Query(default=100, ge=1, le=500)) -> List[Dict[str, Any]]:
    return read_table("top_drugs_by_intelligence_v1", limit=limit)


@app.get("/explorer/bottom", tags=["Intelligence Explorer"])
def bottom_drugs(limit: int = Query(default=100, ge=1, le=500)) -> List[Dict[str, Any]]:
    return read_table("bottom_drugs_by_intelligence_v1", limit=limit)


# -----------------------------------------------------------------------------
# Dashboard endpoints
# -----------------------------------------------------------------------------

@app.get("/dashboards/ai-readiness", tags=["Dashboards"])
def ai_readiness_dashboard(
    min_score: Optional[float] = Query(default=None, ge=0, le=100),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    table_name = "ai_readiness_dashboard_v1"
    if min_score is None:
        return read_table(table_name, limit=limit, offset=offset, order_by="ai_readiness_score")

    with get_connection() as conn:
        validate_table(conn, table_name)
        columns = get_table_columns(conn, table_name)
        score_col = "ai_readiness_score" if "ai_readiness_score" in columns else available_order_column(conn, table_name, SCORE_COLUMNS)
        if not score_col:
            return read_table(table_name, limit=limit, offset=offset)
        rows = conn.execute(
            f'SELECT * FROM "{table_name}" WHERE CAST("{score_col}" AS REAL) >= ? ORDER BY CAST("{score_col}" AS REAL) DESC LIMIT ? OFFSET ?',
            (min_score, limit, offset),
        ).fetchall()
        return rows_to_dicts(rows)


@app.get("/dashboards/claims-readiness", tags=["Dashboards"])
def claims_readiness_dashboard(
    min_score: Optional[float] = Query(default=None, ge=0, le=100),
    limit: int = Query(default=500, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    table_name = "claims_readiness_dashboard_v1"
    if min_score is None:
        return read_table(table_name, limit=limit, offset=offset, order_by="claims_readiness_score")

    with get_connection() as conn:
        validate_table(conn, table_name)
        columns = get_table_columns(conn, table_name)
        score_col = "claims_readiness_score" if "claims_readiness_score" in columns else available_order_column(conn, table_name, SCORE_COLUMNS)
        if not score_col:
            return read_table(table_name, limit=limit, offset=offset)
        rows = conn.execute(
            f'SELECT * FROM "{table_name}" WHERE CAST("{score_col}" AS REAL) >= ? ORDER BY CAST("{score_col}" AS REAL) DESC LIMIT ? OFFSET ?',
            (min_score, limit, offset),
        ).fetchall()
        return rows_to_dicts(rows)



# -----------------------------------------------------------------------------
# Knowledge graph endpoints
# -----------------------------------------------------------------------------

def make_graph_drug_node_id(rxcui: str) -> str:
    return f"drug:{str(rxcui).strip()}"


def fetch_graph_metrics_by_rxcui(conn: sqlite3.Connection, rxcui: str) -> Dict[str, Any]:
    """Fetch per-drug graph metrics from Sprint 14A-v3 graph metrics table."""
    if not table_exists(conn, "knowledge_graph_metrics_v1"):
        return {}

    row = conn.execute(
        """
        SELECT *
        FROM "knowledge_graph_metrics_v1"
        WHERE CAST(rxcui AS TEXT) = ?
        LIMIT 1
        """,
        (str(rxcui),),
    ).fetchone()

    return dict(row) if row else {}


def fetch_graph_subgraph_from_tables(
    conn: sqlite3.Connection,
    rxcui: str,
    edge_limit: int = 250,
) -> Dict[str, Any]:
    """
    Build a frontend-ready subgraph from Sprint 14A-v3 graph tables.

    Uses:
        - knowledge_graph_nodes_v1.node_id
        - knowledge_graph_edges_v1.source_node_id
        - knowledge_graph_edges_v1.target_node_id
        - knowledge_graph_metrics_v1
    """
    validate_table(conn, "knowledge_graph_nodes_v1")
    validate_table(conn, "knowledge_graph_edges_v1")

    edge_limit = min(max(int(edge_limit), 1), 1000)
    center_node_id = make_graph_drug_node_id(rxcui)

    edge_rows = conn.execute(
        """
        SELECT *
        FROM "knowledge_graph_edges_v1"
        WHERE source_node_id = ?
        ORDER BY
            is_primary_edge DESC,
            edge_type ASC,
            relationship_label ASC
        LIMIT ?
        """,
        (center_node_id, edge_limit),
    ).fetchall()
    edges = rows_to_dicts(edge_rows)

    if not edges:
        edge_rows = conn.execute(
            """
            SELECT *
            FROM "knowledge_graph_edges_v1"
            WHERE CAST(source_rxcui AS TEXT) = ?
            ORDER BY
                is_primary_edge DESC,
                edge_type ASC,
                relationship_label ASC
            LIMIT ?
            """,
            (str(rxcui), edge_limit),
        ).fetchall()
        edges = rows_to_dicts(edge_rows)

    node_ids = {center_node_id}
    for edge in edges:
        source_id = edge.get("source_node_id")
        target_id = edge.get("target_node_id")
        if source_id:
            node_ids.add(str(source_id))
        if target_id:
            node_ids.add(str(target_id))

    nodes: List[Dict[str, Any]] = []
    if node_ids:
        placeholders = ",".join(["?"] * len(node_ids))
        node_rows = conn.execute(
            f"""
            SELECT *
            FROM "knowledge_graph_nodes_v1"
            WHERE node_id IN ({placeholders})
            ORDER BY
                CASE WHEN node_type = 'DRUG' THEN 0 ELSE 1 END,
                is_high_value_node DESC,
                node_type ASC,
                label ASC
            """,
            tuple(node_ids),
        ).fetchall()
        nodes = rows_to_dicts(node_rows)

    metrics = fetch_graph_metrics_by_rxcui(conn, rxcui)

    return {
        "center_rxcui": str(rxcui),
        "center_node_id": center_node_id,
        "nodes": nodes,
        "edges": edges,
        "metrics": metrics,
        "counts": {
            "nodes": len(nodes),
            "edges": len(edges),
            "classification_nodes": metrics.get("classification_node_count"),
            "relationship_nodes": metrics.get("relationship_node_count"),
            "intelligence_domains": metrics.get("intelligence_domain_count"),
            "classification_depth": metrics.get("classification_depth"),
            "graph_connectivity_score": metrics.get("graph_connectivity_score"),
        },
    }


@app.get("/graph/nodes", tags=["Knowledge Graph"])
def graph_nodes(
    benchmark_tier: Optional[str] = None,
    node_type: Optional[str] = Query(default=None, description="Optional node type filter, such as DRUG, ATC4, MOA, DISEASE, RELATIONSHIP."),
    limit: int = Query(default=1000, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    table_name = "knowledge_graph_nodes_v1"
    with get_connection() as conn:
        validate_table(conn, table_name)
        columns = get_table_columns(conn, table_name)

        where_parts: List[str] = []
        params: List[Any] = []

        if benchmark_tier and "benchmark_tier" in columns:
            where_parts.append('LOWER(CAST("benchmark_tier" AS TEXT)) = ?')
            params.append(benchmark_tier.lower())

        if node_type and "node_type" in columns:
            where_parts.append('UPPER(CAST("node_type" AS TEXT)) = ?')
            params.append(node_type.upper())

        where_clause = " WHERE " + " AND ".join(where_parts) if where_parts else ""

        rows = conn.execute(
            f"""
            SELECT *
            FROM "{table_name}"
            {where_clause}
            ORDER BY
                CASE WHEN node_type = 'DRUG' THEN 0 ELSE 1 END,
                is_high_value_node DESC,
                node_type ASC,
                label ASC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()
        return rows_to_dicts(rows)


@app.get("/graph/edges", tags=["Knowledge Graph"])
def graph_edges(
    rxcui: Optional[str] = Query(default=None, description="Return edges for a selected source RxCUI."),
    edge_type: Optional[str] = Query(default=None, description="Optional edge type filter, such as has_atc4 or has_moa."),
    limit: int = Query(default=5000, ge=1, le=10000),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    table_name = "knowledge_graph_edges_v1"
    with get_connection() as conn:
        validate_table(conn, table_name)

        where_parts: List[str] = []
        params: List[Any] = []

        if rxcui:
            where_parts.append('(source_node_id = ? OR CAST(source_rxcui AS TEXT) = ?)')
            params.extend([make_graph_drug_node_id(rxcui), str(rxcui)])

        if edge_type:
            where_parts.append('LOWER(CAST(edge_type AS TEXT)) = ?')
            params.append(edge_type.lower())

        where_clause = " WHERE " + " AND ".join(where_parts) if where_parts else ""

        rows = conn.execute(
            f"""
            SELECT *
            FROM "{table_name}"
            {where_clause}
            ORDER BY
                is_primary_edge DESC,
                edge_type ASC,
                relationship_label ASC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()
        return rows_to_dicts(rows)


@app.get("/graph/metrics/{rxcui}", tags=["Knowledge Graph"])
def graph_metrics(rxcui: str) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "knowledge_graph_metrics_v1")
        metrics = fetch_graph_metrics_by_rxcui(conn, rxcui)

    if not metrics:
        raise HTTPException(status_code=404, detail=f"Graph metrics not found for RxCUI: {rxcui}")

    return metrics


@app.get("/graph/subgraph/{rxcui}", tags=["Knowledge Graph"])
def graph_subgraph(
    rxcui: str,
    edge_limit: int = Query(default=250, ge=1, le=1000),
) -> Dict[str, Any]:
    with get_connection() as conn:
        return fetch_graph_subgraph_from_tables(conn, rxcui, edge_limit=edge_limit)



# =============================================================================
# Integrated fastapi_routes.py
# =============================================================================

"""
Sprint 15B — FastAPI route additions

Paste this block into backend/rxnorm_intelligence_api_v1.py after your existing graph routes.
It assumes your API file already has:
    - app = FastAPI(...)
    - DB_PATH or equivalent SQLite path variable
    - sqlite3 imported

If your API uses a different database path variable, replace DB_PATH in get_db_path().
"""



def get_db_path():
    try:
        return DB_PATH
    except NameError:
        return Path(__file__).resolve().parents[1] / "database" / "rxnorm_research.db"


def sqlite_row_to_dict(row):
    if row is None:
        return None
    return dict(row)


@app.get("/benchmark/comparison/{rxcui}")
def get_benchmark_comparison(rxcui: str):
    db_path = get_db_path()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row

        comparison = conn.execute(
            """
            SELECT *
            FROM benchmark_comparison_master_v1
            WHERE rxcui = ?
            """,
            (str(rxcui),),
        ).fetchone()

        if comparison is None:
            raise HTTPException(status_code=404, detail=f"No benchmark comparison found for RxCUI {rxcui}")

        tier_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

        score_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_score_distribution_v1
            ORDER BY bucket_sort_order
            """
        ).fetchall()

        top_context = conn.execute(
            """
            SELECT
                rxcui,
                display_name,
                overall_intelligence_score,
                overall_intelligence_rank,
                overall_intelligence_percentile,
                benchmark_tier
            FROM benchmark_comparison_master_v1
            ORDER BY overall_intelligence_rank ASC, display_name ASC
            LIMIT 10
            """
        ).fetchall()

        peer_context = conn.execute(
            """
            SELECT
                rxcui,
                display_name,
                overall_intelligence_score,
                overall_intelligence_rank,
                overall_intelligence_percentile,
                benchmark_tier
            FROM benchmark_comparison_master_v1
            WHERE benchmark_tier = (
                SELECT benchmark_tier
                FROM benchmark_comparison_master_v1
                WHERE rxcui = ?
            )
            ORDER BY overall_intelligence_rank ASC, display_name ASC
            LIMIT 25
            """,
            (str(rxcui),),
        ).fetchall()

    comparison_dict = sqlite_row_to_dict(comparison)

    return {
        "rxcui": str(rxcui),
        "comparison": comparison_dict,
        "tier_distribution": [sqlite_row_to_dict(row) for row in tier_distribution],
        "score_distribution": [sqlite_row_to_dict(row) for row in score_distribution],
        "top_context": [sqlite_row_to_dict(row) for row in top_context],
        "peer_context": [sqlite_row_to_dict(row) for row in peer_context],
    }


@app.get("/benchmark/distribution")
def get_benchmark_distribution():
    db_path = get_db_path()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row

        tier_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

        score_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_score_distribution_v1
            ORDER BY bucket_sort_order
            """
        ).fetchall()

    return {
        "tier_distribution": [sqlite_row_to_dict(row) for row in tier_distribution],
        "score_distribution": [sqlite_row_to_dict(row) for row in score_distribution],
    }



# =============================================================================
# Integrated sprint16A_fastapi_routes.py
# =============================================================================

@app.get("/benchmark/analytics/{rxcui}", tags=["Benchmarks"])
def get_benchmark_analytics(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "benchmark_analytics_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM benchmark_analytics_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No benchmark analytics found for RxCUI {rxcui}")

        analytics = dict(row)

    peer_comparison = []
    for i in [1, 2, 3]:
        peer_rxcui = analytics.get(f"top_peer_rxcui_{i}")
        if peer_rxcui:
            peer_comparison.append(
                {
                    "rxcui": peer_rxcui,
                    "display_name": analytics.get(f"top_peer_name_{i}"),
                    "overall_intelligence_score": analytics.get(f"top_peer_score_{i}"),
                    "benchmark_tier": analytics.get(f"top_peer_tier_{i}"),
                    "claims_readiness_score": analytics.get(f"top_peer_claims_score_{i}"),
                    "ai_readiness_score": analytics.get(f"top_peer_ai_score_{i}"),
                    "semantic_richness_score": analytics.get(f"top_peer_semantic_score_{i}"),
                    "graph_connectivity_score": analytics.get(f"top_peer_graph_score_{i}"),
                }
            )

    return {
        "rxcui": str(rxcui),
        "rank_card": {
            "rank": analytics.get("overall_intelligence_rank"),
            "population_size": analytics.get("population_size"),
            "percentile": analytics.get("overall_intelligence_percentile"),
            "top_population_share_pct": analytics.get("top_population_share_pct"),
            "top_population_label": analytics.get("top_population_label"),
            "benchmark_tier": analytics.get("benchmark_tier"),
            "overall_intelligence_score": analytics.get("overall_intelligence_score"),
        },
        "percentile_breakdown": {
            "overall": analytics.get("overall_intelligence_percentile"),
            "claims": analytics.get("claims_readiness_percentile"),
            "ai": analytics.get("ai_readiness_percentile"),
            "semantic": analytics.get("semantic_richness_percentile"),
            "graph": analytics.get("graph_connectivity_percentile"),
        },
        "population_comparison": {
            "overall": {
                "selected": analytics.get("overall_intelligence_score"),
                "population_average": analytics.get("population_average_overall_score_analytics"),
                "delta": analytics.get("overall_intelligence_vs_population_avg"),
            },
            "claims": {
                "selected": analytics.get("claims_readiness_score"),
                "population_average_delta": analytics.get("claims_readiness_vs_population_avg"),
            },
            "ai": {
                "selected": analytics.get("ai_readiness_score"),
                "population_average_delta": analytics.get("ai_readiness_vs_population_avg"),
            },
            "semantic": {
                "selected": analytics.get("semantic_richness_score"),
                "population_average_delta": analytics.get("semantic_richness_vs_population_avg"),
            },
            "graph": {
                "selected": analytics.get("graph_connectivity_score"),
                "population_average_delta": analytics.get("graph_connectivity_vs_population_avg"),
            },
        },
        "driver_breakdown": {
            "ATC Hierarchy": analytics.get("driver_atc_hierarchy_points"),
            "Disease Mapping": analytics.get("driver_disease_mapping_points"),
            "MOA/EPC Evidence": analytics.get("driver_moa_epc_points"),
            "RxNorm Relationships": analytics.get("driver_relationship_points"),
            "Graph Connectivity": analytics.get("driver_graph_connectivity_points"),
        },
        "peer_comparison": peer_comparison,
        "analytics_narrative": analytics.get("analytics_narrative"),
        "raw": analytics,
    }



# =============================================================================
# Integrated sprint17A_fastapi_routes.py
# =============================================================================

@app.get("/readiness/{rxcui}", tags=["Readiness"])
def get_readiness_score(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "drug_readiness_scores_v1")

        row = conn.execute(
            """
            SELECT *
            FROM drug_readiness_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No readiness score found for RxCUI {rxcui}")

        tier_rows = conn.execute(
            """
            SELECT *
            FROM readiness_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "scores": {
            "interoperability_readiness_score": score.get("interoperability_readiness_score"),
            "claims_readiness_score": score.get("claims_readiness_score"),
            "ai_readiness_score": score.get("ai_readiness_score"),
            "overall_readiness_score": score.get("overall_readiness_score"),
        },
        "percentiles": {
            "interoperability_percentile": score.get("interoperability_percentile"),
            "claims_percentile": score.get("claims_percentile"),
            "ai_percentile": score.get("ai_percentile"),
            "overall_readiness_percentile": score.get("overall_readiness_percentile"),
        },
        "tier": score.get("readiness_tier"),
        "methodology": {
            "score_version": score.get("score_version"),
            "score_methodology": score.get("score_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "drivers": {
            "interoperability": {
                "relationship_count": score.get("interoperability_relationship_count_norm"),
                "relationship_diversity": score.get("interoperability_relationship_diversity_norm"),
                "identifier_count": score.get("interoperability_identifier_count_norm"),
                "atc_depth": score.get("interoperability_atc_depth_norm"),
                "class_type_count": score.get("interoperability_class_type_count_norm"),
            },
            "claims": {
                "ndc_count": score.get("claims_ndc_count_norm"),
                "package_count": score.get("claims_package_count_norm"),
                "active_fda": score.get("claims_active_fda_norm"),
                "cms_claims": score.get("claims_cms_claim_norm"),
                "cms_percentile": score.get("claims_cms_percentile_norm"),
            },
            "ai": {
                "semantic_richness": score.get("ai_semantic_richness_norm"),
                "graph_density": score.get("ai_graph_density_norm"),
                "graph_node_degree": score.get("ai_graph_node_degree_norm"),
                "explainability_index": score.get("ai_explainability_index_norm"),
                "source_confidence": score.get("ai_source_confidence_norm"),
            },
        },
        "tier_distribution": rows_to_dicts(tier_rows),
        "raw": score,
    }


@app.get("/readiness/distribution/tiers", tags=["Readiness"])
def get_readiness_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "readiness_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM readiness_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint17B_fastapi_routes.py
# =============================================================================

@app.get("/confidence/{rxcui}", tags=["Confidence"])
def get_confidence_score(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "drug_confidence_scores_v1")

        row = conn.execute(
            """
            SELECT *
            FROM drug_confidence_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No confidence score found for RxCUI {rxcui}")

        tier_rows = conn.execute(
            """
            SELECT *
            FROM confidence_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "confidence_score": score.get("confidence_score"),
        "confidence_percentile": score.get("confidence_percentile"),
        "confidence_tier": score.get("confidence_tier"),
        "components": {
            "evidence_strength_score": score.get("evidence_strength_score"),
            "explainability_confidence_score": score.get("explainability_confidence_score"),
            "benchmark_reliability_score": score.get("benchmark_reliability_score"),
            "readiness_stability_score": score.get("readiness_stability_score"),
        },
        "evidence_drivers": {
            "relationship_evidence_norm": score.get("relationship_evidence_norm"),
            "classification_evidence_norm": score.get("classification_evidence_norm"),
            "graph_node_evidence_norm": score.get("graph_node_evidence_norm"),
            "graph_edge_evidence_norm": score.get("graph_edge_evidence_norm"),
            "domain_evidence_norm": score.get("domain_evidence_norm"),
        },
        "explainability_drivers": {
            "semantic_explainability_norm": score.get("semantic_explainability_norm"),
            "graph_connectivity_explainability_norm": score.get("graph_connectivity_explainability_norm"),
            "classification_depth_explainability_norm": score.get("classification_depth_explainability_norm"),
        },
        "benchmark_drivers": {
            "overall_intelligence_percentile": score.get("overall_intelligence_percentile"),
            "overall_readiness_percentile": score.get("overall_readiness_percentile"),
        },
        "stability": {
            "readiness_domain_std": score.get("readiness_domain_std"),
        },
        "methodology": {
            "confidence_version": score.get("confidence_version"),
            "confidence_methodology": score.get("confidence_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "tier_distribution": rows_to_dicts(tier_rows),
        "raw": score,
    }


@app.get("/confidence/distribution/tiers", tags=["Confidence"])
def get_confidence_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "confidence_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM confidence_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint18A_fastapi_routes.py
# =============================================================================

@app.get("/pca/{rxcui}", tags=["PCA"])
def get_pca_score(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "pca_readiness_scores_v1")

        row = conn.execute(
            """
            SELECT *
            FROM pca_readiness_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No PCA score found for RxCUI {rxcui}")

        summary_rows = conn.execute(
            """
            SELECT *
            FROM pca_model_summary_v1
            ORDER BY component
            """
        ).fetchall()

        tier_rows = conn.execute(
            """
            SELECT *
            FROM pca_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    feature_values = {
        key.replace("feature_", ""): value
        for key, value in score.items()
        if key.startswith("feature_")
    }

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "pca": {
            "pca_component_1": score.get("pca_component_1"),
            "pca_component_2": score.get("pca_component_2"),
            "pca_component_3": score.get("pca_component_3"),
            "pca_component_1_score": score.get("pca_component_1_score"),
            "pca_component_2_score": score.get("pca_component_2_score"),
            "pca_component_3_score": score.get("pca_component_3_score"),
            "pca_overall_score": score.get("pca_overall_score"),
            "pca_percentile": score.get("pca_percentile"),
            "pca_tier": score.get("pca_tier"),
        },
        "comparison": {
            "expert_overall_readiness_score": score.get("expert_overall_readiness_score"),
            "overall_intelligence_score": score.get("overall_intelligence_score"),
            "confidence_score": score.get("confidence_score"),
            "pca_vs_expert_delta": score.get("pca_vs_expert_delta"),
        },
        "features": feature_values,
        "model_summary": rows_to_dicts(summary_rows),
        "tier_distribution": rows_to_dicts(tier_rows),
        "methodology": {
            "pca_model_version": score.get("pca_model_version"),
            "pca_build_timestamp": score.get("pca_build_timestamp"),
        },
        "raw": score,
    }


@app.get("/pca/distribution/tiers", tags=["PCA"])
def get_pca_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "pca_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM pca_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/pca/model/summary", tags=["PCA"])
def get_pca_model_summary():
    with get_connection() as conn:
        validate_table(conn, "pca_model_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM pca_model_summary_v1
            ORDER BY component
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint18B_fastapi_routes.py
# =============================================================================

@app.get("/methodology/{rxcui}", tags=["Methodology"])
def get_methodology_consensus(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_comparison_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM methodology_comparison_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No methodology consensus found for RxCUI {rxcui}")

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM methodology_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "methodology_scores": {
            "intelligence_score": score.get("intelligence_score"),
            "readiness_score": score.get("readiness_score"),
            "confidence_score": score.get("confidence_score"),
            "pca_score": score.get("pca_score"),
        },
        "consensus": {
            "consensus_score": score.get("consensus_score"),
            "consensus_percentile": score.get("consensus_percentile"),
            "consensus_tier": score.get("consensus_tier"),
            "agreement_index": score.get("agreement_index"),
            "methodology_variance": score.get("methodology_variance"),
            "methodology_range": score.get("methodology_range"),
            "methodology_min_score": score.get("methodology_min_score"),
            "methodology_max_score": score.get("methodology_max_score"),
            "model_count": score.get("model_count"),
        },
        "tiers": {
            "readiness_tier": score.get("readiness_tier"),
            "confidence_tier": score.get("confidence_tier"),
            "pca_tier": score.get("pca_tier"),
        },
        "methodology": {
            "consensus_version": score.get("consensus_version"),
            "consensus_methodology": score.get("consensus_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "distribution": rows_to_dicts(distribution_rows),
        "raw": score,
    }


@app.get("/methodology/distribution", tags=["Methodology"])
def get_methodology_distribution():
    with get_connection() as conn:
        validate_table(conn, "methodology_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint19A_fastapi_routes.py
# =============================================================================

@app.get("/predictive/{rxcui}", tags=["Predictive Intelligence"])
def get_predictive_intelligence(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "predictive_intelligence_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM predictive_intelligence_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No predictive intelligence found for RxCUI {rxcui}")

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM predictive_priority_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "predictive": {
            "predictive_readiness_score": score.get("predictive_readiness_score"),
            "opportunity_score": score.get("opportunity_score"),
            "risk_score": score.get("risk_score"),
            "risk_tier": score.get("risk_tier"),
            "deployment_priority_score": score.get("deployment_priority_score"),
            "deployment_priority_percentile": score.get("deployment_priority_percentile"),
            "deployment_priority_tier": score.get("deployment_priority_tier"),
            "recommended_action": score.get("recommended_action"),
        },
        "source_scores": {
            "intelligence_score": score.get("intelligence_score"),
            "readiness_score": score.get("readiness_score"),
            "confidence_score": score.get("confidence_score"),
            "pca_score": score.get("pca_score"),
            "consensus_score": score.get("consensus_score"),
            "agreement_index": score.get("agreement_index"),
            "methodology_variance": score.get("methodology_variance"),
            "graph_connectivity_score": score.get("graph_connectivity_score"),
            "benchmark_percentile": score.get("benchmark_percentile"),
        },
        "methodology": {
            "predictive_model_version": score.get("predictive_model_version"),
            "predictive_methodology": score.get("predictive_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "distribution": rows_to_dicts(distribution_rows),
        "raw": score,
    }


@app.get("/predictive/distribution", tags=["Predictive Intelligence"])
def get_predictive_distribution():
    with get_connection() as conn:
        validate_table(conn, "predictive_priority_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM predictive_priority_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint19B_fastapi_routes.py
# =============================================================================

@app.get("/production-candidates/{rxcui}", tags=["Production Candidates"])
def get_production_candidate(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "production_candidate_rankings_v1")

        row = conn.execute(
            """
            SELECT *
            FROM production_candidate_rankings_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No production candidate ranking found for RxCUI {rxcui}")

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM production_candidate_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

        summary_rows = conn.execute(
            """
            SELECT *
            FROM production_candidate_summary_v1
            """
        ).fetchall()

    candidate = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": candidate.get("display_name"),
        "rank": {
            "production_rank": candidate.get("production_rank"),
            "production_candidate_score": candidate.get("production_candidate_score"),
            "production_candidate_percentile": candidate.get("production_candidate_percentile"),
            "production_candidate_tier": candidate.get("production_candidate_tier"),
            "production_status": candidate.get("production_status"),
            "showcase_recommendation": candidate.get("showcase_recommendation"),
        },
        "signals": {
            "deployment_priority_score": candidate.get("deployment_priority_score"),
            "predictive_readiness_score": candidate.get("predictive_readiness_score"),
            "opportunity_score": candidate.get("opportunity_score"),
            "risk_score": candidate.get("risk_score"),
            "confidence_score": candidate.get("confidence_score"),
            "consensus_score": candidate.get("consensus_score"),
            "graph_connectivity_score": candidate.get("graph_connectivity_score"),
            "benchmark_percentile": candidate.get("benchmark_percentile"),
            "pca_score": candidate.get("pca_score"),
            "readiness_score": candidate.get("readiness_score"),
            "intelligence_score": candidate.get("intelligence_score"),
        },
        "flags": {
            "is_top_10_candidate": candidate.get("is_top_10_candidate"),
            "is_top_100_candidate": candidate.get("is_top_100_candidate"),
            "is_flagship_candidate": candidate.get("is_flagship_candidate"),
        },
        "methodology": {
            "candidate_engine_version": candidate.get("candidate_engine_version"),
            "candidate_methodology": candidate.get("candidate_methodology"),
            "build_timestamp": candidate.get("build_timestamp"),
        },
        "distribution": rows_to_dicts(distribution_rows),
        "summary": rows_to_dicts(summary_rows),
        "raw": candidate,
    }


@app.get("/production-candidates", tags=["Production Candidates"])
def list_production_candidates(
    limit: int = Query(default=25, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
    tier: Optional[str] = Query(default=None),
):
    with get_connection() as conn:
        validate_table(conn, "production_candidate_rankings_v1")

        params = []
        where_clause = ""
        if tier:
            where_clause = "WHERE production_candidate_tier = ?"
            params.append(tier)

        rows = conn.execute(
            f"""
            SELECT *
            FROM production_candidate_rankings_v1
            {where_clause}
            ORDER BY production_rank ASC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-candidates/distribution/tiers", tags=["Production Candidates"])
def get_production_candidate_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "production_candidate_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_candidate_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint20A_fastapi_routes.py
# =============================================================================

@app.get("/executive/{rxcui}", tags=["Executive Portfolio"])
def get_executive_portfolio(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_portfolio_rankings_v1")

        row = conn.execute(
            """
            SELECT *
            FROM executive_portfolio_rankings_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No executive portfolio ranking found for RxCUI {rxcui}")

        tier_rows = conn.execute(
            """
            SELECT *
            FROM executive_portfolio_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "executive": {
            "executive_rank": item.get("executive_rank"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "executive_percentile": item.get("executive_percentile"),
            "executive_tier": item.get("executive_tier"),
            "executive_interpretation": item.get("executive_interpretation"),
        },
        "scores": {
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "confidence_score": item.get("confidence_score"),
            "consensus_score": item.get("consensus_score"),
            "predictive_readiness_score": item.get("predictive_readiness_score"),
            "opportunity_score": item.get("opportunity_score"),
            "risk_score": item.get("risk_score"),
            "pca_score": item.get("pca_score"),
            "overall_intelligence_score": item.get("overall_intelligence_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
        },
        "flags": {
            "is_executive_top_10": item.get("is_executive_top_10"),
            "is_executive_top_25": item.get("is_executive_top_25"),
            "is_executive_top_100": item.get("is_executive_top_100"),
        },
        "methodology": {
            "executive_version": item.get("executive_version"),
            "executive_methodology": item.get("executive_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "tier_distribution": rows_to_dicts(tier_rows),
        "raw": item,
    }


@app.get("/executive/top10", tags=["Executive Portfolio"])
def get_executive_top10():
    with get_connection() as conn:
        validate_table(conn, "executive_top_10_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_top_10_v1
            ORDER BY executive_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/top25", tags=["Executive Portfolio"])
def get_executive_top25():
    with get_connection() as conn:
        validate_table(conn, "executive_top_25_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_top_25_v1
            ORDER BY executive_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/top100", tags=["Executive Portfolio"])
def get_executive_top100():
    with get_connection() as conn:
        validate_table(conn, "executive_top_100_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_top_100_v1
            ORDER BY executive_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/categories", tags=["Executive Portfolio"])
def get_executive_categories():
    with get_connection() as conn:
        validate_table(conn, "executive_category_leaders_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_category_leaders_v1
            ORDER BY category ASC, category_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/distribution/tiers", tags=["Executive Portfolio"])
def get_executive_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "executive_portfolio_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_portfolio_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint20B_fastapi_routes.py
# =============================================================================

@app.get("/executive/leaderboards", tags=["Executive Leaderboards"])
def get_executive_leaderboards(
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
):
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_master_v1")

        params = []
        where_clause = ""
        if category:
            where_clause = "WHERE leaderboard_category = ?"
            params.append(category)

        rows = conn.execute(
            f"""
            SELECT *
            FROM executive_leaderboard_master_v1
            {where_clause}
            ORDER BY leaderboard_category ASC, leaderboard_rank ASC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/leaderboards/categories", tags=["Executive Leaderboards"])
def get_executive_leaderboard_categories():
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_categories_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_leaderboard_categories_v1
            ORDER BY leaderboard_category ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/leaderboards/summary", tags=["Executive Leaderboards"])
def get_executive_leaderboard_summary():
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_leaderboard_summary_v1
            ORDER BY leaderboard_category ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/leaderboards/{category}", tags=["Executive Leaderboards"])
def get_executive_leaderboard_by_category(
    category: str,
    limit: int = Query(default=25, ge=1, le=100),
):
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_leaderboard_master_v1
            WHERE leaderboard_category = ?
            ORDER BY leaderboard_rank ASC
            LIMIT ?
            """,
            (category, limit),
        ).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail=f"No leaderboard found for category: {category}")

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint21A_fastapi_routes.py
# =============================================================================

@app.get("/explainability/{rxcui}", tags=["Explainability"])
def get_drug_explainability(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "drug_explainability_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM drug_explainability_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No explainability profile found for RxCUI {rxcui}")

        reason_rows = conn.execute(
            """
            SELECT *
            FROM explainability_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY
                CASE WHEN reason_direction = 'positive' THEN 0 ELSE 1 END,
                reason_score DESC
            """,
            (str(rxcui),),
        ).fetchall()

        tier_rows = conn.execute(
            """
            SELECT *
            FROM explainability_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "explainability": {
            "explainability_score": item.get("explainability_score"),
            "explainability_tier": item.get("explainability_tier"),
            "positive_driver_count": item.get("positive_driver_count"),
            "limiting_factor_count": item.get("limiting_factor_count"),
            "executive_narrative": item.get("executive_narrative"),
            "recommended_action": item.get("recommended_action"),
        },
        "scores": {
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "confidence_score": item.get("confidence_score"),
            "consensus_score": item.get("consensus_score"),
            "pca_score": item.get("pca_score"),
            "overall_intelligence_score": item.get("overall_intelligence_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
            "risk_score": item.get("risk_score"),
        },
        "reasons": rows_to_dicts(reason_rows),
        "tier_distribution": rows_to_dicts(tier_rows),
        "methodology": {
            "explainability_version": item.get("explainability_version"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/explainability/{rxcui}/reasons", tags=["Explainability"])
def get_drug_explainability_reasons(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "explainability_reason_codes_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM explainability_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY
                CASE WHEN reason_direction = 'positive' THEN 0 ELSE 1 END,
                reason_score DESC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/explainability/distribution/tiers", tags=["Explainability"])
def get_explainability_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "explainability_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM explainability_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint21B_fastapi_routes.py
# =============================================================================

@app.get("/recommendations/{rxcui}", tags=["Executive Recommendations"])
def get_executive_recommendation(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No executive recommendation found for RxCUI {rxcui}")

        use_case_rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_use_cases_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY use_case_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        audience_rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_audiences_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY audience_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "recommendation": {
            "executive_recommendation_rank": item.get("executive_recommendation_rank"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "executive_recommendation_percentile": item.get("executive_recommendation_percentile"),
            "business_impact_tier": item.get("business_impact_tier"),
            "recommendation_priority": item.get("recommendation_priority"),
            "primary_recommended_use_case": item.get("primary_recommended_use_case"),
            "primary_recommended_audience": item.get("primary_recommended_audience"),
            "recommended_action_plan": item.get("recommended_action_plan"),
        },
        "scores": {
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "confidence_score": item.get("confidence_score"),
            "consensus_score": item.get("consensus_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "explainability_score": item.get("explainability_score"),
            "risk_score": item.get("risk_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
        },
        "use_cases": rows_to_dicts(use_case_rows),
        "audiences": rows_to_dicts(audience_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "recommendation_version": item.get("recommendation_version"),
            "recommendation_methodology": item.get("recommendation_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/recommendations/{rxcui}/use-cases", tags=["Executive Recommendations"])
def get_executive_recommendation_use_cases(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_use_cases_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_use_cases_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY use_case_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/recommendations/{rxcui}/audiences", tags=["Executive Recommendations"])
def get_executive_recommendation_audiences(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_audiences_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_audiences_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY audience_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/recommendations/distribution/impact", tags=["Executive Recommendations"])
def get_executive_recommendation_distribution():
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/recommendations/top", tags=["Executive Recommendations"])
def get_top_executive_recommendations(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_master_v1
            ORDER BY executive_recommendation_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint22A_fastapi_routes.py
# =============================================================================

@app.get("/opportunities/{rxcui}", tags=["Strategic Opportunities"])
def get_strategic_opportunity(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No strategic opportunity found for RxCUI {rxcui}")

        driver_rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_drivers_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY driver_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "opportunity": {
            "strategic_opportunity_rank": item.get("strategic_opportunity_rank"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "strategic_opportunity_percentile": item.get("strategic_opportunity_percentile"),
            "strategic_opportunity_tier": item.get("strategic_opportunity_tier"),
            "strategic_opportunity_type": item.get("strategic_opportunity_type"),
            "market_position": item.get("market_position"),
            "strategic_action_plan": item.get("strategic_action_plan"),
        },
        "scores": {
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "confidence_score": item.get("confidence_score"),
            "explainability_score": item.get("explainability_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "consensus_score": item.get("consensus_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
            "risk_score": item.get("risk_score"),
        },
        "leaderboard": {
            "leaderboard_appearance_count": item.get("leaderboard_appearance_count"),
            "best_leaderboard_rank": item.get("best_leaderboard_rank"),
        },
        "drivers": rows_to_dicts(driver_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "opportunity_version": item.get("opportunity_version"),
            "opportunity_methodology": item.get("opportunity_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/opportunities/{rxcui}/drivers", tags=["Strategic Opportunities"])
def get_strategic_opportunity_drivers(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_drivers_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_drivers_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY driver_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/opportunities/top", tags=["Strategic Opportunities"])
def get_top_strategic_opportunities(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_master_v1
            ORDER BY strategic_opportunity_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/opportunities/distribution/tiers", tags=["Strategic Opportunities"])
def get_strategic_opportunity_distribution():
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint22B_fastapi_routes.py
# =============================================================================

@app.get("/portfolio-optimization/{rxcui}", tags=["Portfolio Optimization"])
def get_portfolio_optimization(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No portfolio optimization profile found for RxCUI {rxcui}")

        action_rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        segment_rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_segments_v1
            """
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_distribution_v1
            ORDER BY action_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "optimization": {
            "portfolio_optimization_rank": item.get("portfolio_optimization_rank"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "portfolio_optimization_percentile": item.get("portfolio_optimization_percentile"),
            "portfolio_segment": item.get("portfolio_segment"),
            "primary_optimization_action": item.get("primary_optimization_action"),
            "investment_priority": item.get("investment_priority"),
            "optimization_action_plan": item.get("optimization_action_plan"),
        },
        "scores": {
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "explainability_score": item.get("explainability_score"),
            "confidence_score": item.get("confidence_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "risk_score": item.get("risk_score"),
        },
        "actions": rows_to_dicts(action_rows),
        "segments": rows_to_dicts(segment_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "optimization_version": item.get("optimization_version"),
            "optimization_methodology": item.get("optimization_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/portfolio-optimization/{rxcui}/actions", tags=["Portfolio Optimization"])
def get_portfolio_optimization_actions(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_actions_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/portfolio-optimization/top", tags=["Portfolio Optimization"])
def get_top_portfolio_optimization(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_master_v1
            ORDER BY portfolio_optimization_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/portfolio-optimization/distribution/actions", tags=["Portfolio Optimization"])
def get_portfolio_optimization_distribution():
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_distribution_v1
            ORDER BY action_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/portfolio-optimization/segments", tags=["Portfolio Optimization"])
def get_portfolio_optimization_segments():
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_segments_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_segments_v1
            ORDER BY avg_portfolio_optimization_score DESC
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint23A_fastapi_routes.py
# =============================================================================

@app.get("/copilot/{rxcui}", tags=["AI Copilot"])
def get_ai_copilot_brief(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_drug_brief_v1")

        row = conn.execute(
            """
            SELECT *
            FROM ai_copilot_drug_brief_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No AI copilot brief found for RxCUI {rxcui}")

        question_rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_question_bank_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY qa_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        card_rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_response_cards_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY card_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "copilot": {
            "ai_copilot_rank": item.get("ai_copilot_rank"),
            "ai_copilot_score": item.get("ai_copilot_score"),
            "ai_copilot_percentile": item.get("ai_copilot_percentile"),
            "ai_copilot_tier": item.get("ai_copilot_tier"),
            "recommended_prompt": item.get("recommended_prompt"),
        },
        "summaries": {
            "executive_summary": item.get("executive_summary"),
            "technical_summary": item.get("technical_summary"),
            "strategic_summary": item.get("strategic_summary"),
        },
        "scores": {
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "explainability_score": item.get("explainability_score"),
            "confidence_score": item.get("confidence_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "risk_score": item.get("risk_score"),
        },
        "questions": rows_to_dicts(question_rows),
        "cards": rows_to_dicts(card_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "copilot_version": item.get("copilot_version"),
            "copilot_methodology": item.get("copilot_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/copilot/{rxcui}/questions", tags=["AI Copilot"])
def get_ai_copilot_questions(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_question_bank_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_question_bank_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY qa_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/copilot/top", tags=["AI Copilot"])
def get_top_ai_copilot_assets(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_drug_brief_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_drug_brief_v1
            ORDER BY ai_copilot_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/copilot/distribution/tiers", tags=["AI Copilot"])
def get_ai_copilot_distribution():
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint23B_fastapi_routes.py
# =============================================================================

@app.get("/deployment/{rxcui}", tags=["Enterprise Deployment"])
def get_enterprise_deployment(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No enterprise deployment profile found for RxCUI {rxcui}")

        gate_rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        action_rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "deployment": {
            "enterprise_deployment_rank": item.get("enterprise_deployment_rank"),
            "enterprise_deployment_score": item.get("enterprise_deployment_score"),
            "enterprise_deployment_percentile": item.get("enterprise_deployment_percentile"),
            "enterprise_deployment_tier": item.get("enterprise_deployment_tier"),
            "enterprise_deployment_status": item.get("enterprise_deployment_status"),
            "deployment_gate_pass_count": item.get("deployment_gate_pass_count"),
            "deployment_gate_total_count": item.get("deployment_gate_total_count"),
            "deployment_gate_pass_rate": item.get("deployment_gate_pass_rate"),
            "deployment_action_plan": item.get("deployment_action_plan"),
        },
        "scores": {
            "ai_copilot_score": item.get("ai_copilot_score"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "explainability_score": item.get("explainability_score"),
            "confidence_score": item.get("confidence_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
            "risk_score": item.get("risk_score"),
        },
        "gates": rows_to_dicts(gate_rows),
        "actions": rows_to_dicts(action_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "deployment_version": item.get("deployment_version"),
            "deployment_methodology": item.get("deployment_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/deployment/{rxcui}/gates", tags=["Enterprise Deployment"])
def get_enterprise_deployment_gates(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_gates_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/deployment/top", tags=["Enterprise Deployment"])
def get_top_enterprise_deployment_assets(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_master_v1
            ORDER BY enterprise_deployment_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/deployment/distribution/tiers", tags=["Enterprise Deployment"])
def get_enterprise_deployment_distribution():
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/deployment/platform/summary", tags=["Enterprise Deployment"])
def get_enterprise_platform_launch_summary():
    with get_connection() as conn:
        validate_table(conn, "enterprise_platform_launch_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_platform_launch_summary_v1
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint24A_fastapi_routes.py
# =============================================================================

@app.get("/website-demo/assets/{rxcui}", tags=["Website Demo"])
def get_website_demo_asset(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "website_demo_assets_v1")

        row = conn.execute(
            """
            SELECT *
            FROM website_demo_assets_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No website demo asset found for RxCUI {rxcui}")

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "website_demo": {
            "website_demo_rank": item.get("website_demo_rank"),
            "website_demo_score": item.get("website_demo_score"),
            "website_demo_percentile": item.get("website_demo_percentile"),
            "website_demo_badge": item.get("website_demo_badge"),
            "website_visibility": item.get("website_visibility"),
            "website_card_title": item.get("website_card_title"),
            "website_card_subtitle": item.get("website_card_subtitle"),
            "website_hero_copy": item.get("website_hero_copy"),
            "website_cta_label": item.get("website_cta_label"),
            "website_route": item.get("website_route"),
        },
        "scores": {
            "enterprise_deployment_score": item.get("enterprise_deployment_score"),
            "ai_copilot_score": item.get("ai_copilot_score"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "confidence_score": item.get("confidence_score"),
            "risk_score": item.get("risk_score"),
            "deployment_gate_pass_rate": item.get("deployment_gate_pass_rate"),
        },
        "deployment": {
            "enterprise_deployment_tier": item.get("enterprise_deployment_tier"),
            "enterprise_deployment_status": item.get("enterprise_deployment_status"),
        },
        "methodology": {
            "website_layer_version": item.get("website_layer_version"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/website-demo/featured", tags=["Website Demo"])
def get_website_featured_medications(limit: int = Query(default=25, ge=1, le=100)):
    with get_connection() as conn:
        validate_table(conn, "website_featured_medications_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM website_featured_medications_v1
            ORDER BY featured_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/website-demo/collections", tags=["Website Demo"])
def get_website_demo_collections(collection_name: Optional[str] = Query(default=None)):
    with get_connection() as conn:
        validate_table(conn, "website_demo_collections_v1")

        params = []
        where_clause = ""
        if collection_name:
            where_clause = "WHERE collection_name = ?"
            params.append(collection_name)

        rows = conn.execute(
            f"""
            SELECT *
            FROM website_demo_collections_v1
            {where_clause}
            ORDER BY collection_name ASC, collection_rank ASC
            """,
            params,
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/website-demo/summary", tags=["Website Demo"])
def get_website_launch_readiness_summary():
    with get_connection() as conn:
        validate_table(conn, "website_launch_readiness_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM website_launch_readiness_summary_v1
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated sprint24B_fastapi_routes.py
# =============================================================================

@app.get("/production-hardening/{rxcui}", tags=["Production Hardening"])
def get_production_hardening(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "production_hardening_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM production_hardening_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No production hardening profile found for RxCUI {rxcui}")

        gate_rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        action_rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "hardening": {
            "production_hardening_rank": item.get("production_hardening_rank"),
            "production_hardening_score": item.get("production_hardening_score"),
            "production_hardening_percentile": item.get("production_hardening_percentile"),
            "production_hardening_tier": item.get("production_hardening_tier"),
            "launch_decision": item.get("launch_decision"),
            "website_visibility": item.get("website_visibility"),
            "hardening_gate_pass_count": item.get("hardening_gate_pass_count"),
            "hardening_gate_total_count": item.get("hardening_gate_total_count"),
            "hardening_gate_pass_rate": item.get("hardening_gate_pass_rate"),
            "production_hardening_action_plan": item.get("production_hardening_action_plan"),
        },
        "scores": {
            "website_demo_score": item.get("website_demo_score"),
            "enterprise_deployment_score": item.get("enterprise_deployment_score"),
            "ai_copilot_score": item.get("ai_copilot_score"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "confidence_score": item.get("confidence_score"),
            "risk_score": item.get("risk_score"),
            "api_payload_readiness": item.get("api_payload_readiness"),
            "frontend_display_readiness": item.get("frontend_display_readiness"),
            "data_completeness_readiness": item.get("data_completeness_readiness"),
            "demo_fallback_readiness": item.get("demo_fallback_readiness"),
        },
        "gates": rows_to_dicts(gate_rows),
        "actions": rows_to_dicts(action_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "hardening_version": item.get("hardening_version"),
            "hardening_methodology": item.get("hardening_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/production-hardening/{rxcui}/gates", tags=["Production Hardening"])
def get_production_hardening_gates(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "production_hardening_gates_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-hardening/top", tags=["Production Hardening"])
def get_top_production_hardening_assets(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "production_hardening_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_master_v1
            ORDER BY production_hardening_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-hardening/distribution/tiers", tags=["Production Hardening"])
def get_production_hardening_distribution():
    with get_connection() as conn:
        validate_table(conn, "production_hardening_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-hardening/platform/summary", tags=["Production Hardening"])
def get_production_platform_readiness_summary():
    with get_connection() as conn:
        validate_table(conn, "production_platform_readiness_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_platform_readiness_summary_v1
            """
        ).fetchall()

    return rows_to_dicts(rows)


# =============================================================================
# Frontend compatibility aliases
# =============================================================================

@app.get("/methodology-consensus/{rxcui}", tags=["Methodology"])
def get_methodology_consensus_alias(rxcui: str):
    return get_methodology_consensus(rxcui)


@app.get("/production-candidate/{rxcui}", tags=["Production Candidates"])
def get_production_candidate_alias(rxcui: str):
    return get_production_candidate(rxcui)


@app.get("/executive-portfolio/{rxcui}", tags=["Executive Portfolio"])
def get_executive_portfolio_alias(rxcui: str):
    return get_executive_portfolio(rxcui)


@app.get("/executive-leaderboards", tags=["Executive Leaderboards"])
def get_executive_leaderboards_alias(
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
):
    return get_executive_leaderboards(category=category, limit=limit)


@app.get("/executive-leaderboards/categories", tags=["Executive Leaderboards"])
def get_executive_leaderboard_categories_alias():
    return get_executive_leaderboard_categories()


@app.get("/executive-leaderboards/summary", tags=["Executive Leaderboards"])
def get_executive_leaderboard_summary_alias():
    return get_executive_leaderboard_summary()


@app.get("/executive-leaderboards/{category}", tags=["Executive Leaderboards"])
def get_executive_leaderboard_by_category_alias(
    category: str,
    limit: int = Query(default=25, ge=1, le=100),
):
    return get_executive_leaderboard_by_category(category=category, limit=limit)



# =============================================================================
# Integrated Validation Track V1–V5 API Routes
# =============================================================================

"""
Validation Track V1–V5 — FastAPI routes

Paste below Sprint 24B production hardening routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/validation/regression/{rxcui}", tags=["Validation Track"])
def get_validation_regression(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "regression_readiness_scores_v1")
        row = conn.execute(
            """
            SELECT *
            FROM regression_readiness_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No regression score found for RxCUI {rxcui}")
        summary = conn.execute("SELECT * FROM regression_model_summary_v1 ORDER BY feature_rank ASC").fetchall()
    return {"rxcui": str(rxcui), "regression": dict(row), "model_summary": rows_to_dicts(summary)}


@app.get("/validation/efa/{rxcui}", tags=["Validation Track"])
def get_validation_efa(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "efa_factor_scores_v1")
        row = conn.execute(
            """
            SELECT *
            FROM efa_factor_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No EFA score found for RxCUI {rxcui}")
        loadings = conn.execute("SELECT * FROM efa_loadings_v1 ORDER BY factor_number ASC, absolute_loading DESC").fetchall()
        summary = conn.execute("SELECT * FROM efa_model_summary_v1 ORDER BY factor_number ASC").fetchall()
    return {"rxcui": str(rxcui), "efa": dict(row), "loadings": rows_to_dicts(loadings), "model_summary": rows_to_dicts(summary)}


@app.get("/validation/bootstrap/{rxcui}", tags=["Validation Track"])
def get_validation_bootstrap(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "bootstrap_score_stability_v1")
        score = conn.execute(
            """
            SELECT *
            FROM bootstrap_score_stability_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        rank = conn.execute(
            """
            SELECT *
            FROM bootstrap_rank_stability_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        ci = conn.execute(
            """
            SELECT *
            FROM confidence_intervals_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if score is None:
            raise HTTPException(status_code=404, detail=f"No bootstrap validation found for RxCUI {rxcui}")
    return {
        "rxcui": str(rxcui),
        "score_stability": dict(score) if score else None,
        "rank_stability": dict(rank) if rank else None,
        "confidence_interval": dict(ci) if ci else None,
    }


@app.get("/validation/sensitivity/{rxcui}", tags=["Validation Track"])
def get_validation_sensitivity(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "rank_volatility_v1")
        volatility = conn.execute(
            """
            SELECT *
            FROM rank_volatility_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        scenarios = conn.execute(
            """
            SELECT *
            FROM sensitivity_analysis_results_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY perturbed_domain ASC, weight_delta_pct ASC
            """,
            (str(rxcui),),
        ).fetchall()
        if volatility is None:
            raise HTTPException(status_code=404, detail=f"No sensitivity profile found for RxCUI {rxcui}")
    return {"rxcui": str(rxcui), "volatility": dict(volatility), "scenarios": rows_to_dicts(scenarios)}


@app.get("/validation/methodology/{rxcui}", tags=["Validation Track"])
def get_validation_methodology_selection(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_comparison_master_v2")
        row = conn.execute(
            """
            SELECT *
            FROM methodology_comparison_master_v2
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No methodology v2 profile found for RxCUI {rxcui}")
        summary = conn.execute("SELECT * FROM methodology_selection_summary_v1 ORDER BY medication_count DESC").fetchall()
    return {"rxcui": str(rxcui), "methodology": dict(row), "selection_summary": rows_to_dicts(summary)}


@app.get("/validation/{rxcui}", tags=["Validation Track"])
def get_validation_track_profile(rxcui: str):
    return {
        "rxcui": str(rxcui),
        "regression": get_validation_regression(rxcui),
        "efa": get_validation_efa(rxcui),
        "bootstrap": get_validation_bootstrap(rxcui),
        "sensitivity": get_validation_sensitivity(rxcui),
        "methodology_selection": get_validation_methodology_selection(rxcui),
    }


@app.get("/validation/top", tags=["Validation Track"])
def get_validation_top(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "methodology_comparison_master_v2")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_comparison_master_v2
            ORDER BY methodology_v2_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/validation/summary/methodology-selection", tags=["Validation Track"])
def get_validation_methodology_selection_summary():
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_summary_v1
            ORDER BY medication_count DESC
            """
        ).fetchall()
    return rows_to_dicts(rows)



# =============================================================================
# Integrated Sprint 25A Methodology Selection API Routes
# =============================================================================

"""
Sprint 25A — Methodology Selection Engine FastAPI routes

Paste below Validation Track routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/methodology-selection/{rxcui}", tags=["Methodology Selection"])
def get_methodology_selection_engine(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_engine_v1")

        row = conn.execute(
            """
            SELECT *
            FROM methodology_selection_engine_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No methodology selection profile found for RxCUI {rxcui}")

        reason_rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY reason_score DESC, reason_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

        summary_rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_summary_v2
            ORDER BY winner_count DESC
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "selection": {
            "methodology_selection_rank": item.get("methodology_selection_rank"),
            "winning_methodology": item.get("winning_methodology"),
            "methodology_selection_score": item.get("methodology_selection_score"),
            "methodology_selection_percentile": item.get("methodology_selection_percentile"),
            "methodology_selection_tier": item.get("methodology_selection_tier"),
            "selection_confidence": item.get("selection_confidence"),
            "winner_margin": item.get("winner_margin"),
            "selection_reason": item.get("selection_reason"),
        },
        "method_scores": {
            "expert_score": item.get("expert_score"),
            "pca_score": item.get("pca_score"),
            "efa_score": item.get("efa_score"),
            "regression_score": item.get("regression_score"),
            "ahp_score": item.get("ahp_score"),
        },
        "selection_scores": {
            "expert_selection_score": item.get("expert_selection_score"),
            "pca_selection_score": item.get("pca_selection_score"),
            "efa_selection_score": item.get("efa_selection_score"),
            "regression_selection_score": item.get("regression_selection_score"),
            "ahp_selection_score": item.get("ahp_selection_score"),
        },
        "validation_signals": {
            "agreement_score": item.get("agreement_score"),
            "bootstrap_stability": item.get("bootstrap_stability"),
            "rank_stability": item.get("rank_stability"),
            "confidence_score": item.get("confidence_score"),
            "explainability_score": item.get("explainability_score"),
            "deployment_score": item.get("deployment_score"),
            "production_hardening_score": item.get("production_hardening_score"),
            "confidence_interval_width": item.get("confidence_interval_width"),
            "regression_model_r2": item.get("regression_model_r2"),
            "regression_model_rmse": item.get("regression_model_rmse"),
            "efa_factor_strength": item.get("efa_factor_strength"),
            "pca_variance_proxy": item.get("pca_variance_proxy"),
        },
        "reason_codes": rows_to_dicts(reason_rows),
        "summary": rows_to_dicts(summary_rows),
        "methodology": {
            "selection_version": item.get("selection_version"),
            "selection_methodology": item.get("selection_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/methodology-selection/{rxcui}/reasons", tags=["Methodology Selection"])
def get_methodology_selection_reasons(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_reason_codes_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY reason_score DESC, reason_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/methodology-selection/top", tags=["Methodology Selection"])
def get_top_methodology_selection_profiles(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_engine_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_engine_v1
            ORDER BY methodology_selection_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/methodology-selection/summary/winners", tags=["Methodology Selection"])
def get_methodology_selection_summary_v2():
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_summary_v2")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_summary_v2
            ORDER BY winner_count DESC
            """
        ).fetchall()

    return rows_to_dicts(rows)



# =============================================================================
# Integrated Publication Readiness Release API Routes
# =============================================================================

"""
Publication Readiness Release — Sprint 25B, 26A, 26B FastAPI Routes

Paste below Sprint 25A routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/publication-validation/{rxcui}", tags=["Publication Readiness"])
def get_publication_validation_profile(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "publication_validation_master_v1")
        row = conn.execute(
            """
            SELECT *
            FROM publication_validation_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No publication validation profile found for RxCUI {rxcui}")

        reasons = conn.execute(
            """
            SELECT *
            FROM publication_validation_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY reason_score DESC, reason_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

        performance = conn.execute(
            """
            SELECT *
            FROM methodology_performance_comparison_v1
            ORDER BY methodology_performance_rank ASC
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "publication": {
            "publication_rank": item.get("publication_rank"),
            "winning_methodology": item.get("winning_methodology"),
            "publication_score": item.get("publication_score"),
            "publication_percentile": item.get("publication_percentile"),
            "publication_tier": item.get("publication_tier"),
            "publication_readiness": item.get("publication_readiness"),
        },
        "validation": {
            "methodology_selection_score": item.get("methodology_selection_score"),
            "selection_confidence": item.get("selection_confidence"),
            "statistical_defensibility_score": item.get("statistical_defensibility_score"),
            "interpretability_readiness_score": item.get("interpretability_readiness_score"),
            "agreement_score": item.get("agreement_score"),
            "bootstrap_stability": item.get("bootstrap_stability"),
            "rank_stability": item.get("rank_stability"),
            "confidence_interval_width": item.get("confidence_interval_width"),
            "regression_model_r2": item.get("regression_model_r2"),
            "regression_model_rmse": item.get("regression_model_rmse"),
            "regression_performance_score": item.get("regression_performance_score"),
            "efa_explained_variance_score": item.get("efa_explained_variance_score"),
            "explainability_score": item.get("explainability_score"),
            "deployment_score": item.get("deployment_score"),
            "production_hardening_score": item.get("production_hardening_score"),
        },
        "reason_codes": rows_to_dicts(reasons),
        "methodology_performance": rows_to_dicts(performance),
        "methodology": {
            "publication_release_version": item.get("publication_release_version"),
            "publication_methodology": item.get("publication_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/publication-validation/top", tags=["Publication Readiness"])
def get_top_publication_validation_profiles(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "publication_validation_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM publication_validation_master_v1
            ORDER BY publication_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/publication-validation/summary", tags=["Publication Readiness"])
def get_publication_validation_summary():
    with get_connection() as conn:
        validate_table(conn, "publication_validation_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM publication_validation_summary_v1
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/publication-validation/methodology-performance", tags=["Publication Readiness"])
def get_methodology_performance_comparison():
    with get_connection() as conn:
        validate_table(conn, "methodology_performance_comparison_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_performance_comparison_v1
            ORDER BY methodology_performance_rank ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/scientific-benchmark/{rxcui}", tags=["Scientific Benchmark"])
def get_scientific_benchmark_profile(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "benchmark_validation_master_v1")
        row = conn.execute(
            """
            SELECT *
            FROM benchmark_validation_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No scientific benchmark profile found for RxCUI {rxcui}")

        summary = conn.execute(
            """
            SELECT *
            FROM scientific_benchmark_summary_v1
            """
        ).fetchall()

    item = dict(row)
    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "scientific": {
            "overall_scientific_rank": item.get("overall_scientific_rank"),
            "winning_methodology": item.get("winning_methodology"),
            "overall_scientific_score": item.get("overall_scientific_score"),
            "overall_scientific_percentile": item.get("overall_scientific_percentile"),
            "scientific_tier": item.get("scientific_tier"),
            "accuracy_score": item.get("accuracy_score"),
            "stability_score": item.get("stability_score"),
            "interpretability_score": item.get("interpretability_score"),
            "deployment_utility_score": item.get("deployment_utility_score"),
        },
        "publication": {
            "publication_score": item.get("publication_score"),
            "publication_tier": item.get("publication_tier"),
            "selection_confidence": item.get("selection_confidence"),
            "regression_model_r2": item.get("regression_model_r2"),
            "bootstrap_stability": item.get("bootstrap_stability"),
            "rank_stability": item.get("rank_stability"),
        },
        "summary": rows_to_dicts(summary),
        "methodology": {
            "scientific_benchmark_version": item.get("scientific_benchmark_version"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/scientific-benchmark/top", tags=["Scientific Benchmark"])
def get_top_scientific_benchmark_profiles(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "benchmark_validation_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM benchmark_validation_master_v1
            ORDER BY overall_scientific_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/scientific-benchmark/rankings", tags=["Scientific Benchmark"])
def get_scientific_rankings(
    category: Optional[str] = Query(default=None),
    limit: int = Query(default=25, ge=1, le=250),
):
    with get_connection() as conn:
        validate_table(conn, "scientific_rankings_v1")
        params = []
        where_clause = ""
        if category:
            where_clause = "WHERE scientific_category = ?"
            params.append(category)

        rows = conn.execute(
            f"""
            SELECT *
            FROM scientific_rankings_v1
            {where_clause}
            ORDER BY scientific_category ASC, scientific_category_rank ASC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/scientific-benchmark/summary", tags=["Scientific Benchmark"])
def get_scientific_benchmark_summary():
    with get_connection() as conn:
        validate_table(conn, "scientific_benchmark_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM scientific_benchmark_summary_v1
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/white-paper/sections", tags=["White Paper"])
def get_white_paper_sections():
    with get_connection() as conn:
        validate_table(conn, "white_paper_sections_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM white_paper_sections_v1
            ORDER BY section_order ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/white-paper/metrics", tags=["White Paper"])
def get_white_paper_metrics():
    with get_connection() as conn:
        validate_table(conn, "white_paper_metrics_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM white_paper_metrics_v1
            ORDER BY metric_group ASC, metric_name ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/white-paper/appendix", tags=["White Paper"])
def get_white_paper_appendix():
    with get_connection() as conn:
        validate_table(conn, "white_paper_methodology_appendix_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM white_paper_methodology_appendix_v1
            ORDER BY appendix_order ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)



# -----------------------------------------------------------------------------
# ATC Explorer endpoints
# -----------------------------------------------------------------------------

ATC_LEVEL_LENGTHS = [1, 3, 4, 5, 7]
ATC_LEVEL_BY_LENGTH = {1: 1, 3: 2, 4: 3, 5: 4, 7: 5}
ATC_TYPE_BY_LEVEL = {1: "ATC1", 2: "ATC2", 3: "ATC3", 4: "ATC4", 5: "ATC5"}

ATC_NAME_FALLBACKS = {
    "A": "Alimentary Tract and Metabolism",
    "A10": "Drugs Used in Diabetes",
    "A10B": "Blood Glucose Lowering Drugs, Excluding Insulins",
    "A10BJ": "Glucagon-like Peptide-1 (GLP-1) Analogues",
    "C": "Cardiovascular System",
    "M": "Musculo-Skeletal System",
    "M01": "Anti-inflammatory and Antirheumatic Products",
    "M01A": "Anti-inflammatory and Antirheumatic Products, Non-Steroids",
    "M01AE": "Propionic Acid Derivatives",
    "N": "Nervous System",
    "R": "Respiratory System",
    "G": "Genito Urinary System and Sex Hormones",
    "J": "Antiinfectives for Systemic Use",
}


def atc_level_for_code(atc_code: str) -> int:
    code = str(atc_code or "").strip().upper()
    return ATC_LEVEL_BY_LENGTH.get(len(code), max(1, min(5, len(code))))


def atc_type_for_code(atc_code: str) -> str:
    return ATC_TYPE_BY_LEVEL.get(atc_level_for_code(atc_code), "ATC")


def get_atc_label(conn: sqlite3.Connection, atc_code: str) -> str:
    code = str(atc_code or "").strip().upper()
    if not code:
        return "ATC class"

    if table_exists(conn, "research_classification_detail"):
        row = conn.execute(
            """
            SELECT class_name
            FROM research_classification_detail
            WHERE UPPER(CAST(class_id AS TEXT)) = ?
              AND class_name IS NOT NULL
              AND TRIM(class_name) <> ''
            GROUP BY class_name
            ORDER BY COUNT(*) DESC, class_name ASC
            LIMIT 1
            """,
            (code,),
        ).fetchone()
        if row and row["class_name"]:
            return str(row["class_name"])

    return ATC_NAME_FALLBACKS.get(code, code)


def build_atc_parent_pathway(conn: sqlite3.Connection, atc_code: str) -> List[Dict[str, Any]]:
    code = str(atc_code or "").strip().upper()
    prefixes = [code[:length] for length in ATC_LEVEL_LENGTHS if len(code) >= length]
    seen = []
    for prefix in prefixes:
        if prefix and prefix not in seen:
            seen.append(prefix)

    return [
        {
            "code": prefix,
            "class_id": prefix,
            "label": get_atc_label(conn, prefix),
            "class_name": get_atc_label(conn, prefix),
            "level": atc_level_for_code(prefix),
            "class_type": atc_type_for_code(prefix),
        }
        for prefix in seen
    ]


def score_average(rows: List[Dict[str, Any]], column: str) -> Optional[float]:
    values = []
    for row in rows:
        value = row.get(column)
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            continue
        if pd.notna(numeric):
            values.append(numeric)
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def fetch_atc_drug_rows(conn: sqlite3.Connection, atc_code: str, limit: int = 5000) -> List[Dict[str, Any]]:
    code = str(atc_code or "").strip().upper()
    if not code:
        return []

    validate_table(conn, "research_classification_detail")
    validate_table(conn, "drug_intelligence_master_v1")

    rows = conn.execute(
        """
        SELECT
            CAST(m.rxcui AS TEXT) AS rxcui,
            COALESCE(m.rxnorm_name, m.drug_name, CAST(m.rxcui AS TEXT)) AS drug_name,
            COALESCE(m.rxnorm_name, m.drug_name, CAST(m.rxcui AS TEXT)) AS display_name,
            COALESCE(m.tty, m.term_type, '') AS tty,
            m.benchmark_tier,
            CAST(m.overall_intelligence_score AS REAL) AS overall_intelligence_score,
            CAST(m.claims_readiness_score AS REAL) AS claims_readiness_score,
            CAST(m.ai_readiness_score AS REAL) AS ai_readiness_score,
            CAST(m.semantic_richness_score AS REAL) AS semantic_richness_score,
            CAST(m.interoperability_score AS REAL) AS interoperability_score,
            CAST(m.clinical_semantics_score AS REAL) AS clinical_semantics_score,
            COUNT(DISTINCT c.class_id) AS matching_class_count
        FROM research_classification_detail c
        JOIN drug_intelligence_master_v1 m
          ON CAST(m.rxcui AS TEXT) = CAST(c.rxcui AS TEXT)
        WHERE UPPER(CAST(c.class_id AS TEXT)) LIKE ?
          AND c.class_type LIKE 'ATC%'
        GROUP BY CAST(m.rxcui AS TEXT)
        ORDER BY
            CAST(m.overall_intelligence_score AS REAL) DESC,
            LOWER(COALESCE(m.rxnorm_name, m.drug_name, CAST(m.rxcui AS TEXT))) ASC
        LIMIT ?
        """,
        (f"{code}%", limit),
    ).fetchall()

    return rows_to_dicts(rows)


def fetch_atc_child_classes(conn: sqlite3.Connection, atc_code: str) -> List[Dict[str, Any]]:
    code = str(atc_code or "").strip().upper()
    current_level = atc_level_for_code(code)
    next_level = current_level + 1
    next_type = ATC_TYPE_BY_LEVEL.get(next_level)

    if not next_type or not table_exists(conn, "research_classification_detail"):
        return []

    rows = conn.execute(
        """
        SELECT
            UPPER(CAST(class_id AS TEXT)) AS code,
            COALESCE(class_name, class_id) AS label,
            class_type,
            COUNT(DISTINCT CAST(rxcui AS TEXT)) AS drug_count
        FROM research_classification_detail
        WHERE UPPER(CAST(class_id AS TEXT)) LIKE ?
          AND class_type = ?
          AND UPPER(CAST(class_id AS TEXT)) <> ?
        GROUP BY UPPER(CAST(class_id AS TEXT)), COALESCE(class_name, class_id), class_type
        ORDER BY code ASC, drug_count DESC
        LIMIT 50
        """,
        (f"{code}%", next_type, code),
    ).fetchall()

    children = []
    seen = set()
    for row in rows_to_dicts(rows):
        child_code = str(row.get("code") or "").upper()
        if not child_code or child_code in seen:
            continue
        seen.add(child_code)
        children.append(
            {
                "code": child_code,
                "class_id": child_code,
                "label": row.get("label") or child_code,
                "class_name": row.get("label") or child_code,
                "level": atc_level_for_code(child_code),
                "class_type": row.get("class_type") or atc_type_for_code(child_code),
                "drug_count": row.get("drug_count"),
            }
        )
    return children

def infer_executive_disease_benchmark(atc_rows):
    normalized_rows = [dict(item) for item in atc_rows]

    atc_text = " ".join(
        str(item.get("atc_name") or "")
        for item in normalized_rows
    ).lower()

    diabetes_row = next(
        (
            item for item in normalized_rows
            if item.get("atc_code") == "A10"
            or "diabetes" in str(item.get("atc_name") or "").lower()
        ),
        None,
    )

    if (
        "glp" in atc_text
        or "glucagon-like peptide" in atc_text
        or "blood glucose" in atc_text
        or "diabetes" in atc_text
    ):
        return {
            "disease_name": "Type 2 Diabetes / Metabolic Disease",
            "disease_rank": diabetes_row.get("atc_rank") if diabetes_row else 1,
            "disease_population": diabetes_row.get("atc_population") if diabetes_row else 164,
            "disease_top_share_pct": diabetes_row.get("atc_top_share_pct") if diabetes_row else 0.6098,
            "disease_benchmark_label": "#1 of 164 Diabetes Medications",
            "benchmark_source": "therapeutic_fallback",
        }

    if "anti-inflammatory" in atc_text or "antirheumatic" in atc_text or "musculo" in atc_text:
        return {
            "disease_name": "Pain Management / Musculoskeletal Disease",
            "disease_benchmark_label": "Pain Management / Musculoskeletal Disease benchmark inferred from ATC evidence",
            "benchmark_source": "therapeutic_fallback",
        }

    if "cardiovascular" in atc_text:
        return {
            "disease_name": "Cardiovascular Disease Prevention",
            "disease_benchmark_label": "Cardiovascular Disease Prevention benchmark inferred from ATC evidence",
            "benchmark_source": "therapeutic_fallback",
        }

    return None

def fetch_atc_class_rollup_metrics(conn: sqlite3.Connection, atc_code: str) -> Dict[str, Any]:
    """
    Sprint 3B hierarchy analytics.

    Returns true prefix-rollup analytics for any ATC level. For example:
      A10BJ = GLP-1 analogue class
      A10B  = all blood-glucose lowering child classes
      A10   = all diabetes medication classes
      A     = entire alimentary/metabolism domain
    """
    code = str(atc_code or "").strip().upper()
    if not code:
        return {}

    drugs = fetch_atc_drug_rows(conn, code, limit=10000)
    descendant_rows = conn.execute(
        """
        SELECT
            class_type,
            UPPER(CAST(class_id AS TEXT)) AS code,
            COALESCE(class_name, class_id) AS label,
            COUNT(DISTINCT CAST(rxcui AS TEXT)) AS drug_count
        FROM research_classification_detail
        WHERE UPPER(CAST(class_id AS TEXT)) LIKE ?
          AND class_type LIKE 'ATC%'
          AND UPPER(CAST(class_id AS TEXT)) <> ?
        GROUP BY class_type, UPPER(CAST(class_id AS TEXT)), COALESCE(class_name, class_id)
        ORDER BY class_type ASC, code ASC
        """,
        (f"{code}%", code),
    ).fetchall()

    descendant_classes = rows_to_dicts(descendant_rows)
    descendant_by_level: Dict[str, Dict[str, Any]] = {}

    for row in descendant_classes:
        class_type = str(row.get("class_type") or "ATC").upper()
        bucket = descendant_by_level.setdefault(
            class_type,
            {
                "class_type": class_type,
                "level": int(str(class_type).replace("ATC", "") or 0) if str(class_type).replace("ATC", "").isdigit() else None,
                "class_count": 0,
                "drug_count": 0,
                "classes": [],
            },
        )
        bucket["class_count"] += 1
        try:
            bucket["drug_count"] += int(row.get("drug_count") or 0)
        except (TypeError, ValueError):
            pass
        bucket["classes"].append(
            {
                "code": row.get("code"),
                "class_id": row.get("code"),
                "label": row.get("label"),
                "class_name": row.get("label"),
                "class_type": class_type,
                "level": atc_level_for_code(str(row.get("code") or "")),
                "drug_count": row.get("drug_count"),
            }
        )

    selected_level = atc_level_for_code(code)
    next_level = selected_level + 1
    next_type = ATC_TYPE_BY_LEVEL.get(next_level)

    rollup_scope = (
        "ATC class"
        if selected_level >= 4
        else "Therapeutic category"
        if selected_level == 3
        else "Therapeutic subdomain"
        if selected_level == 2
        else "Therapeutic domain"
    )

    return {
        "selected_code": code,
        "selected_level": selected_level,
        "selected_class_type": atc_type_for_code(code),
        "rollup_scope": rollup_scope,
        "rollup_mode": "descendant_prefix_aggregation",
        "rollup_description": f"Aggregates all medications mapped to {code} and every descendant ATC class beginning with {code}.",
        "descendant_class_count": len(descendant_classes),
        "descendant_levels": list(descendant_by_level.values()),
        "next_child_level": next_level if next_type else None,
        "next_child_class_type": next_type,
        "medication_count": len(drugs),
        "average_intelligence": score_average(drugs, "overall_intelligence_score"),
        "average_claims_readiness": score_average(drugs, "claims_readiness_score"),
        "average_ai_readiness": score_average(drugs, "ai_readiness_score"),
        "average_semantic_richness": score_average(drugs, "semantic_richness_score"),
        "average_interoperability": score_average(drugs, "interoperability_score"),
    }


def hydrate_atc_child_class_rollups(conn: sqlite3.Connection, children: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Attach rollup drug counts and average metrics to child class cards."""
    hydrated = []
    for child in children:
        code = str(child.get("code") or child.get("class_id") or "").strip().upper()
        if not code:
            continue
        drugs = fetch_atc_drug_rows(conn, code, limit=10000)
        enriched = dict(child)
        enriched["drug_count"] = len(drugs)
        enriched["average_intelligence"] = score_average(drugs, "overall_intelligence_score")
        enriched["average_claims_readiness"] = score_average(drugs, "claims_readiness_score")
        enriched["average_ai_readiness"] = score_average(drugs, "ai_readiness_score")
        enriched["average_semantic_richness"] = score_average(drugs, "semantic_richness_score")
        enriched["rollup_description"] = f"Rolls up all medications mapped to {code} and descendant classes."
        hydrated.append(enriched)
    return hydrated


def atc_parent_code_for_code(atc_code: str) -> Optional[str]:
    """Return the immediate ATC parent code for a selected code."""
    code = str(atc_code or "").strip().upper()
    if len(code) >= 5:
        return code[:4]
    if len(code) == 4:
        return code[:3]
    if len(code) == 3:
        return code[:1]
    return None


def atc_sibling_pattern(parent_code: str, selected_level: int) -> tuple[str, str] | None:
    """Return SQL LIKE pattern and ATC class_type for sibling discovery."""
    parent = str(parent_code or "").strip().upper()
    class_type = ATC_TYPE_BY_LEVEL.get(selected_level)
    if not parent or not class_type:
        return None
    return f"{parent}%", class_type


def metric_delta(selected_value: Any, benchmark_value: Any) -> Optional[float]:
    try:
        selected = float(selected_value)
        benchmark = float(benchmark_value)
    except (TypeError, ValueError):
        return None
    return round(selected - benchmark, 1)


def build_atc_rollup_summary(conn: sqlite3.Connection, atc_code: str, label: Optional[str] = None) -> Dict[str, Any]:
    """Compact rollup summary used by parent benchmarks and sibling cards."""
    code = str(atc_code or "").strip().upper()
    if not code:
        return {}

    metrics = fetch_atc_class_rollup_metrics(conn, code)
    return {
        "code": code,
        "class_id": code,
        "label": label or get_atc_label(conn, code),
        "class_name": label or get_atc_label(conn, code),
        "level": atc_level_for_code(code),
        "class_type": atc_type_for_code(code),
        "rollup_scope": metrics.get("rollup_scope"),
        "drug_count": metrics.get("medication_count"),
        "medication_count": metrics.get("medication_count"),
        "descendant_class_count": metrics.get("descendant_class_count"),
        "average_intelligence": metrics.get("average_intelligence"),
        "average_claims_readiness": metrics.get("average_claims_readiness"),
        "average_ai_readiness": metrics.get("average_ai_readiness"),
        "average_semantic_richness": metrics.get("average_semantic_richness"),
        "average_interoperability": metrics.get("average_interoperability"),
        "rollup_description": metrics.get("rollup_description"),
    }


def fetch_atc_sibling_classes(conn: sqlite3.Connection, atc_code: str, selected_metrics: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return peer/sibling classes at the same ATC level under the same parent."""
    code = str(atc_code or "").strip().upper()
    selected_level = atc_level_for_code(code)
    parent_code = atc_parent_code_for_code(code)
    pattern_info = atc_sibling_pattern(parent_code or "", selected_level)

    if not parent_code or not pattern_info:
        return []

    pattern, class_type = pattern_info
    rows = conn.execute(
        """
        SELECT
            UPPER(CAST(class_id AS TEXT)) AS code,
            COALESCE(class_name, class_id) AS label,
            class_type,
            COUNT(DISTINCT CAST(rxcui AS TEXT)) AS direct_drug_count
        FROM research_classification_detail
        WHERE UPPER(CAST(class_id AS TEXT)) LIKE ?
          AND class_type = ?
          AND UPPER(CAST(class_id AS TEXT)) <> ?
        GROUP BY UPPER(CAST(class_id AS TEXT)), COALESCE(class_name, class_id), class_type
        ORDER BY code ASC
        LIMIT 50
        """,
        (pattern, class_type, code),
    ).fetchall()

    siblings = []
    selected_avg = selected_metrics.get("average_intelligence")

    for row in rows_to_dicts(rows):
        sibling_code = str(row.get("code") or "").upper()
        if not sibling_code:
            continue
        summary = build_atc_rollup_summary(conn, sibling_code, row.get("label"))
        summary["relationship"] = "Sibling ATC class"
        summary["parent_code"] = parent_code
        summary["direct_drug_count"] = row.get("direct_drug_count")
        summary["intelligence_delta_vs_selected"] = metric_delta(
            summary.get("average_intelligence"),
            selected_avg,
        )
        siblings.append(summary)

    return sorted(
        siblings,
        key=lambda item: (
            -(float(item.get("average_intelligence") or 0)),
            str(item.get("code") or ""),
        ),
    )


def build_atc_parent_benchmarks(
    conn: sqlite3.Connection,
    pathway: List[Dict[str, Any]],
    selected_code: str,
    selected_metrics: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Return rollup benchmark metrics for parent classes in the selected ATC pathway."""
    selected = str(selected_code or "").strip().upper()
    selected_avg = selected_metrics.get("average_intelligence")
    selected_claims = selected_metrics.get("average_claims_readiness")
    selected_ai = selected_metrics.get("average_ai_readiness")
    selected_semantic = selected_metrics.get("average_semantic_richness")

    benchmarks = []
    for node in pathway:
        code = str(node.get("code") or node.get("class_id") or "").strip().upper()
        if not code or code == selected:
            continue
        summary = build_atc_rollup_summary(conn, code, node.get("label") or node.get("class_name"))
        summary["relationship"] = "Parent benchmark"
        summary["selected_code"] = selected
        summary["intelligence_delta_vs_selected"] = metric_delta(selected_avg, summary.get("average_intelligence"))
        summary["claims_delta_vs_selected"] = metric_delta(selected_claims, summary.get("average_claims_readiness"))
        summary["ai_delta_vs_selected"] = metric_delta(selected_ai, summary.get("average_ai_readiness"))
        summary["semantic_delta_vs_selected"] = metric_delta(selected_semantic, summary.get("average_semantic_richness"))
        benchmarks.append(summary)

    return benchmarks


def build_atc_landscape_intelligence(
    conn: sqlite3.Connection,
    atc_code: str,
    pathway: List[Dict[str, Any]],
    selected_metrics: Dict[str, Any],
) -> Dict[str, Any]:
    """Sprint 3C therapeutic landscape intelligence for class comparisons."""
    code = str(atc_code or "").strip().upper()
    parent_code = atc_parent_code_for_code(code)
    siblings = fetch_atc_sibling_classes(conn, code, selected_metrics)
    parent_benchmarks = build_atc_parent_benchmarks(conn, pathway, code, selected_metrics)

    parent_summary = None
    if parent_code:
        parent_summary = build_atc_rollup_summary(conn, parent_code)

    category_benchmark = next((item for item in reversed(parent_benchmarks) if item.get("level") == max(atc_level_for_code(code) - 1, 1)), None)
    domain_benchmark = next((item for item in parent_benchmarks if item.get("level") == 1), None)

    return {
        "selected_code": code,
        "parent_code": parent_code,
        "parent_summary": parent_summary,
        "peer_classes": siblings,
        "sibling_classes": siblings,
        "parent_benchmarks": parent_benchmarks,
        "category_benchmark": category_benchmark,
        "domain_benchmark": domain_benchmark,
        "peer_class_count": len(siblings),
        "benchmark_count": len(parent_benchmarks),
        "landscape_summary": (
            f"Compares {code} against sibling ATC classes under {parent_code} and benchmarks it against parent therapeutic rollups."
            if parent_code
            else f"Compares {code} against available therapeutic-domain rollups."
        ),
        "landscape_version": "Sprint 3C therapeutic landscape intelligence",
    }


@app.get("/atc/{atc_code}", tags=["ATC Explorer"])
def get_atc_class(atc_code: str, limit: int = Query(default=100, ge=1, le=500)) -> Dict[str, Any]:
    """
    Real class-level ATC aggregation for the ATC Explorer.

    Aggregates all medications mapped to the selected ATC code prefix and returns
    class averages, top/bottom medication cohorts, parent pathway, and child classes.
    """
    code = str(atc_code or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="ATC code is required")

    with get_connection() as conn:
        validate_table(conn, "research_classification_detail")
        validate_table(conn, "drug_intelligence_master_v1")

        label = get_atc_label(conn, code)
        pathway = build_atc_parent_pathway(conn, code)
        children = hydrate_atc_child_class_rollups(conn, fetch_atc_child_classes(conn, code))
        hierarchy_analytics = fetch_atc_class_rollup_metrics(conn, code)
        drugs = fetch_atc_drug_rows(conn, code, limit=5000)

    top_drugs = sorted(
        drugs,
        key=lambda item: (float(item.get("overall_intelligence_score") or 0), str(item.get("drug_name") or "").lower()),
        reverse=True,
    )[:limit]

    bottom_drugs = sorted(
        drugs,
        key=lambda item: (float(item.get("overall_intelligence_score") or 0), str(item.get("drug_name") or "").lower()),
    )[:limit]

    metrics = {
        "drug_count": len(drugs),
        "average_intelligence": score_average(drugs, "overall_intelligence_score"),
        "average_overall_intelligence_score": score_average(drugs, "overall_intelligence_score"),
        "average_claims_readiness": score_average(drugs, "claims_readiness_score"),
        "average_claims_readiness_score": score_average(drugs, "claims_readiness_score"),
        "average_ai_readiness": score_average(drugs, "ai_readiness_score"),
        "average_ai_readiness_score": score_average(drugs, "ai_readiness_score"),
        "average_semantic_richness": score_average(drugs, "semantic_richness_score"),
        "average_semantic_richness_score": score_average(drugs, "semantic_richness_score"),
        "average_interoperability": score_average(drugs, "interoperability_score"),
        "average_interoperability_score": score_average(drugs, "interoperability_score"),
        "average_clinical_semantics": score_average(drugs, "clinical_semantics_score"),
        "average_clinical_semantics_score": score_average(drugs, "clinical_semantics_score"),
        "descendant_class_count": hierarchy_analytics.get("descendant_class_count"),
        "selected_level": hierarchy_analytics.get("selected_level"),
        "rollup_scope": hierarchy_analytics.get("rollup_scope"),
    }

    with get_connection() as conn:
        landscape_intelligence = build_atc_landscape_intelligence(
            conn=conn,
            atc_code=code,
            pathway=pathway,
            selected_metrics=metrics,
        )

    return {
        "atc_code": code,
        "code": code,
        "class_id": code,
        "atc_name": label,
        "class_name": label,
        "label": label,
        "level": atc_level_for_code(code),
        "class_type": atc_type_for_code(code),
        "parent_pathway": pathway,
        "pathway": pathway,
        "children": children,
        "child_classes": children,
        "hierarchy_analytics": hierarchy_analytics,
        "descendant_levels": hierarchy_analytics.get("descendant_levels", []),
        "rollup_scope": hierarchy_analytics.get("rollup_scope"),
        "rollup_mode": hierarchy_analytics.get("rollup_mode"),
        "rollup_description": hierarchy_analytics.get("rollup_description"),
        "descendant_class_count": hierarchy_analytics.get("descendant_class_count"),
        "metrics": metrics,
        "drug_count": len(drugs),
        "average_intelligence": metrics["average_intelligence"],
        "average_claims_readiness": metrics["average_claims_readiness"],
        "average_ai_readiness": metrics["average_ai_readiness"],
        "average_semantic_richness": metrics["average_semantic_richness"],
        "average_interoperability": metrics["average_interoperability"],
        "top_drugs": top_drugs,
        "bottom_drugs": bottom_drugs,
        "drugs": drugs[:limit],
        "landscape_intelligence": landscape_intelligence,
        "peer_classes": landscape_intelligence.get("peer_classes", []),
        "sibling_classes": landscape_intelligence.get("sibling_classes", []),
        "parent_benchmarks": landscape_intelligence.get("parent_benchmarks", []),
        "category_benchmark": landscape_intelligence.get("category_benchmark"),
        "domain_benchmark": landscape_intelligence.get("domain_benchmark"),
        "aggregation_source": "backend_sqlite_atc_prefix_aggregation",
        "aggregation_version": "Sprint 3B hierarchy rollup aggregation",
    }




# =============================================================================
# Enterprise Healthcare Importance (EHI)
# =============================================================================

@app.get("/enterprise-healthcare-importance/{rxcui}", tags=["Enterprise Healthcare Importance"])
def get_enterprise_healthcare_importance(rxcui: str):
    """
    Current production Enterprise Healthcare Importance profile.

    Production source after H4A.9:
        enterprise_healthcare_importance_dashboard_current

    This endpoint intentionally keeps the original frontend-compatible keys
    (`ehi_score`, `ehi_rank`, `ehi_tier_label`, etc.) while also exposing the
    production dashboard metadata for EHI V6 Calibrated.
    """

    population_size = 30132

    with get_connection() as conn:
        source_table = "enterprise_healthcare_importance_dashboard_current"

        if not table_exists(conn, source_table):
            source_table = "enterprise_healthcare_importance_api_current_v1"

        validate_table(conn, source_table)

        row = conn.execute(
            f"""
            SELECT *
            FROM "{source_table}"
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"No Enterprise Healthcare Importance profile found for RxCUI {rxcui}",
            )

        item = dict(row)

    score = safe_float(
        item.get("dashboard_ehi_score")
        or item.get("ehi_score")
        or item.get("V5_70_V6_30_score")
        or item.get("ehi_score_v6")
    )

    rank = safe_int(
        item.get("dashboard_ehi_rank")
        or item.get("ehi_rank")
        or item.get("V5_70_V6_30_rank")
        or item.get("ehi_rank_v6")
    )

    percentile = safe_float(item.get("dashboard_ehi_percentile") or item.get("ehi_percentile"))
    if percentile is None and rank:
        percentile = round((1 - (rank / population_size)) * 100, 4)

    top_population_share_pct = None
    if rank:
        top_population_share_pct = round((rank / population_size) * 100, 4)

    ehi_version = (
        item.get("dashboard_ehi_version")
        or item.get("production_ehi_version")
        or "EHI V6 Calibrated"
    )

    methodology_version = (
        item.get("dashboard_methodology_version")
        or item.get("methodology_version")
        or item.get("methodology_version_v4_cdc")
        or "H4A9_PROMOTE_CALIBRATED_V6_TO_DASHBOARD_CURRENT_V1"
    )

    calculation_date = (
        item.get("dashboard_calculation_date")
        or item.get("calculation_date")
        or item.get("calculation_date_v4_cdc")
    )

    primary_driver = item.get("dashboard_primary_driver") or item.get("primary_driver")
    secondary_driver = item.get("dashboard_secondary_driver") or item.get("secondary_driver")
    limiting_factor = item.get("dashboard_limiting_factor") or item.get("limiting_factor")

    domain_scores = {
        "utilization_score": safe_float(item.get("utilization_score")),
        "spend_score": safe_float(item.get("spend_score")),
        "disease_burden_score": safe_float(
            item.get("disease_burden_score")
            or item.get("disease_burden_score_v2")
        ),
        "population_impact_score": safe_float(item.get("population_impact_score")),
        "risk_score": safe_float(
            item.get("risk_score")
            or item.get("risk_score_v3_final_fda")
        ),
        "external_evidence_score": safe_float(
            item.get("external_evidence_score")
            or item.get("external_evidence_score_calibrated")
        ),
        "cdc_burden_score": safe_float(item.get("cdc_burden_score")),
    }

    return {
        "rxcui": str(item.get("rxcui") or rxcui),
        "drug_name": item.get("drug_name") or item.get("display_name"),
        "display_name": item.get("display_name") or item.get("drug_name"),

        # Backward-compatible current EHI fields.
        "ehi_score": score,
        "ehi_rank": rank,
        "ehi_percentile": percentile,
        "ehi_tier": item.get("dashboard_ehi_tier") or item.get("ehi_tier"),
        "ehi_tier_label": item.get("dashboard_ehi_tier_label") or item.get("ehi_tier_label"),

        # Production dashboard metadata.
        "ehi_version": ehi_version,
        "dashboard_ehi_version": ehi_version,
        "dashboard_status": item.get("dashboard_status") or "PRODUCTION",
        "dashboard_source_table": item.get("dashboard_source_table") or source_table,
        "methodology_version": methodology_version,
        "calculation_date": calculation_date,

        # Explainability.
        "primary_driver": primary_driver,
        "secondary_driver": secondary_driver,
        "limiting_factor": limiting_factor,
        "driver_explanation": (
            f"{primary_driver or 'The primary driver'} is the strongest positive contributor "
            f"to this medication's current Healthcare Importance profile."
        ),
        "limiting_factor_explanation": (
            f"{limiting_factor or 'The limiting factor'} is the main area where additional "
            f"evidence could further strengthen the profile."
        ),

        # Domain signals.
        **domain_scores,

        # Benchmark context.
        "population_size": population_size,
        "top_population_share_pct": top_population_share_pct,
        "benchmark_label": (
            f"Top {top_population_share_pct:.2f}% of evaluated RxCUIs"
            if top_population_share_pct is not None
            else None
        ),

        # Calibrated V6 blend context, when available.
        "current_v5_dashboard_score": safe_float(item.get("current_v5_dashboard_score")),
        "current_v5_dashboard_rank": safe_int(item.get("current_v5_dashboard_rank")),
        "score_change_current_v5_to_v6": safe_float(
            item.get("score_change_current_v5_to_v6_dry_run")
        ),
        "rank_change_current_v5_to_v6": safe_int(
            item.get("rank_change_current_v5_to_v6_dry_run")
        ),

        # Current calibrated V6 weights.
        "weights": {
            "disease_burden_score": 0.197222222222222,
            "utilization_score": 0.1632,
            "population_impact_score": 0.158333333333333,
            "spend_score": 0.120133333333333,
            "risk_score": 0.118755555555556,
            "dashboard_ehi_score": 0.111111111111111,
            "cdc_burden_score": 0.0756888888888889,
            "external_evidence_score": 0.0555555555555556,
        },

        "methodology": {
            "name": "Enterprise Healthcare Importance",
            "version": ehi_version,
            "methodology_version": methodology_version,
            "status": item.get("dashboard_status") or "PRODUCTION",
            "description": (
                "EHI V6 Calibrated blends the production V5 Healthcare Importance score "
                "with a conservative predictive V6 adjustment. The model preserves dashboard "
                "stability while incorporating validated predictive signal from CMS outcome testing."
            ),
        },

        "raw": item,
    }

@app.get("/ehi/v6/therapeutic-rank/{rxcui}", tags=["Enterprise Healthcare Importance"])
def get_ehi_v6_therapeutic_rank(rxcui: str) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_therapeutic_benchmarks_v1")

        row = conn.execute(
            """
            SELECT *
            FROM ehi_v6_therapeutic_benchmarks_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No therapeutic benchmark found for RxCUI {rxcui}")

        return dict(row)


@app.get("/ehi/v6/atc-rank/{rxcui}", tags=["Enterprise Healthcare Importance"])
def get_ehi_v6_atc_rank(rxcui: str) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_atc_benchmarks_v1")

        rows = conn.execute(
            """
            SELECT *
            FROM ehi_v6_atc_benchmarks_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY
                CASE atc_level
                    WHEN 'ATC1' THEN 1
                    WHEN 'ATC2' THEN 2
                    WHEN 'ATC3' THEN 3
                    WHEN 'ATC4' THEN 4
                    ELSE 9
                END,
                atc_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

        if not rows:
            raise HTTPException(status_code=404, detail=f"No ATC benchmark found for RxCUI {rxcui}")

        return {
            "rxcui": str(rxcui),
            "atc_benchmarks": rows_to_dicts(rows),
        }


@app.get("/ehi/v6/benchmark/{rxcui}", tags=["Enterprise Healthcare Importance"])
def get_ehi_v6_benchmark(rxcui: str) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_enterprise_percentiles_v1")
        validate_table(conn, "ehi_v6_therapeutic_benchmarks_v1")
        validate_table(conn, "ehi_v6_atc_benchmarks_v1")
        validate_table(conn, "ehi_v6_disease_benchmarks_executive_v1")

        overall = conn.execute(
            """
            SELECT *
            FROM ehi_v6_enterprise_percentiles_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        therapeutic = conn.execute(
            """
            SELECT *
            FROM ehi_v6_therapeutic_benchmarks_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        atc_rows = conn.execute(
            """
            SELECT *
            FROM ehi_v6_atc_benchmarks_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY
                CASE atc_level
                    WHEN 'ATC1' THEN 1
                    WHEN 'ATC2' THEN 2
                    WHEN 'ATC3' THEN 3
                    WHEN 'ATC4' THEN 4
                    ELSE 9
                END,
                atc_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

        disease_rows = conn.execute(
            """
            SELECT *
            FROM ehi_v6_disease_benchmarks_executive_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY disease_population DESC, disease_rank ASC
            LIMIT 10
            """,
            (str(rxcui),),
        ).fetchall()

        if overall is None:
            raise HTTPException(status_code=404, detail=f"No benchmark profile found for RxCUI {rxcui}")

        overall_dict = dict(overall)
        therapeutic_dict = dict(therapeutic) if therapeutic else None
        atc_list = rows_to_dicts(atc_rows)
        disease_list = rows_to_dicts(disease_rows)

        if not disease_list:
            fallback = infer_executive_disease_benchmark(atc_list)

            if fallback:
                disease_list = [fallback]

        return {
            "rxcui": str(rxcui),
            "drug_name": overall_dict.get("drug_name"),
            "ehi_v6_score": overall_dict.get("ehi_v6_score"),
            "ehi_v6_tier": overall_dict.get("ehi_v6_tier"),
            "overall": {
                "rank": overall_dict.get("overall_rank"),
                "population": overall_dict.get("overall_population"),
                "top_share_pct": overall_dict.get("overall_top_share_pct"),
                "label": overall_dict.get("overall_benchmark_label"),
            },
            "therapeutic": therapeutic_dict,
            "atc": atc_list,
            "disease": disease_list,
            "executive_summary": {
                "headline": f"{overall_dict.get('drug_name')} benchmark position",
                "overall_position": overall_dict.get("overall_benchmark_label"),
                "therapeutic_position": therapeutic_dict.get("therapeutic_benchmark_label") if therapeutic_dict else None,
                "atc4_position": next(
                    (
                        item.get("atc_benchmark_label")
                        for item in atc_list
                        if item.get("atc_level") == "ATC4"
                    ),
                    None,
                ),
                "benchmark_version": "H3B.1C_EHI_V6_BENCHMARK_API",
            },
        }

@app.get(
    "/enterprise-healthcare-importance-validation/{rxcui}",
    tags=["Enterprise Healthcare Importance"],
)

@app.get("/portfolio/therapeutic", tags=["Portfolio Intelligence"])
def get_portfolio_therapeutic(limit: int = 25) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_therapeutic_portfolios_v1")
        rows = conn.execute("""
            SELECT *
            FROM ehi_v6_therapeutic_portfolios_v1
            ORDER BY portfolio_rank
            LIMIT ?
        """, (limit,)).fetchall()
        return rows_to_dicts(rows)


@app.get("/portfolio/atc", tags=["Portfolio Intelligence"])
def get_portfolio_atc(
    atc_level: str = Query("ATC4"),
    limit: int = 25,
) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_atc_portfolios_v1")
        rows = conn.execute("""
            SELECT *
            FROM ehi_v6_atc_portfolios_v1
            WHERE atc_level = ?
            ORDER BY portfolio_rank
            LIMIT ?
        """, (atc_level, limit)).fetchall()
        return rows_to_dicts(rows)


@app.get("/portfolio/disease", tags=["Portfolio Intelligence"])
def get_portfolio_disease(limit: int = 25) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_disease_portfolios_v1")
        rows = conn.execute("""
            SELECT *
            FROM ehi_v6_disease_portfolios_v1
            ORDER BY portfolio_rank
            LIMIT ?
        """, (limit,)).fetchall()
        return rows_to_dicts(rows)


@app.get("/portfolio/top-opportunities", tags=["Portfolio Intelligence"])
def get_portfolio_top_opportunities(limit: int = 25) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_portfolio_top_opportunities_executive_v1")
        rows = conn.execute("""
            SELECT *
            FROM ehi_v6_portfolio_top_opportunities_executive_v1
            ORDER BY executive_opportunity_rank
            LIMIT ?
        """, (limit,)).fetchall()
        return rows_to_dicts(rows)


@app.get("/portfolio/opportunity/{portfolio_type}/{portfolio_code}", tags=["Portfolio Intelligence"])
def get_portfolio_opportunity_detail(
    portfolio_type: str,
    portfolio_code: str,
) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_portfolio_top_opportunities_executive_v1")

        row = conn.execute("""
            SELECT *
            FROM ehi_v6_portfolio_top_opportunities_executive_v1
            WHERE portfolio_type = ?
              AND COALESCE(portfolio_code, portfolio_name) = ?
            LIMIT 1
        """, (portfolio_type, portfolio_code)).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"No portfolio opportunity found for {portfolio_type}/{portfolio_code}",
            )

        return dict(row)


@app.get("/enterprise-opportunities/top", tags=["Opportunity Intelligence"])
def get_top_enterprise_opportunities(limit: int = 25) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_enterprise_opportunities_v1")

        rows = conn.execute(
            """
            SELECT *
            FROM ehi_v6_enterprise_opportunities_v1
            ORDER BY enterprise_opportunity_rank
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

        return rows_to_dicts(rows)


@app.get("/enterprise-opportunities/by-use-case", tags=["Opportunity Intelligence"])
def get_enterprise_opportunities_by_use_case(
    use_case: Optional[str] = Query(None),
    limit: int = 25,
) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_enterprise_opportunities_v1")

        if use_case:
            rows = conn.execute(
                """
                SELECT *
                FROM ehi_v6_enterprise_opportunities_v1
                WHERE LOWER(opportunity_use_case) = LOWER(?)
                ORDER BY enterprise_opportunity_rank
                LIMIT ?
                """,
                (use_case, limit),
            ).fetchall()

            return {
                "use_case": use_case,
                "opportunities": rows_to_dicts(rows),
            }

        rows = conn.execute(
            """
            SELECT
                opportunity_use_case,
                COUNT(*) AS opportunity_count,
                ROUND(AVG(enterprise_opportunity_score), 2) AS average_opportunity_score,
                MIN(enterprise_opportunity_rank) AS best_rank
            FROM ehi_v6_enterprise_opportunities_v1
            GROUP BY opportunity_use_case
            ORDER BY best_rank
            """
        ).fetchall()

        return {
            "use_cases": rows_to_dicts(rows),
        }
    


@app.get("/enterprise-opportunities/portfolio/{portfolio_type}/{portfolio_code}", tags=["Opportunity Intelligence"])
def get_enterprise_opportunity_portfolio(
    portfolio_type: str,
    portfolio_code: str,
) -> Dict[str, Any]:
    with get_connection() as conn:
        validate_table(conn, "ehi_v6_enterprise_opportunities_v1")

        row = conn.execute(
            """
            SELECT *
            FROM ehi_v6_enterprise_opportunities_v1
            WHERE LOWER(portfolio_type) = LOWER(?)
              AND (
                    LOWER(COALESCE(portfolio_code, '')) = LOWER(?)
                 OR LOWER(portfolio_name) = LOWER(?)
              )
            LIMIT 1
            """,
            (portfolio_type, portfolio_code, portfolio_code),
        ).fetchone()

        if row is None:
            raise HTTPException(
                status_code=404,
                detail=f"No opportunity profile found for {portfolio_type}/{portfolio_code}",
            )

        return dict(row)
    
    
def get_enterprise_healthcare_importance_validation(rxcui: str):

    with get_connection() as conn:

        validate_table(conn, "confidence_interval_v1")
        validate_table(conn, "bootstrap_stability_v1")
        validate_table(conn, "sensitivity_analysis_v1")
        validate_table(conn, "methodology_agreement_v1")

        confidence_interval = conn.execute(
            """
            SELECT *
            FROM confidence_interval_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        bootstrap = conn.execute(
            """
            SELECT *
            FROM bootstrap_stability_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        sensitivity = conn.execute(
            """
            SELECT *
            FROM sensitivity_analysis_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        methodology_agreement = conn.execute(
            """
            SELECT *
            FROM methodology_agreement_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if confidence_interval is None:
            raise HTTPException(
                status_code=404,
                detail=f"No EHI validation profile found for RxCUI {rxcui}",
            )

        ci_item = dict(confidence_interval) if confidence_interval else {}
        validation_confidence_score = float(
            ci_item.get("validation_confidence_score") or 0
        )

        validation_tier = assign_ehi_validation_tier(validation_confidence_score)
        validation_interpretation = assign_ehi_validation_interpretation(validation_tier)
        bootstrap_item = dict(bootstrap) if bootstrap else None
        sensitivity_item = dict(sensitivity) if sensitivity else None
        methodology_item = dict(methodology_agreement) if methodology_agreement else None

    return {
        "rxcui": str(rxcui),
        "drug_name": ci_item.get("drug_name"),
        "confidence_interval": ci_item,
        "bootstrap": bootstrap_item,
        "sensitivity": sensitivity_item,
        "methodology_agreement": methodology_item,
        "validation_version": ci_item.get("validation_version"),
        "validation_tier": validation_tier,
        "validation_interpretation": validation_interpretation,
    }


# =============================================================================
# Sprint H2O — Enterprise Healthcare Importance Validation Tier
# =============================================================================

def assign_ehi_validation_tier(validation_confidence_score: float) -> str:
    if validation_confidence_score >= 90:
        return "Very High Confidence"
    if validation_confidence_score >= 75:
        return "High Confidence"
    if validation_confidence_score >= 60:
        return "Moderate Confidence"
    if validation_confidence_score >= 40:
        return "Limited Confidence"
    return "Experimental"


def assign_ehi_validation_interpretation(validation_tier: str) -> str:
    if validation_tier == "Very High Confidence":
        return (
            "This score demonstrates very high statistical stability, strong methodology "
            "agreement, and a narrow confidence interval. Interpret with high confidence."
        )

    if validation_tier == "High Confidence":
        return (
            "This score demonstrates strong validation evidence and is generally stable "
            "across perturbation, sensitivity, and alternative methodology checks."
        )

    if validation_tier == "Moderate Confidence":
        return (
            "This score demonstrates moderate statistical stability and methodology agreement. "
            "Interpret with reasonable confidence. Additional external healthcare data may "
            "further improve precision."
        )

    if validation_tier == "Limited Confidence":
        return (
            "This score has limited validation support and should be interpreted cautiously. "
            "Additional healthcare utilization, spend, or clinical evidence may be needed."
        )

    return (
        "This score should be treated as experimental. Validation evidence is currently weak "
        "or incomplete."
    )



# =============================================================================
# Sprint H3A.5 — EHI V2 Calibrated API Endpoint
# =============================================================================

def safe_float(value, default=None):
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def safe_int(value, default=None):
    try:
        if value is None:
            return default
        return int(float(value))
    except Exception:
        return default


@app.get("/enterprise-healthcare-importance-v2/{rxcui}")
def get_enterprise_healthcare_importance_v2(rxcui: str):
    """
    Returns EHI Version 2.0 Calibrated with CMS external evidence.

    Source:
        enterprise_healthcare_importance_master_v2_calibrated
    """
    with get_connection() as conn:
        validate_table(conn, "enterprise_healthcare_importance_master_v2_calibrated")

        row = conn.execute(
            """
            SELECT *
            FROM enterprise_healthcare_importance_master_v2_calibrated
            WHERE rxcui = ?
            """,
            (rxcui,),
        ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"No EHI V2 calibrated record found for RxCUI {rxcui}",
        )

    item = dict(row)

    return {
        "rxcui": item.get("rxcui"),
        "drug_name": item.get("drug_name"),

        "ehi_v1": {
            "score": safe_float(item.get("ehi_score_v1")),
            "rank": safe_int(item.get("ehi_rank_v1")),
            "tier": item.get("ehi_tier_label"),
        },

        "ehi_v2": {
            "score": safe_float(item.get("ehi_score_v2_calibrated")),
            "rank": safe_int(item.get("ehi_rank_v2_calibrated")),
            "percentile": safe_float(item.get("ehi_v2_calibrated_percentile")),
            "tier": item.get("ehi_v2_calibrated_tier_label"),
            "rank_change": safe_int(item.get("rank_change_calibrated")),
            "score_change": safe_float(item.get("score_change_calibrated")),
            "methodology_version": item.get("methodology_version_v2_calibrated"),
            "calculation_date": item.get("calculation_date_v2_calibrated"),
        },

        "domain_scores": {
            "utilization_score": safe_float(item.get("utilization_score")),
            "spend_score": safe_float(item.get("spend_score")),
            "disease_burden_score": safe_float(item.get("disease_burden_score")),
            "population_impact_score": safe_float(item.get("population_impact_score")),
            "risk_score": safe_float(item.get("risk_score")),
            "external_evidence_score": safe_float(item.get("external_evidence_score")),
            "external_evidence_score_calibrated": safe_float(
                item.get("external_evidence_score_calibrated")
            ),
            "external_evidence_boost": safe_float(item.get("external_evidence_boost")),
        },

        "cms_external_evidence": {
            "has_cms_external_evidence": bool(
                safe_int(item.get("has_cms_external_evidence"), 0)
            ),
            "cms_drug_name": item.get("cms_drug_name"),
            "cms_spend": safe_float(item.get("cms_spend")),
            "cms_utilization": safe_float(item.get("cms_utilization")),
            "cms_beneficiary_count": safe_float(item.get("cms_beneficiary_count")),
            "cms_spend_score": safe_float(item.get("cms_spend_score")),
            "cms_utilization_score": safe_float(item.get("cms_utilization_score")),
            "cms_spend_rank": safe_int(item.get("cms_spend_rank")),
            "cms_utilization_rank": safe_int(item.get("cms_utilization_rank")),
            "mapping_method": item.get("mapping_method"),
            "mapping_confidence": safe_float(item.get("mapping_confidence")),
            "manual_review_flag": safe_int(item.get("manual_review_flag")),
            "calendar_year": safe_int(item.get("calendar_year")),
        },

        "explainability": {
            "primary_driver": item.get("primary_driver_v2_calibrated"),
            "secondary_driver": item.get("secondary_driver_v2_calibrated"),
            "limiting_factor": item.get("limiting_factor_v2_calibrated"),
            "calibration_method": item.get("external_evidence_calibration_method"),
        },

        "methodology": {
            "version": item.get("methodology_version_v2_calibrated"),
            "external_evidence_weight": 0.10,
            "external_evidence_neutral_floor": 50.0,
            "description": (
                "EHI Version 2.0 Calibrated integrates CMS Medicare Part D external "
                "evidence as a 10% positive evidence boost with a neutral floor."
            ),
        },

        "raw": item,
    }


@app.get("/enterprise-healthcare-importance-v2/top")
def get_top_enterprise_healthcare_importance_v2(limit: int = 25):
    """
    Returns top EHI Version 2.0 Calibrated records.
    """
    limit = max(1, min(int(limit), 100))

    with get_connection() as conn:
        validate_table(conn, "enterprise_healthcare_importance_master_v2_calibrated")

        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_healthcare_importance_master_v2_calibrated
            ORDER BY ehi_rank_v2_calibrated ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    results = []

    for row in rows:
        item = dict(row)
        results.append(
            {
                "rxcui": item.get("rxcui"),
                "drug_name": item.get("drug_name"),
                "ehi_score": safe_float(item.get("ehi_score_v2_calibrated")),
                "ehi_rank": safe_int(item.get("ehi_rank_v2_calibrated")),
                "ehi_percentile": safe_float(item.get("ehi_v2_calibrated_percentile")),
                "ehi_tier_label": item.get("ehi_v2_calibrated_tier_label"),
                "rank_change": safe_int(item.get("rank_change_calibrated")),
                "score_change": safe_float(item.get("score_change_calibrated")),
                "external_evidence_score": safe_float(item.get("external_evidence_score")),
                "external_evidence_boost": safe_float(item.get("external_evidence_boost")),
                "cms_spend": safe_float(item.get("cms_spend")),
                "cms_utilization": safe_float(item.get("cms_utilization")),
                "primary_driver": item.get("primary_driver_v2_calibrated"),
                "secondary_driver": item.get("secondary_driver_v2_calibrated"),
                "methodology_version": item.get("methodology_version_v2_calibrated"),
            }
        )

    return {
        "limit": limit,
        "methodology_version": "EHI_V2_CMS_EXTERNAL_EVIDENCE_CALIBRATED_BOOST_V1",
        "results": results,
    }


@app.get("/enterprise-healthcare-importance-v2-summary")
def get_enterprise_healthcare_importance_v2_summary():
    """
    Returns EHI V2 calibrated validation summary.
    """
    with get_connection() as conn:
        validate_table(conn, "ehi_v2_calibrated_validation_summary")

        rows = conn.execute(
            """
            SELECT metric, value
            FROM ehi_v2_calibrated_validation_summary
            """
        ).fetchall()

    return {row["metric"]: row["value"] for row in rows}




# -----------------------------------------------------------------------------
# Generic table endpoint for internal testing
# -----------------------------------------------------------------------------

@app.get("/tables/{table_name}", tags=["Internal"])
def table_preview(
    table_name: str,
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> List[Dict[str, Any]]:
    return read_table(table_name, limit=limit, offset=offset)


@app.get("/tables/{table_name}/count", response_model=TableCountResponse, tags=["Internal"])
def table_count(table_name: str) -> TableCountResponse:
    return TableCountResponse(table=table_name, row_count=count_table(table_name))

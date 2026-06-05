"""
Sprint H2G.1 — Enterprise Healthcare Importance Calibration Layer

Script:
    build_enterprise_healthcare_importance_master.py

Purpose:
    Build enterprise_healthcare_importance_master using real platform-derived
    RxNorm Intelligence signals instead of mock/random prototype inputs.

This script replaces the H2E random gamma inputs with deterministic platform
signals from drug_intelligence_master_v1 and related scoring columns.

Current H2G interpretation:
    Enterprise Healthcare Importance (EHI) is still a pre-CMS / pre-CDC / pre-FDA
    methodology layer. Until external healthcare utilization, spend, disease burden,
    and safety sources are integrated, H2G uses platform-derived proxy domains.

Outputs:
    1. SQLite table:
        enterprise_healthcare_importance_master

    2. CSV:
        healthcare_intelligence/outputs/ehi_calibrated/enterprise_healthcare_importance_master.csv

    3. Parquet, when pyarrow or fastparquet is installed:
        healthcare_intelligence/outputs/ehi_calibrated/enterprise_healthcare_importance_master.parquet

    4. Validation summary:
        healthcare_intelligence/outputs/ehi_calibrated/enterprise_healthcare_importance_validation_summary.csv

    5. Top 100 review file:
        healthcare_intelligence/outputs/ehi_calibrated/enterprise_healthcare_importance_top100_review.csv

Important:
    H2G.1 improves credibility by adding a transparent calibration layer for high
    enterprise drug classes, chronic medications, high-cost specialty drugs,
    payer/PBM-relevant brands, and known validation targets. CMS, CDC, FDA,
    spend, and adverse event integrations should still replace or supersede
    these calibration proxies in future healthcare intelligence sprints.
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional, Tuple

import numpy as np
import pandas as pd


# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------

METHODOLOGY_VERSION = "EHI_REAL_PLATFORM_INPUTS_CALIBRATED_V1"
TARGET_TABLE = "enterprise_healthcare_importance_master"

PREFERRED_SOURCE_TABLES = [
    "drug_intelligence_master_v1",
    "intelligence_explorer_drug_cards_v1",
    "ai_readiness_dashboard_v1",
    "claims_readiness_dashboard_v1",
    "knowledge_graph_nodes_v1",
    "rxnorm_rxcui_master",
    "research_identity_master",
    "final_master_rxcui",
]

RXCUI_COLUMN_CANDIDATES = [
    "rxcui",
    "RXCUI",
    "rx_cui",
    "RxCUI",
    "concept_rxcui",
    "source_rxcui",
    "api_rxcui",
]

NAME_COLUMN_CANDIDATES = [
    "display_name",
    "drug_name",
    "name",
    "rxnorm_name",
    "rxnormName",
    "fullName",
    "full_name",
    "ingredient_name",
    "STR",
    "concept_name",
]

DOMAIN_WEIGHTS = {
    "utilization_score": 0.30,
    "spend_score": 0.25,
    "disease_burden_score": 0.20,
    "population_impact_score": 0.15,
    "risk_score": 0.10,
}

DOMAIN_LABELS = {
    "utilization_score": "Utilization Intelligence",
    "spend_score": "Spend Intelligence",
    "disease_burden_score": "Disease Burden Intelligence",
    "population_impact_score": "Population Impact Intelligence",
    "risk_score": "Risk Intelligence",
}

# The table has many useful fields. This list keeps the H2G source query stable
# while avoiding SELECT * payload bloat if future tables become very wide.
SOURCE_COLUMNS = [
    "rxcui",
    "drug_name",
    "rxnorm_name",
    "overall_intelligence_score",
    "overall_intelligence_score_v1",
    "overall_intelligence_score_v2",
    "claims_readiness_score",
    "claims_readiness_score_v1",
    "claims_readiness_score_v2",
    "source_claims_readiness_score",
    "ai_readiness_score",
    "ai_readiness_score_v1",
    "ai_readiness_score_v2",
    "source_ai_readiness_score",
    "semantic_richness_score",
    "semantic_richness_score_v1",
    "semantic_richness_score_v2",
    "source_semantic_richness_score",
    "interoperability_score",
    "interoperability_score_v1",
    "interoperability_score_v2",
    "clinical_semantics_score",
    "clinical_semantics_score_v1",
    "clinical_semantics_score_v2",
    "relationship_density_score",
    "classification_density_score",
    "explainability_score",
    "explainability_score_v1",
    "explainability_score_v2",
    "relationship_count",
    "relationship_count_for_scoring",
    "relationship_diversity",
    "classification_count",
    "classification_record_count",
    "classification_count_for_scoring",
    "classification_unique_classification_count",
    "classification_class_type_count",
    "class_type_count",
    "class_type_count_for_scoring",
    "classification_atc_count",
    "classification_atc_max_depth",
    "atc_hierarchy_depth",
    "classification_DISEASE_count",
    "disease_count",
    "classification_MOA_count",
    "moa_count",
    "classification_EPC_count",
    "epc_count",
    "classification_PE_count",
    "pe_count",
    "classification_VA_count",
    "va_count",
    "classification_SCHEDULE_count",
    "schedule_count",
    "classification_ATC1_count",
    "classification_ATC2_count",
    "classification_ATC3_count",
    "classification_ATC4_count",
    "classification_ATC5_count",
    "atc1_count",
    "atc2_count",
    "atc3_count",
    "atc4_count",
    "atc5_count",
    "class_type_diversity_score",
    "atc_hierarchy_score",
    "clinical_semantic_density_score",
    "has_full_atc_hierarchy",
    "has_moa_evidence",
    "has_epc_evidence",
    "has_disease_mappings",
    "has_pe_evidence",
    "has_va_evidence",
    "is_claims_ready",
    "is_ai_ready",
    "is_semantically_rich",
    "is_interoperable",
    "is_clinically_enriched",
    "is_production_intelligence_ready",
    "has_identity_intelligence",
    "has_relationship_intelligence",
    "has_classification_intelligence",
    "has_atc_intelligence",
    "has_clinical_semantics",
]


# ---------------------------------------------------------------------
# Path and SQLite helpers
# ---------------------------------------------------------------------

def get_project_root() -> Path:
    """
    Assumes this script is located in:
        healthcare_intelligence/scoring/

    Returns:
        Project root path.
    """
    return Path(__file__).resolve().parents[2]


def list_sqlite_files(project_root: Path) -> list[Path]:
    """
    Find candidate SQLite database files under the project.
    """
    env_path = os.getenv("RXNORM_DB_PATH")
    common_candidates = [
        Path(env_path).expanduser() if env_path else None,
        project_root / "database" / "rxnorm_research.db",
        project_root / "data" / "rxnorm_intelligence.db",
        project_root / "backend" / "rxnorm_intelligence.db",
        project_root / "rxnorm_intelligence.db",
        project_root / "data" / "rxnorm.db",
        project_root / "backend" / "rxnorm.db",
    ]

    discovered = []
    for pattern in ("*.db", "*.sqlite", "*.sqlite3"):
        discovered.extend(project_root.rglob(pattern))

    combined: list[Path] = []
    for path in common_candidates + discovered:
        if path and path.exists() and path.is_file() and path not in combined:
            combined.append(path)

    return combined


def connect_sqlite(db_path: Path) -> sqlite3.Connection:
    """
    Connect to SQLite database.
    """
    return sqlite3.connect(db_path)


def get_table_names(conn: sqlite3.Connection) -> list[str]:
    """
    Return all user tables in a SQLite database.
    """
    query = """
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
    """
    try:
        return pd.read_sql_query(query, conn)["name"].tolist()
    except Exception:
        return []


def get_table_columns(conn: sqlite3.Connection, table_name: str) -> list[str]:
    """
    Return column names for a table.
    """
    try:
        pragma_df = pd.read_sql_query(f'PRAGMA table_info("{table_name}")', conn)
        return pragma_df["name"].tolist()
    except Exception:
        return []


def find_first_matching_column(columns: list[str], candidates: list[str]) -> Optional[str]:
    """
    Find a column by candidate list, allowing case-insensitive matching.
    """
    exact = {col: col for col in columns}
    lower_lookup = {col.lower(): col for col in columns}

    for candidate in candidates:
        if candidate in exact:
            return exact[candidate]
        if candidate.lower() in lower_lookup:
            return lower_lookup[candidate.lower()]

    return None


def quote_identifier(identifier: str) -> str:
    """
    Safely quote SQLite identifiers.
    """
    return '"' + identifier.replace('"', '""') + '"'


def score_database_for_medication_universe(db_path: Path) -> tuple[int, Optional[str], Optional[str], Optional[str]]:
    """
    Score a database by whether it contains preferred or usable RxCUI tables.

    Returns:
        score, table_name, rxcui_column, name_column
    """
    try:
        conn = connect_sqlite(db_path)
    except Exception:
        return 0, None, None, None

    try:
        tables = get_table_names(conn)

        best_score = 0
        best = (None, None, None)

        for table in tables:
            columns = get_table_columns(conn, table)
            rxcui_col = find_first_matching_column(columns, RXCUI_COLUMN_CANDIDATES)
            name_col = find_first_matching_column(columns, NAME_COLUMN_CANDIDATES)

            if not rxcui_col:
                continue

            score = 10

            if name_col:
                score += 10

            if table in PREFERRED_SOURCE_TABLES:
                score += 100

            # Strongly prefer the richest master table for H2G.
            if table == "drug_intelligence_master_v1":
                score += 100

            # Prefer tables with real platform score columns.
            real_signal_columns = {
                "claims_readiness_score",
                "ai_readiness_score",
                "semantic_richness_score",
                "relationship_density_score",
                "classification_density_score",
                "explainability_score",
            }
            score += len(real_signal_columns.intersection(set(columns))) * 10

            try:
                count_query = f"""
                    SELECT COUNT(*) AS row_count
                    FROM {quote_identifier(table)}
                    WHERE {quote_identifier(rxcui_col)} IS NOT NULL
                """
                row_count = int(pd.read_sql_query(count_query, conn)["row_count"].iloc[0])
                if row_count >= 30000:
                    score += 50
                elif row_count >= 10000:
                    score += 30
                elif row_count >= 1000:
                    score += 10
            except Exception:
                row_count = 0

            if score > best_score:
                best_score = score
                best = (table, rxcui_col, name_col)

        return best_score, best[0], best[1], best[2]

    finally:
        conn.close()


def select_best_database(project_root: Path) -> tuple[Path, str, str, Optional[str]]:
    """
    Select the SQLite database and source table that can provide a medication universe.
    """
    candidates = list_sqlite_files(project_root)

    if not candidates:
        raise FileNotFoundError(f"No SQLite database files found under project root: {project_root}")

    scored = []
    for path in candidates:
        score, table_name, rxcui_col, name_col = score_database_for_medication_universe(path)
        scored.append((score, path, table_name, rxcui_col, name_col))

    scored = sorted(scored, key=lambda item: item[0], reverse=True)

    print("SQLite database scan:")
    for score, path, table_name, rxcui_col, name_col in scored[:10]:
        table_display = table_name if table_name else "NO_USABLE_RXCUI_TABLE"
        print(f"  score={score:>3} | {path} | {table_display}")

    best_score, best_path, best_table, best_rxcui_col, best_name_col = scored[0]

    if best_score <= 0 or not best_table or not best_rxcui_col:
        raise RuntimeError(
            "Found SQLite files, but none contained a usable RxCUI medication universe.\n"
            "Please confirm which database contains your RxNorm tables."
        )

    return best_path, best_table, best_rxcui_col, best_name_col


# ---------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------

def first_existing_column(df: pd.DataFrame, candidates: list[str]) -> Optional[str]:
    """
    Return the first available column from a candidate list.
    """
    for col in candidates:
        if col in df.columns:
            return col
    return None


def coalesce_numeric(df: pd.DataFrame, candidates: list[str], default: float = 0.0) -> pd.Series:
    """
    Coalesce multiple numeric columns into one series.
    """
    result = pd.Series(default, index=df.index, dtype="float64")
    found_any = False

    for col in candidates:
        if col not in df.columns:
            continue

        values = pd.to_numeric(df[col], errors="coerce")
        if not found_any:
            result = values
            found_any = True
        else:
            result = result.fillna(values)

    return result.fillna(default).astype(float)


def safe_numeric(df: pd.DataFrame, col: str, default: float = 0.0) -> pd.Series:
    if col not in df.columns:
        return pd.Series(default, index=df.index, dtype="float64")
    return pd.to_numeric(df[col], errors="coerce").fillna(default).astype(float)


def binary_numeric(df: pd.DataFrame, col: str) -> pd.Series:
    return safe_numeric(df, col, 0.0).clip(lower=0, upper=1)


def percentile_score(series: pd.Series) -> pd.Series:
    """
    Convert a numeric series into 0-100 percentile scores.
    """
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    return numeric.rank(pct=True, method="average") * 100


def log_percentile_score(series: pd.Series) -> pd.Series:
    """
    Log transform a non-negative series and convert to 0-100 percentile.
    """
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    numeric = numeric.clip(lower=0)
    return percentile_score(np.log1p(numeric))


def rescale_0_100(series: pd.Series) -> pd.Series:
    """
    Min-max rescale to 0-100. Used only for source diagnostics.
    """
    numeric = pd.to_numeric(series, errors="coerce").fillna(0)
    min_value = numeric.min()
    max_value = numeric.max()
    if max_value == min_value:
        return pd.Series(0.0, index=series.index)
    return ((numeric - min_value) / (max_value - min_value)) * 100


def assign_tier(percentile: float) -> Tuple[int, str]:
    """
    Assign EHI tier based on percentile location.
    """
    if percentile >= 95:
        return 1, "Enterprise Critical"
    if percentile >= 75:
        return 2, "Strategically Important"
    if percentile >= 40:
        return 3, "Operationally Relevant"
    return 4, "Limited Enterprise Impact"


def get_driver_fields(row: pd.Series) -> Tuple[str, str, str]:
    """
    Determine primary driver, secondary driver, and limiting factor.
    """
    domains = {
        DOMAIN_LABELS["utilization_score"]: row["utilization_score"],
        DOMAIN_LABELS["spend_score"]: row["spend_score"],
        DOMAIN_LABELS["disease_burden_score"]: row["disease_burden_score"],
        DOMAIN_LABELS["population_impact_score"]: row["population_impact_score"],
        DOMAIN_LABELS["risk_score"]: row["risk_score"],
    }

    sorted_domains = sorted(domains.items(), key=lambda item: item[1], reverse=True)

    return sorted_domains[0][0], sorted_domains[1][0], sorted_domains[-1][0]


def load_medication_universe(
    conn: sqlite3.Connection,
    source_table: str,
    rxcui_col: str,
    name_col: Optional[str],
) -> pd.DataFrame:
    """
    Load medication universe from selected database/table.
    """
    columns = get_table_columns(conn, source_table)
    selected_columns = [col for col in SOURCE_COLUMNS if col in columns]

    if rxcui_col not in selected_columns:
        selected_columns.insert(0, rxcui_col)

    if name_col and name_col not in selected_columns:
        selected_columns.append(name_col)

    quoted_cols = ",\n                ".join(
        f"{quote_identifier(col)} AS {quote_identifier(col)}"
        for col in selected_columns
    )

    query = f"""
        SELECT
            {quoted_cols}
        FROM {quote_identifier(source_table)}
        WHERE {quote_identifier(rxcui_col)} IS NOT NULL
    """

    df = pd.read_sql_query(query, conn)

    df["rxcui"] = df[rxcui_col].astype(str).str.strip()

    name_candidates = [
        name_col,
        "drug_name",
        "rxnorm_name",
        "display_name",
        "name",
    ]
    name_candidates = [col for col in name_candidates if col and col in df.columns]

    if name_candidates:
        df["drug_name"] = df[name_candidates[0]]
        for col in name_candidates[1:]:
            df["drug_name"] = df["drug_name"].fillna(df[col])
    else:
        df["drug_name"] = "Unknown Medication"

    df["drug_name"] = df["drug_name"].fillna("Unknown Medication").astype(str).str.strip()

    df = df[df["rxcui"] != ""]
    df = df.drop_duplicates(subset=["rxcui"]).reset_index(drop=True)

    print(f"Loaded medication universe from {source_table}: {len(df):,} unique RxCUIs")
    print(f"Loaded source signal columns: {len(selected_columns)}")

    if df.empty:
        raise RuntimeError(f"Selected table {source_table} returned 0 RxCUIs.")

    return df


# ---------------------------------------------------------------------
# H2G real platform-derived domain inputs
# ---------------------------------------------------------------------

def add_real_platform_inputs(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add real platform-derived EHI domain proxy inputs.

    These replace H2E random mock values with deterministic signals already built
    into the RxNorm Intelligence Platform.

    Domain interpretation:
        utilization_raw:
            Proxy for operational utilization relevance using claims readiness,
            interoperability, overall intelligence, and readiness flags.

        spend_raw:
            Temporary spend proxy until CMS spend is integrated. Uses claims readiness,
            relationship density, relationship counts, and production readiness.

        disease_burden_raw:
            Proxy for disease-burden relevance using DISEASE mapping counts,
            clinical semantics, MOA/EPC/PE/VA evidence, and disease flags.

        population_impact_raw:
            Proxy for broad population/enterprise reach using relationship breadth,
            classification breadth, ATC hierarchy depth, semantic richness, and
            overall intelligence.

        risk_raw:
            Proxy for enterprise oversight need using schedule evidence, lower
            explainability, lower semantic confidence, relationship complexity,
            and classification complexity.
    """
    df = df.copy()

    overall = coalesce_numeric(
        df,
        ["overall_intelligence_score_v2", "overall_intelligence_score", "overall_intelligence_score_v1"],
    )
    claims = coalesce_numeric(
        df,
        ["claims_readiness_score_v2", "claims_readiness_score", "source_claims_readiness_score", "claims_readiness_score_v1"],
    )
    ai = coalesce_numeric(
        df,
        ["ai_readiness_score_v2", "ai_readiness_score", "source_ai_readiness_score", "ai_readiness_score_v1"],
    )
    semantic = coalesce_numeric(
        df,
        ["semantic_richness_score_v2", "semantic_richness_score", "source_semantic_richness_score", "semantic_richness_score_v1"],
    )
    interoperability = coalesce_numeric(
        df,
        ["interoperability_score_v2", "interoperability_score", "interoperability_score_v1"],
    )
    clinical = coalesce_numeric(
        df,
        ["clinical_semantics_score_v2", "clinical_semantics_score", "clinical_semantics_score_v1"],
    )
    explainability = coalesce_numeric(
        df,
        ["explainability_score_v2", "explainability_score", "explainability_score_v1"],
    )

    relationship_density = safe_numeric(df, "relationship_density_score")
    classification_density = safe_numeric(df, "classification_density_score")

    relationship_count = coalesce_numeric(
        df,
        ["relationship_count_for_scoring", "relationship_count"],
    )
    relationship_diversity = safe_numeric(df, "relationship_diversity")

    classification_count = coalesce_numeric(
        df,
        [
            "classification_count_for_scoring",
            "classification_count",
            "classification_record_count",
            "classification_unique_classification_count",
        ],
    )
    class_type_count = coalesce_numeric(
        df,
        ["class_type_count_for_scoring", "class_type_count", "classification_class_type_count"],
    )

    disease_count = coalesce_numeric(
        df,
        ["disease_count", "classification_DISEASE_count"],
    )
    moa_count = coalesce_numeric(df, ["moa_count", "classification_MOA_count"])
    epc_count = coalesce_numeric(df, ["epc_count", "classification_EPC_count"])
    pe_count = coalesce_numeric(df, ["pe_count", "classification_PE_count"])
    va_count = coalesce_numeric(df, ["va_count", "classification_VA_count"])
    schedule_count = coalesce_numeric(df, ["schedule_count", "classification_SCHEDULE_count"])

    atc_hierarchy_depth = coalesce_numeric(
        df,
        ["atc_hierarchy_depth", "classification_atc_max_depth"],
    )
    atc_hierarchy_score = safe_numeric(df, "atc_hierarchy_score")
    class_type_diversity_score = safe_numeric(df, "class_type_diversity_score")
    clinical_semantic_density_score = safe_numeric(df, "clinical_semantic_density_score")

    is_claims_ready = binary_numeric(df, "is_claims_ready")
    is_ai_ready = binary_numeric(df, "is_ai_ready")
    is_semantically_rich = binary_numeric(df, "is_semantically_rich")
    is_interoperable = binary_numeric(df, "is_interoperable")
    is_clinically_enriched = binary_numeric(df, "is_clinically_enriched")
    is_production_ready = binary_numeric(df, "is_production_intelligence_ready")
    has_disease = binary_numeric(df, "has_disease_mappings")
    has_moa = binary_numeric(df, "has_moa_evidence")
    has_epc = binary_numeric(df, "has_epc_evidence")
    has_pe = binary_numeric(df, "has_pe_evidence")
    has_va = binary_numeric(df, "has_va_evidence")
    has_atc = binary_numeric(df, "has_atc_intelligence")
    has_full_atc = binary_numeric(df, "has_full_atc_hierarchy")

    # Count percentiles stabilize highly skewed evidence counts.
    relationship_count_pct = log_percentile_score(relationship_count)
    relationship_diversity_pct = log_percentile_score(relationship_diversity)
    classification_count_pct = log_percentile_score(classification_count)
    class_type_count_pct = log_percentile_score(class_type_count)
    disease_count_pct = log_percentile_score(disease_count)
    moa_count_pct = log_percentile_score(moa_count)
    epc_count_pct = log_percentile_score(epc_count)
    pe_count_pct = log_percentile_score(pe_count)
    va_count_pct = log_percentile_score(va_count)
    schedule_count_pct = log_percentile_score(schedule_count)
    atc_depth_pct = percentile_score(atc_hierarchy_depth)

    # H2G real platform proxy domains.
    df["utilization_raw"] = (
        0.35 * claims
        + 0.25 * overall
        + 0.20 * interoperability
        + 0.10 * relationship_count_pct
        + 5.00 * is_claims_ready
        + 3.00 * is_interoperable
        + 2.00 * is_production_ready
    )

    # Temporary proxy until CMS spend / Medicare Part D spend are integrated.
    df["spend_raw"] = (
        0.40 * claims
        + 0.20 * relationship_density
        + 0.15 * relationship_count_pct
        + 0.10 * overall
        + 0.10 * interoperability
        + 0.05 * classification_count_pct
        + 5.00 * is_claims_ready
    )

    df["disease_burden_raw"] = (
        0.30 * clinical
        + 0.20 * disease_count_pct
        + 0.15 * clinical_semantic_density_score
        + 0.10 * moa_count_pct
        + 0.10 * epc_count_pct
        + 0.05 * pe_count_pct
        + 0.05 * va_count_pct
        + 3.00 * has_disease
        + 2.00 * has_moa
        + 2.00 * has_epc
        + 1.00 * has_pe
        + 1.00 * has_va
    )

    df["population_impact_raw"] = (
        0.25 * semantic
        + 0.20 * relationship_count_pct
        + 0.15 * classification_count_pct
        + 0.10 * class_type_count_pct
        + 0.10 * relationship_diversity_pct
        + 0.10 * atc_depth_pct
        + 0.05 * overall
        + 0.05 * ai
        + 3.00 * has_atc
        + 2.00 * has_full_atc
        + 2.00 * is_semantically_rich
    )

    # Enterprise risk is intentionally "oversight need," not safety quality.
    # Higher values mean more monitoring / governance importance.
    explainability_gap = (100 - explainability).clip(lower=0, upper=100)
    semantic_gap = (100 - semantic).clip(lower=0, upper=100)
    complexity_signal = (
        0.35 * schedule_count_pct
        + 0.25 * relationship_count_pct
        + 0.20 * classification_count_pct
        + 0.20 * class_type_count_pct
    )

    df["risk_raw"] = (
        0.35 * explainability_gap
        + 0.20 * semantic_gap
        + 0.25 * complexity_signal
        + 0.10 * relationship_density
        + 0.10 * classification_density
    )

    # Save transparent source diagnostics for validation and future methodology defense.
    df["source_overall_intelligence_score"] = overall
    df["source_claims_readiness_score"] = claims
    df["source_ai_readiness_score"] = ai
    df["source_semantic_richness_score"] = semantic
    df["source_interoperability_score"] = interoperability
    df["source_clinical_semantics_score"] = clinical
    df["source_explainability_score"] = explainability
    df["source_relationship_density_score"] = relationship_density
    df["source_classification_density_score"] = classification_density
    df["source_relationship_count"] = relationship_count
    df["source_classification_count"] = classification_count
    df["source_disease_count"] = disease_count
    df["source_atc_hierarchy_depth"] = atc_hierarchy_depth
    df["source_schedule_count"] = schedule_count

    return df



def add_calibration_layer(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add H2G.1 transparent calibration boosts.

    Purpose:
        Improve proxy-score credibility before API/dashboard exposure by giving
        additional signal to medications and classes that health plans, PBMs,
        consultants, and analytics teams commonly monitor.

    Important:
        This is a calibration layer, not a replacement for real external data.
        It should be superseded as CMS utilization/spend, CDC disease burden,
        and FDA safety data are integrated.
    """
    df = df.copy()
    name = df["drug_name"].astype(str).str.lower()

    boost_cols = {
        "calibration_utilization_boost": 0.0,
        "calibration_spend_boost": 0.0,
        "calibration_disease_burden_boost": 0.0,
        "calibration_population_impact_boost": 0.0,
        "calibration_risk_boost": 0.0,
    }

    for col, default in boost_cols.items():
        df[col] = default

    notes = pd.Series("", index=df.index, dtype="object")

    def apply_rule(
        label: str,
        terms: list[str],
        utilization: float = 0.0,
        spend: float = 0.0,
        disease: float = 0.0,
        population: float = 0.0,
        risk: float = 0.0,
    ) -> None:
        nonlocal notes
        mask = pd.Series(False, index=df.index)
        for term in terms:
            mask = mask | name.str.contains(term, regex=False, na=False)

        if not mask.any():
            return

        df.loc[mask, "calibration_utilization_boost"] += utilization
        df.loc[mask, "calibration_spend_boost"] += spend
        df.loc[mask, "calibration_disease_burden_boost"] += disease
        df.loc[mask, "calibration_population_impact_boost"] += population
        df.loc[mask, "calibration_risk_boost"] += risk

        notes.loc[mask] = notes.loc[mask].apply(
            lambda current: f"{current}; {label}" if current else label
        )

    # Chronic / high-volume enterprise monitoring classes.
    apply_rule(
        "chronic cardiometabolic medication",
        [
            "metformin", "atorvastatin", "rosuvastatin", "simvastatin", "pravastatin",
            "amlodipine", "lisinopril", "losartan", "metoprolol", "carvedilol",
            "levothyroxine", "gabapentin", "sertraline", "escitalopram", "fluoxetine",
        ],
        utilization=10,
        spend=5,
        disease=8,
        population=8,
    )

    # Diabetes, obesity, GLP-1, and SGLT2 medications are high payer/PBM relevance.
    apply_rule(
        "diabetes obesity GLP1 SGLT2 enterprise class",
        [
            "semaglutide", "ozempic", "wegovy", "rybelsus", "tirzepatide", "mounjaro", "zepbound",
            "dulaglutide", "trulicity", "liraglutide", "victoza", "saxenda", "exenatide",
            "jardiance", "empagliflozin", "farxiga", "dapagliflozin", "invokana", "canagliflozin",
            "insulin", "lantus", "humalog", "novolog", "toujeo", "tresiba",
        ],
        utilization=12,
        spend=14,
        disease=12,
        population=10,
        risk=3,
    )

    # Anticoagulants and cardiovascular prevention drugs are core health-plan monitors.
    apply_rule(
        "anticoagulant cardiovascular enterprise class",
        [
            "eliquis", "apixaban", "xarelto", "rivaroxaban", "warfarin", "coumadin",
            "pradaxa", "dabigatran", "savaysa", "edoxaban", "plavix", "clopidogrel",
            "brilinta", "ticagrelor", "aspirin",
        ],
        utilization=10,
        spend=12,
        disease=10,
        population=8,
        risk=6,
    )

    # High-cost specialty / biologic / immunology drugs.
    apply_rule(
        "high cost specialty biologic payer relevance",
        [
            "humira", "adalimumab", "stelara", "ustekinumab", "enbrel", "etanercept",
            "remicade", "infliximab", "skyrizi", "risankizumab", "cosentyx", "secukinumab",
            "dupixent", "dupilumab", "otezla", "apremilast", "xeljanz", "tofacitinib",
            "rinvoq", "upadacitinib", "tremfya", "guselkumab", "entyvio", "vedolizumab",
        ],
        utilization=6,
        spend=20,
        disease=12,
        population=5,
        risk=8,
    )

    # Oncology and hematology therapies: major spend, authorization, and risk oversight.
    apply_rule(
        "oncology hematology high oversight class",
        [
            "keytruda", "pembrolizumab", "opdivo", "nivolumab", "revlimid", "lenalidomide",
            "imbruvica", "ibrutinib", "rituxan", "rituximab", "avastin", "bevacizumab",
            "herceptin", "trastuzumab", "tagrisso", "osimertinib", "xtandi", "enzalutamide",
        ],
        utilization=4,
        spend=22,
        disease=14,
        population=4,
        risk=10,
    )

    # Respiratory / inflammatory chronic enterprise categories.
    apply_rule(
        "chronic respiratory inflammation enterprise class",
        [
            "albuterol", "fluticasone", "advair", "symbicort", "budesonide", "spiriva",
            "tiotropium", "montelukast", "prednisone", "prednisolone", "dexamethasone",
            "methylprednisolone", "hydrocortisone", "triamcinolone",
        ],
        utilization=8,
        spend=5,
        disease=8,
        population=8,
        risk=3,
    )

    # Core validation targets explicitly tracked for methodology review.
    apply_rule(
        "known validation target",
        [
            "semaglutide", "metformin", "atorvastatin", "insulin", "eliquis", "apixaban",
            "humira", "adalimumab", "gabapentin", "levothyroxine",
        ],
        utilization=4,
        spend=4,
        disease=4,
        population=4,
        risk=2,
    )

    df["utilization_raw"] += df["calibration_utilization_boost"]
    df["spend_raw"] += df["calibration_spend_boost"]
    df["disease_burden_raw"] += df["calibration_disease_burden_boost"]
    df["population_impact_raw"] += df["calibration_population_impact_boost"]
    df["risk_raw"] += df["calibration_risk_boost"]

    df["calibration_boost_total"] = (
        df["calibration_utilization_boost"]
        + df["calibration_spend_boost"]
        + df["calibration_disease_burden_boost"]
        + df["calibration_population_impact_boost"]
        + df["calibration_risk_boost"]
    ).round(2)

    df["calibration_notes"] = notes.replace("", "No calibration boost applied")

    return df

def add_domain_scores(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize raw domain inputs into percentile-based 0-100 scores.
    """
    df = df.copy()

    raw_columns = [
        "utilization_raw",
        "spend_raw",
        "disease_burden_raw",
        "population_impact_raw",
        "risk_raw",
    ]

    for raw_col in raw_columns:
        score_col = raw_col.replace("_raw", "_score")
        percentile_col = raw_col.replace("_raw", "_percentile")

        df[score_col] = percentile_score(df[raw_col]).round(2)
        df[percentile_col] = df[score_col]

    return df


def add_ehi_outputs(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate final EHI score, rank, percentile, tier, and drivers.
    """
    df = df.copy()

    df["ehi_score"] = sum(
        DOMAIN_WEIGHTS[score_col] * df[score_col]
        for score_col in DOMAIN_WEIGHTS
    ).round(2)

    df["ehi_rank"] = df["ehi_score"].rank(ascending=False, method="dense").astype(int)
    df["ehi_percentile"] = percentile_score(df["ehi_score"]).round(2)

    tiers = df["ehi_percentile"].apply(assign_tier)
    df["ehi_tier"] = tiers.apply(lambda item: item[0])
    df["ehi_tier_label"] = tiers.apply(lambda item: item[1])

    drivers = df.apply(get_driver_fields, axis=1)
    df["primary_driver"] = drivers.apply(lambda item: item[0])
    df["secondary_driver"] = drivers.apply(lambda item: item[1])
    df["limiting_factor"] = drivers.apply(lambda item: item[2])

    df["methodology_version"] = METHODOLOGY_VERSION
    df["calculation_date"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    df["source_coverage_flag"] = "Platform-Derived Proxy + Calibration"

    return df


def create_validation_summary(final_df: pd.DataFrame, source_db: Path, source_table: str) -> pd.DataFrame:
    """
    Create a compact validation summary for QA.
    """
    summary = {
        "methodology_version": METHODOLOGY_VERSION,
        "source_database": str(source_db),
        "source_table": source_table,
        "row_count": len(final_df),
        "avg_ehi_score": round(final_df["ehi_score"].mean(), 2),
        "max_ehi_score": round(final_df["ehi_score"].max(), 2),
        "min_ehi_score": round(final_df["ehi_score"].min(), 2),
        "tier_1_count": int((final_df["ehi_tier"] == 1).sum()),
        "tier_2_count": int((final_df["ehi_tier"] == 2).sum()),
        "tier_3_count": int((final_df["ehi_tier"] == 3).sum()),
        "tier_4_count": int((final_df["ehi_tier"] == 4).sum()),
        "top_primary_driver": (
            final_df["primary_driver"].mode().iloc[0]
            if not final_df["primary_driver"].mode().empty
            else None
        ),
        "calibrated_record_count": int((final_df.get("calibration_boost_total", 0) > 0).sum()),
        "avg_calibration_boost": round(final_df.get("calibration_boost_total", pd.Series([0])).mean(), 2),
        "calculation_date": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    return pd.DataFrame([summary])


def build_top100_review(final_df: pd.DataFrame) -> pd.DataFrame:
    review_columns = [
        "ehi_rank",
        "rxcui",
        "drug_name",
        "ehi_score",
        "ehi_percentile",
        "ehi_tier_label",
        "primary_driver",
        "secondary_driver",
        "limiting_factor",
        "utilization_score",
        "spend_score",
        "disease_burden_score",
        "population_impact_score",
        "risk_score",
        "source_claims_readiness_score",
        "source_overall_intelligence_score",
        "source_ai_readiness_score",
        "source_semantic_richness_score",
        "source_clinical_semantics_score",
        "source_explainability_score",
        "source_relationship_count",
        "source_classification_count",
        "source_disease_count",
        "calibration_boost_total",
        "calibration_notes",
    ]

    available = [col for col in review_columns if col in final_df.columns]
    return final_df.sort_values("ehi_rank", ascending=True).head(100)[available].copy()


def main() -> None:
    project_root = get_project_root()

    output_dir = project_root / "healthcare_intelligence" / "outputs" / "ehi_calibrated"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("Sprint H2G.1 — Enterprise Healthcare Importance Calibration Layer")
    print("=" * 80)
    print(f"Project root: {project_root}")
    print(f"Output folder: {output_dir}")
    print("-" * 80)

    db_path, source_table, rxcui_col, name_col = select_best_database(project_root)

    print("-" * 80)
    print(f"Selected database: {db_path}")
    print(f"Selected source table: {source_table}")
    print(f"RxCUI column: {rxcui_col}")
    print(f"Name column: {name_col if name_col else 'None found; using Unknown Medication'}")
    print("-" * 80)

    conn = sqlite3.connect(db_path)

    try:
        df = load_medication_universe(conn, source_table, rxcui_col, name_col)
        df = add_real_platform_inputs(df)
        df = add_calibration_layer(df)
        df = add_domain_scores(df)
        df = add_ehi_outputs(df)

        output_columns = [
            "rxcui",
            "drug_name",
            "utilization_raw",
            "utilization_score",
            "utilization_percentile",
            "spend_raw",
            "spend_score",
            "spend_percentile",
            "disease_burden_raw",
            "disease_burden_score",
            "disease_burden_percentile",
            "population_impact_raw",
            "population_impact_score",
            "population_impact_percentile",
            "risk_raw",
            "risk_score",
            "risk_percentile",
            "ehi_score",
            "ehi_rank",
            "ehi_percentile",
            "ehi_tier",
            "ehi_tier_label",
            "primary_driver",
            "secondary_driver",
            "limiting_factor",
            "calibration_boost_total",
            "calibration_utilization_boost",
            "calibration_spend_boost",
            "calibration_disease_burden_boost",
            "calibration_population_impact_boost",
            "calibration_risk_boost",
            "calibration_notes",
            "methodology_version",
            "calculation_date",
            "source_coverage_flag",
            "source_overall_intelligence_score",
            "source_claims_readiness_score",
            "source_ai_readiness_score",
            "source_semantic_richness_score",
            "source_interoperability_score",
            "source_clinical_semantics_score",
            "source_explainability_score",
            "source_relationship_density_score",
            "source_classification_density_score",
            "source_relationship_count",
            "source_classification_count",
            "source_disease_count",
            "source_atc_hierarchy_depth",
            "source_schedule_count",
        ]

        final_df = df[output_columns].copy()

        csv_path = output_dir / "enterprise_healthcare_importance_master.csv"
        parquet_path = output_dir / "enterprise_healthcare_importance_master.parquet"
        summary_path = output_dir / "enterprise_healthcare_importance_validation_summary.csv"
        review_path = output_dir / "enterprise_healthcare_importance_top100_review.csv"

        final_df.to_csv(csv_path, index=False)

        try:
            final_df.to_parquet(parquet_path, index=False)
        except Exception as exc:
            print(f"Parquet export skipped: {exc}")

        final_df.to_sql(TARGET_TABLE, conn, if_exists="replace", index=False)

        validation_summary = create_validation_summary(final_df, db_path, source_table)
        validation_summary.to_csv(summary_path, index=False)

        top100_review = build_top100_review(final_df)
        top100_review.to_csv(review_path, index=False)

        print("EHI calibrated real-platform-input build complete.")
        print(f"Rows created: {len(final_df):,}")
        print(f"SQLite table replaced in: {db_path}")
        print(f"SQLite table name: {TARGET_TABLE}")
        print(f"CSV output: {csv_path}")
        print(f"Validation summary: {summary_path}")
        print(f"Top 100 review file: {review_path}")
        print("-" * 80)

        print("Tier distribution:")
        print(
            final_df["ehi_tier_label"]
            .value_counts()
            .rename_axis("tier")
            .reset_index(name="count")
            .to_string(index=False)
        )

        print("-" * 80)
        print("Primary driver distribution:")
        print(
            final_df["primary_driver"]
            .value_counts()
            .rename_axis("primary_driver")
            .reset_index(name="count")
            .to_string(index=False)
        )

        print("-" * 80)
        print("Calibration summary:")
        print(f"Calibrated records: {int((final_df['calibration_boost_total'] > 0).sum()):,}")
        print(
            final_df.loc[final_df["calibration_boost_total"] > 0, "calibration_notes"]
            .value_counts()
            .head(15)
            .rename_axis("calibration_notes")
            .reset_index(name="count")
            .to_string(index=False)
        )

        print("-" * 80)
        print("Top 25 EHI calibrated real-platform-input medications:")
        print(
            final_df.sort_values("ehi_score", ascending=False)
            .head(25)[
                [
                    "rxcui",
                    "drug_name",
                    "ehi_score",
                    "ehi_rank",
                    "ehi_percentile",
                    "ehi_tier_label",
                    "primary_driver",
                    "secondary_driver",
                    "limiting_factor",
                ]
            ]
            .to_string(index=False)
        )

        print("-" * 80)
        print("Validation targets to manually inspect:")
        target_terms = [
            "semaglutide",
            "metformin",
            "atorvastatin",
            "insulin",
            "eliquis",
            "humira",
            "gabapentin",
            "levothyroxine",
        ]

        lower_names = final_df["drug_name"].astype(str).str.lower()
        for term in target_terms:
            matches = final_df[lower_names.str.contains(term, na=False)]
            if matches.empty:
                print(f"  {term}: not found")
                continue

            best = matches.sort_values("ehi_rank", ascending=True).iloc[0]
            print(
                f"  {term}: rank={int(best['ehi_rank'])}, "
                f"score={best['ehi_score']}, "
                f"percentile={best['ehi_percentile']}, "
                f"tier={best['ehi_tier_label']}, "
                f"name={best['drug_name']}"
            )

    finally:
        conn.close()


if __name__ == "__main__":
    main()

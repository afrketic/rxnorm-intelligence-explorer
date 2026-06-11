"""
H3C.1 — CDC Population Burden Intelligence

Purpose
-------
Elevate CDC PLACES prevalence and population-burden evidence from a hidden scoring
input into first-class clinical intelligence artifacts.

This script creates two SQLite tables:
    - cdc_places_population_burden_v1
    - drug_population_burden_mapping_v1

Governance
----------
Dashboard Owner: Clinical Intelligence
Question: What real-world disease burden does this medication address?
Artifact: Disease burden narrative + prevalence benchmark

Important: This sprint does NOT create another visible score. It uses tiers,
benchmarks, and narrative so the platform stays aligned with H3B.5.

Inputs
------
Preferred source table:
    - cdc_disease_burden_master_wonder_v2
Fallback source table:
    - cdc_disease_burden_master

Required source columns:
    - rxcui
    - drug_name
    - canonical_disease_name or disease_domain
    - disease_domain
    - cdc_places_prevalence
    - cdc_places_population_burden_proxy
    - cdc_places_measure

Optional source columns:
    - cdc_prevalence_score
    - cdc_population_burden_score
    - mapping_confidence
    - cdc_burden_score_v2_wonder
    - mortality_rate
    - wonder_source_status

Run locally
-----------
RXNORM_DB_PATH="/path/to/database/rxnorm_research.db" \
python healthcare_intelligence/external_evidence/cdc/integrate_cdc_places_population_burden.py

Optional:
python healthcare_intelligence/external_evidence/cdc/integrate_cdc_places_population_burden.py \
  --source-table cdc_disease_burden_master_wonder_v2 \
  --source-year 2025
"""

from __future__ import annotations

import argparse
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

VERSION = "H3C1_CDC_PLACES_POPULATION_BURDEN_INTELLIGENCE_V1"
PREFERRED_SOURCE_TABLE = "cdc_disease_burden_master_wonder_v2"
FALLBACK_SOURCE_TABLE = "cdc_disease_burden_master"
DOMAIN_TABLE = "cdc_places_population_burden_v1"
DRUG_MAPPING_TABLE = "drug_population_burden_mapping_v1"
SUMMARY_TABLE = "cdc_places_population_burden_summary_v1"


def get_project_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "database" / "rxnorm_research.db").exists():
            return parent
    return current.parents[3]


def get_database_path(project_root: Path) -> Path:
    env_path = os.getenv("RXNORM_DB_PATH")
    candidates = [
        Path(env_path).expanduser() if env_path else None,
        project_root / "database" / "rxnorm_research.db",
        project_root / "backend" / "rxnorm_intelligence.db",
        project_root / "data" / "rxnorm_intelligence.db",
    ]
    for path in candidates:
        if path and path.exists():
            return path.resolve()
    raise FileNotFoundError("Could not locate SQLite database. Set RXNORM_DB_PATH explicitly.")


def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    ).fetchone()
    return row is not None


def require_columns(df: pd.DataFrame, required: list[str], source_table: str) -> None:
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise RuntimeError(f"Source table {source_table} is missing required columns: {missing}")


def as_numeric(series: pd.Series, default: float | None = None) -> pd.Series:
    numeric = pd.to_numeric(series, errors="coerce")
    if default is not None:
        numeric = numeric.fillna(default)
    return numeric


def clean_text(value: Any, fallback: str = "Not available") -> str:
    text = str(value or "").strip()
    if not text or text.lower() in {"nan", "none", "null"}:
        return fallback
    return text


def tier_from_rank(rank_pct: float) -> str:
    """rank_pct is 0-100 where 100 is highest prevalence."""
    if rank_pct >= 90:
        return "Very High"
    if rank_pct >= 75:
        return "High"
    if rank_pct >= 50:
        return "Moderate"
    return "Lower"


def tier_sort_order(tier: str) -> int:
    return {"Very High": 1, "High": 2, "Moderate": 3, "Lower": 4}.get(tier, 99)


def prevalence_label(tier: str) -> str:
    return {
        "Very High": "Very high prevalence condition",
        "High": "High prevalence condition",
        "Moderate": "Moderate prevalence condition",
        "Lower": "Lower prevalence condition",
    }.get(tier, "Prevalence context available")


def build_domain_narrative(row: pd.Series) -> str:
    disease = clean_text(row.get("disease_domain") or row.get("canonical_disease_name"), "This condition")
    measure = clean_text(row.get("places_measure_name"), "CDC PLACES prevalence evidence")
    tier = clean_text(row.get("population_burden_tier"), "Population burden")
    avg_prev = row.get("national_avg_prevalence")

    prevalence_phrase = "available CDC PLACES prevalence evidence"
    if pd.notna(avg_prev):
        prevalence_phrase = f"an average observed prevalence of {float(avg_prev):.1f}% in the mapped PLACES evidence"

    return (
        f"{disease} is classified as a {tier.lower()} population-burden condition based on {measure}. "
        f"The condition shows {prevalence_phrase}, making it important for clinical interpretation, "
        f"population-health planning, payer analytics, and enterprise healthcare strategy."
    )


def build_drug_narrative(row: pd.Series) -> str:
    drug_name = clean_text(row.get("drug_name"), "This medication")
    condition = clean_text(row.get("primary_disease_focus"), "its mapped disease focus")
    tier = clean_text(row.get("population_burden_tier"), "population burden")
    label = clean_text(row.get("population_prevalence_benchmark"), "prevalence context")

    return (
        f"{drug_name} addresses {condition}, which is categorized as a {tier.lower()} population-burden condition. "
        f"This indicates {label.lower()} and helps explain the medication's real-world clinical and enterprise relevance "
        f"without introducing another score."
    )


def select_source_table(conn: sqlite3.Connection, requested: str | None) -> str:
    if requested:
        if not table_exists(conn, requested):
            raise RuntimeError(f"Requested source table not found: {requested}")
        return requested
    if table_exists(conn, PREFERRED_SOURCE_TABLE):
        return PREFERRED_SOURCE_TABLE
    if table_exists(conn, FALLBACK_SOURCE_TABLE):
        return FALLBACK_SOURCE_TABLE
    raise RuntimeError(
        f"Neither {PREFERRED_SOURCE_TABLE} nor {FALLBACK_SOURCE_TABLE} exists. "
        "Run the CDC burden integration first."
    )


def load_source(conn: sqlite3.Connection, source_table: str) -> pd.DataFrame:
    df = pd.read_sql_query(f'SELECT * FROM "{source_table}"', conn)
    require_columns(
        df,
        [
            "rxcui",
            "drug_name",
            "disease_domain",
            "cdc_places_prevalence",
            "cdc_places_population_burden_proxy",
            "cdc_places_measure",
        ],
        source_table,
    )
    if "canonical_disease_name" not in df.columns:
        df["canonical_disease_name"] = df["disease_domain"]
    return df


def build_domain_table(source: pd.DataFrame, source_table: str, source_year: str) -> pd.DataFrame:
    df = source.copy()
    df["cdc_places_prevalence"] = as_numeric(df["cdc_places_prevalence"])
    df["cdc_places_population_burden_proxy"] = as_numeric(df["cdc_places_population_burden_proxy"])

    group_cols = ["disease_domain", "canonical_disease_name", "cdc_places_measure"]

    domain = (
        df.groupby(group_cols, dropna=False)
        .agg(
            national_avg_prevalence=("cdc_places_prevalence", "mean"),
            max_observed_prevalence=("cdc_places_prevalence", "max"),
            avg_population_burden_proxy=("cdc_places_population_burden_proxy", "mean"),
            mapped_medication_count=("rxcui", "nunique"),
        )
        .reset_index()
    )

    domain["places_measure_id"] = domain["cdc_places_measure"].astype(str).str.lower().str.replace(r"[^a-z0-9]+", "_", regex=True).str.strip("_")
    domain["places_measure_name"] = domain["cdc_places_measure"]

    # Rank high prevalence and high population-burden proxy as higher population burden.
    prevalence_rank = domain["national_avg_prevalence"].rank(pct=True, method="average") * 100
    burden_rank = domain["avg_population_burden_proxy"].rank(pct=True, method="average") * 100
    domain["population_prevalence_rank"] = prevalence_rank.round(2)
    domain["population_burden_rank"] = ((0.70 * prevalence_rank) + (0.30 * burden_rank)).round(2)
    domain["population_burden_tier"] = domain["population_burden_rank"].apply(tier_from_rank)
    domain["population_prevalence_benchmark"] = domain["population_burden_tier"].apply(prevalence_label)
    domain["population_burden_narrative"] = domain.apply(build_domain_narrative, axis=1)
    domain["source_year"] = str(source_year)
    domain["source_dataset"] = "CDC PLACES prevalence evidence derived from CDC burden master"
    domain["source_table"] = source_table
    domain["methodology_version"] = VERSION
    domain["build_timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    return domain[
        [
            "disease_domain",
            "canonical_disease_name",
            "places_measure_id",
            "places_measure_name",
            "national_avg_prevalence",
            "max_observed_prevalence",
            "avg_population_burden_proxy",
            "mapped_medication_count",
            "population_prevalence_rank",
            "population_burden_rank",
            "population_burden_tier",
            "population_prevalence_benchmark",
            "population_burden_narrative",
            "source_year",
            "source_dataset",
            "source_table",
            "methodology_version",
            "build_timestamp",
        ]
    ].sort_values(["population_burden_rank", "mapped_medication_count"], ascending=[False, False])


def build_drug_mapping_table(source: pd.DataFrame, domain: pd.DataFrame, source_year: str) -> pd.DataFrame:
    df = source.copy()

    for col in [
        "cdc_places_prevalence",
        "cdc_places_population_burden_proxy",
        "cdc_prevalence_score",
        "cdc_population_burden_score",
        "mapping_confidence",
        "cdc_burden_score_v2_wonder",
    ]:
        if col not in df.columns:
            df[col] = None
        df[col] = as_numeric(df[col], default=0 if col == "mapping_confidence" else None)

    # Pick the most clinically useful disease mapping per medication.
    df["_selection_prevalence"] = df["cdc_places_prevalence"].fillna(-1)
    df["_selection_burden"] = df["cdc_places_population_burden_proxy"].fillna(-1)
    df["_selection_score"] = df["cdc_burden_score_v2_wonder"].fillna(df.get("cdc_burden_score", 0)).fillna(0)

    selected = (
        df.sort_values(
            [
                "rxcui",
                "mapping_confidence",
                "_selection_score",
                "_selection_prevalence",
                "_selection_burden",
            ],
            ascending=[True, False, False, False, False],
        )
        .drop_duplicates("rxcui", keep="first")
        .copy()
    )

    join_cols = [
        "disease_domain",
        "canonical_disease_name",
        "places_measure_name",
        "population_prevalence_rank",
        "population_burden_rank",
        "population_burden_tier",
        "population_prevalence_benchmark",
        "population_burden_narrative",
    ]
    domain_join = domain[join_cols].rename(columns={"places_measure_name": "cdc_places_measure"})

    selected = selected.merge(
        domain_join,
        on=["disease_domain", "canonical_disease_name", "cdc_places_measure"],
        how="left",
        suffixes=("", "_domain"),
    )

    selected["primary_disease_focus"] = selected["canonical_disease_name"].fillna(selected["disease_domain"])
    selected["population_burden_tier"] = selected["population_burden_tier"].fillna("Population Context Available")
    selected["population_prevalence_benchmark"] = selected["population_prevalence_benchmark"].fillna("Prevalence context available")
    selected["population_burden_narrative"] = selected.apply(build_drug_narrative, axis=1)
    selected["source_year"] = str(source_year)
    selected["source_dataset"] = "CDC PLACES prevalence evidence derived from CDC burden master"
    selected["methodology_version"] = VERSION
    selected["build_timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    columns = [
        "rxcui",
        "drug_name",
        "primary_disease_focus",
        "disease_domain",
        "cdc_places_measure",
        "cdc_places_prevalence",
        "cdc_places_population_burden_proxy",
        "population_burden_tier",
        "population_prevalence_rank",
        "population_burden_rank",
        "population_prevalence_benchmark",
        "population_burden_narrative",
        "mapping_method",
        "mapping_confidence",
        "source_year",
        "source_dataset",
        "methodology_version",
        "build_timestamp",
    ]

    for col in columns:
        if col not in selected.columns:
            selected[col] = None

    return selected[columns].sort_values(
        ["population_burden_rank", "mapping_confidence", "drug_name"],
        ascending=[False, False, True],
    )


def build_summary(source_table: str, domain: pd.DataFrame, mapping: pd.DataFrame) -> pd.DataFrame:
    rows = [
        ("methodology_version", VERSION),
        ("build_timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
        ("source_table", source_table),
        ("domain_rows", len(domain)),
        ("drug_mapping_rows", len(mapping)),
        ("unique_rxcuis_with_population_burden", mapping["rxcui"].nunique()),
        ("very_high_burden_medications", int((mapping["population_burden_tier"] == "Very High").sum())),
        ("high_burden_medications", int((mapping["population_burden_tier"] == "High").sum())),
        ("moderate_burden_medications", int((mapping["population_burden_tier"] == "Moderate").sum())),
        ("lower_burden_medications", int((mapping["population_burden_tier"] == "Lower").sum())),
        ("dashboard_owner", "Clinical Intelligence"),
        ("primary_artifact", "Population burden narrative + prevalence benchmark"),
        ("visible_score_created", "No"),
        ("next_step", "Expose population_burden in /explorer/drug-detail/{rxcui} and add Population Disease Burden to Clinical Intelligence."),
    ]
    return pd.DataFrame(rows, columns=["metric", "value"])


def write_outputs(conn: sqlite3.Connection, output_dir: Path, domain: pd.DataFrame, mapping: pd.DataFrame, summary: pd.DataFrame) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    domain.to_sql(DOMAIN_TABLE, conn, if_exists="replace", index=False)
    mapping.to_sql(DRUG_MAPPING_TABLE, conn, if_exists="replace", index=False)
    summary.to_sql(SUMMARY_TABLE, conn, if_exists="replace", index=False)

    domain.to_csv(output_dir / f"{DOMAIN_TABLE}.csv", index=False)
    mapping.to_csv(output_dir / f"{DRUG_MAPPING_TABLE}.csv", index=False)
    summary.to_csv(output_dir / f"{SUMMARY_TABLE}.csv", index=False)

    try:
        with pd.ExcelWriter(output_dir / "cdc_places_population_burden_report.xlsx", engine="openpyxl") as writer:
            summary.to_excel(writer, sheet_name="Summary", index=False)
            domain.to_excel(writer, sheet_name="Population Burden Domains", index=False)
            mapping.head(5000).to_excel(writer, sheet_name="Drug Mapping Sample", index=False)
    except Exception as exc:
        print(f"Excel report skipped: {exc}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create CDC PLACES population burden intelligence tables.")
    parser.add_argument("--source-table", default=None, help="Optional CDC burden source table name.")
    parser.add_argument("--source-year", default="2025", help="CDC PLACES source year label to store in outputs.")
    parser.add_argument("--output-dir", default=None, help="Optional output folder override.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = get_project_root()
    db_path = get_database_path(project_root)
    output_dir = Path(args.output_dir).expanduser() if args.output_dir else project_root / "healthcare_intelligence" / "outputs" / "cdc_places_population_burden_intelligence"

    print("=" * 80)
    print("H3C.1 — CDC Population Burden Intelligence")
    print("=" * 80)
    print(f"Project root: {project_root}")
    print(f"Database path: {db_path}")
    print(f"Output folder: {output_dir}")
    print("-" * 80)

    with sqlite3.connect(db_path) as conn:
        source_table = select_source_table(conn, args.source_table)
        print(f"Source table: {source_table}")
        source = load_source(conn, source_table)
        print(f"Source rows: {len(source):,}")

        domain = build_domain_table(source, source_table, args.source_year)
        mapping = build_drug_mapping_table(source, domain, args.source_year)
        summary = build_summary(source_table, domain, mapping)

        write_outputs(conn, output_dir, domain, mapping, summary)

    print(f"Created table: {DOMAIN_TABLE} ({len(domain):,} rows)")
    print(f"Created table: {DRUG_MAPPING_TABLE} ({len(mapping):,} rows)")
    print(f"Created table: {SUMMARY_TABLE} ({len(summary):,} rows)")
    print("-" * 80)
    print(summary.to_string(index=False))
    print("-" * 80)
    print("Top population burden mappings:")
    print(mapping[["rxcui", "drug_name", "primary_disease_focus", "population_burden_tier", "population_prevalence_benchmark"]].head(25).to_string(index=False))
    print("-" * 80)
    print("H3C.1 complete.")


if __name__ == "__main__":
    main()

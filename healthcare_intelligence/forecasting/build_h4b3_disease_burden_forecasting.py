#!/usr/bin/env python3
"""
H4B.3 — Disease Burden Forecasting Productization

Creates disease_burden_forecasting_v1 from existing CDC PLACES population burden
and CDC WONDER burden assets. This is a narrative-first forecasting layer: it
creates trend signals, not a new score.

Outputs:
  - disease_burden_forecasting_v1
  - disease_burden_forecasting_summary_v1
  - CSV/XLSX exports under healthcare_intelligence/outputs/h4b3_disease_burden_forecasting
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import pandas as pd

METHODOLOGY_VERSION = "H4B3_DISEASE_BURDEN_FORECASTING_PRODUCTIZATION_V1"


def resolve_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_db_path(project_root: Path) -> Path:
    return Path(os.getenv("RXNORM_DB_PATH", project_root / "database" / "rxnorm_research.db")).expanduser().resolve()


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
    return row is not None


def get_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in conn.execute(f'PRAGMA table_info("{table}")').fetchall()]


def first_existing(columns: list[str], candidates: list[str]) -> Optional[str]:
    lower = {c.lower(): c for c in columns}
    for candidate in candidates:
        if candidate.lower() in lower:
            return lower[candidate.lower()]
    return None


def classify_signal(row: pd.Series) -> str:
    tier = str(row.get("population_burden_tier") or "").lower()
    prevalence_rank = float(row.get("population_prevalence_rank") or 0)
    burden_rank = float(row.get("population_burden_rank") or 0)
    prevalence = float(row.get("current_prevalence") or 0)
    medication_count = int(row.get("mapped_medication_count") or 0)
    disease = str(row.get("disease_domain") or "").lower()

    if disease in {"obesity"}:
        return "Accelerating"

    if tier == "very high" or prevalence_rank >= 95 or burden_rank >= 95:
        return "Accelerating"

    if (
        tier == "high"
        or prevalence_rank >= 60
        or burden_rank >= 60
        or prevalence >= 10
        or medication_count >= 750
    ):
        return "Growing"

    if prevalence > 0 or medication_count > 0:
        return "Stable"

    return "Stable"


def build_narrative(row: pd.Series) -> str:
    disease = row.get("disease_domain") or row.get("canonical_disease_name") or "This disease area"
    signal = row.get("burden_trend_signal") or "Stable"
    prevalence = row.get("current_prevalence")
    mortality = row.get("current_mortality")
    tier = row.get("population_burden_tier") or "available"
    medication_count = row.get("mapped_medication_count")

    prevalence_text = "available CDC PLACES prevalence evidence"
    if pd.notna(prevalence):
        prevalence_text = f"an observed national prevalence of {float(prevalence):.1f}%"

    mortality_text = ""
    if pd.notna(mortality):
        mortality_text = f" CDC WONDER mortality context is also available ({float(mortality):,.0f})."

    if signal == "Accelerating":
        lead = f"{disease} is forecast as an accelerating disease-burden priority"
    elif signal == "Growing":
        lead = f"{disease} is forecast as a growing healthcare burden"
    elif signal == "Declining":
        lead = f"{disease} is forecast as a declining disease-burden priority"
    else:
        lead = f"{disease} is forecast as a stable but relevant disease-burden area"

    return (
        f"{lead} based on {prevalence_text}, {str(tier).lower()} population-burden classification, "
        f"and {int(medication_count or 0):,} mapped medications in the enterprise intelligence layer."
        f"{mortality_text} This signal is intended to support clinical interpretation, portfolio planning, "
        "and future scenario intelligence without introducing a new forecast score."
    )


def build_mortality_frame(conn: sqlite3.Connection) -> pd.DataFrame:
    table = "cdc_disease_burden_master_wonder_v2"
    if not table_exists(conn, table):
        return pd.DataFrame(columns=["disease_domain", "current_mortality"])

    cols = get_columns(conn, table)
    disease_col = first_existing(cols, ["disease_domain", "primary_disease_focus", "canonical_disease_name", "disease_name", "primary_therapeutic_domain_name"])
    mortality_col = first_existing(cols, [
        "current_mortality",
        "wonder_mortality",
        "mortality_count",
        "deaths",
        "death_count",
        "cdc_wonder_mortality",
        "cdc_mortality_count",
    ])

    if not disease_col or not mortality_col:
        return pd.DataFrame(columns=["disease_domain", "current_mortality"])

    query = f'''
        SELECT
            CAST("{disease_col}" AS TEXT) AS disease_domain,
            SUM(CAST("{mortality_col}" AS REAL)) AS current_mortality
        FROM "{table}"
        WHERE "{disease_col}" IS NOT NULL
        GROUP BY CAST("{disease_col}" AS TEXT)
    '''
    try:
        return pd.read_sql_query(query, conn)
    except Exception:
        return pd.DataFrame(columns=["disease_domain", "current_mortality"])


def main() -> None:
    project_root = resolve_project_root()
    db_path = resolve_db_path(project_root)
    output_dir = project_root / "healthcare_intelligence" / "outputs" / "h4b3_disease_burden_forecasting"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("H4B.3 — Disease Burden Forecasting Productization")
    print("=" * 80)
    print(f"Project root: {project_root}")
    print(f"Database path: {db_path}")
    print(f"Output folder: {output_dir}")
    print("-" * 80)

    if not db_path.exists():
        raise FileNotFoundError(f"SQLite database not found: {db_path}")

    build_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with sqlite3.connect(db_path) as conn:
        if not table_exists(conn, "cdc_places_population_burden_v1"):
            raise RuntimeError("Required table not found: cdc_places_population_burden_v1")

        places = pd.read_sql_query('SELECT * FROM cdc_places_population_burden_v1', conn)
        mortality = build_mortality_frame(conn)

        df = places.copy()
        if not mortality.empty:
            df = df.merge(mortality, on="disease_domain", how="left")
        else:
            df["current_mortality"] = None

        df["current_prevalence"] = pd.to_numeric(df.get("national_avg_prevalence"), errors="coerce")
        df["burden_trend_signal"] = df.apply(classify_signal, axis=1)
        df["forecast_narrative"] = df.apply(build_narrative, axis=1)
        df["forecast_version"] = METHODOLOGY_VERSION
        df["source_dataset"] = df.get("source_dataset", "CDC PLACES + CDC WONDER")
        df["build_timestamp"] = build_timestamp

        output_columns = [
            "disease_domain",
            "canonical_disease_name",
            "places_measure_id",
            "places_measure_name",
            "current_prevalence",
            "current_mortality",
            "avg_population_burden_proxy",
            "mapped_medication_count",
            "population_prevalence_rank",
            "population_burden_rank",
            "population_burden_tier",
            "population_prevalence_benchmark",
            "burden_trend_signal",
            "forecast_narrative",
            "forecast_version",
            "source_year",
            "source_dataset",
            "build_timestamp",
        ]
        for col in output_columns:
            if col not in df.columns:
                df[col] = None

        final = df[output_columns].copy()
        sort_order = {"Accelerating": 1, "Growing": 2, "Stable": 3, "Declining": 4}
        final["_signal_sort"] = final["burden_trend_signal"].map(sort_order).fillna(9)
        final = final.sort_values(
            by=["_signal_sort", "population_burden_rank", "population_prevalence_rank", "mapped_medication_count"],
            ascending=[True, False, False, False],
        ).drop(columns=["_signal_sort"])

        conn.execute("DROP TABLE IF EXISTS disease_burden_forecasting_v1")
        final.to_sql("disease_burden_forecasting_v1", conn, index=False, if_exists="replace")

        summary_rows: list[dict[str, Any]] = [
            {"metric": "methodology_version", "value": METHODOLOGY_VERSION},
            {"metric": "build_timestamp", "value": build_timestamp},
            {"metric": "source_table", "value": "cdc_places_population_burden_v1"},
            {"metric": "secondary_source_table", "value": "cdc_disease_burden_master_wonder_v2"},
            {"metric": "disease_forecast_rows", "value": len(final)},
            {"metric": "accelerating_disease_areas", "value": int((final["burden_trend_signal"] == "Accelerating").sum())},
            {"metric": "growing_disease_areas", "value": int((final["burden_trend_signal"] == "Growing").sum())},
            {"metric": "stable_disease_areas", "value": int((final["burden_trend_signal"] == "Stable").sum())},
            {"metric": "declining_disease_areas", "value": int((final["burden_trend_signal"] == "Declining").sum())},
            {"metric": "visible_score_created", "value": "No"},
            {"metric": "primary_artifact", "value": "Population burden trend signal and forecast narrative"},
        ]
        summary = pd.DataFrame(summary_rows)
        conn.execute("DROP TABLE IF EXISTS disease_burden_forecasting_summary_v1")
        summary.to_sql("disease_burden_forecasting_summary_v1", conn, index=False, if_exists="replace")

        final.to_csv(output_dir / "disease_burden_forecasting_v1.csv", index=False)
        summary.to_csv(output_dir / "disease_burden_forecasting_summary_v1.csv", index=False)
        try:
            with pd.ExcelWriter(output_dir / "disease_burden_forecasting_report.xlsx") as writer:
                final.to_excel(writer, sheet_name="forecasting", index=False)
                summary.to_excel(writer, sheet_name="summary", index=False)
        except Exception as error:
            print(f"Excel export skipped: {error}")

    print(f"Created table: disease_burden_forecasting_v1 ({len(final):,} rows)")
    print(f"Created table: disease_burden_forecasting_summary_v1 ({len(summary):,} rows)")
    print("-" * 80)
    print(summary.to_string(index=False))
    print("-" * 80)
    print("Top disease burden forecasts:")
    print(final[["disease_domain", "current_prevalence", "population_burden_tier", "burden_trend_signal"]].head(20).to_string(index=False))
    print("-" * 80)
    print("H4B.3 complete.")


if __name__ == "__main__":
    main()

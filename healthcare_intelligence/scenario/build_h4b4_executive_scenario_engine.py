#!/usr/bin/env python3
"""
H4B.4 — Executive Scenario Intelligence Productization

Builds narrative-first scenario intelligence tables from existing sensitivity,
EHI V6 simulation, disease burden forecasting, and emerging intelligence assets.
No scenario score is created.
"""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from datetime import datetime
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.getenv("RXNORM_DB_PATH", PROJECT_ROOT / "database" / "rxnorm_research.db")).resolve()
OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "h4b4_executive_scenario_intelligence"
VERSION = "H4B4_EXECUTIVE_SCENARIO_INTELLIGENCE_V1"


def table_exists(conn: sqlite3.Connection, table: str) -> bool:
    row = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)).fetchone()
    return row is not None


def read_sql(conn: sqlite3.Connection, query: str, params=()) -> pd.DataFrame:
    return pd.read_sql_query(query, conn, params=params)


def make_rows(conn: sqlite3.Connection) -> pd.DataFrame:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    rows = []

    if table_exists(conn, "enterprise_healthcare_importance_master_v6_simulation"):
        obesity = read_sql(
            conn,
            """
            SELECT rxcui, drug_name, disease_domain, ehi_score_v6, ehi_rank_v6,
                   ehi_v6_tier_label, dashboard_primary_driver, secondary_driver,
                   risk_score_v3_final_fda, fda_safety_score_final
            FROM enterprise_healthcare_importance_master_v6_simulation
            WHERE LOWER(COALESCE(disease_domain,'')) LIKE '%obesity%'
               OR LOWER(COALESCE(drug_name,'')) IN ('semaglutide','dulaglutide','tirzepatide','liraglutide')
            ORDER BY ehi_rank_v6 ASC
            LIMIT 25
            """,
        )
        for i, r in obesity.iterrows():
            med = r.get("drug_name") or "GLP-1 medication"
            rows.append({
                "scenario_name": "Obesity prevalence +10%",
                "scenario_type": "Population Burden Change",
                "scenario_signal": "Population burden increase",
                "target_domain": "Obesity",
                "affected_rxcui": str(r.get("rxcui") or ""),
                "affected_medication": med,
                "portfolio_impact": "GLP-1 and obesity-adjacent portfolio importance is expected to rise as population burden increases.",
                "disease_impact": "Obesity burden moves higher, increasing the enterprise relevance of cardiometabolic and weight-management therapies.",
                "medication_impact": f"{med} becomes more important to monitor because its portfolio context is directly exposed to obesity burden growth.",
                "executive_recommendation": "Increase strategic monitoring of obesity-related therapies, payer utilization trends, and GLP-1 portfolio positioning.",
                "scenario_priority_rank": int(i) + 1,
                "source_tables": "enterprise_healthcare_importance_master_v6_simulation; disease_burden_forecasting_v1",
                "scenario_version": VERSION,
                "build_timestamp": now,
            })

        risk = read_sql(
            conn,
            """
            SELECT rxcui, drug_name, disease_domain, ehi_score_v6, ehi_rank_v6,
                   ehi_v6_tier_label, risk_score_v3_final_fda, fda_safety_score_final
            FROM enterprise_healthcare_importance_master_v6_simulation
            WHERE risk_score_v3_final_fda IS NOT NULL OR fda_safety_score_final IS NOT NULL
            ORDER BY COALESCE(fda_safety_score_final, risk_score_v3_final_fda, 0) DESC,
                     ehi_rank_v6 ASC
            LIMIT 25
            """,
        )
        for i, r in risk.iterrows():
            med = r.get("drug_name") or "Selected medication"
            domain = r.get("disease_domain") or "Enterprise portfolio"
            rows.append({
                "scenario_name": "New FDA safety signal",
                "scenario_type": "FDA Safety Signal",
                "scenario_signal": "Safety risk increase",
                "target_domain": domain,
                "affected_rxcui": str(r.get("rxcui") or ""),
                "affected_medication": med,
                "portfolio_impact": "Portfolio rank may decline or require review as safety risk becomes more visible to executive stakeholders.",
                "disease_impact": f"{domain} remains clinically relevant, but benefit-risk positioning requires renewed governance review.",
                "medication_impact": f"{med} should move into watchlist review if a new FDA safety signal emerges.",
                "executive_recommendation": "Trigger safety surveillance, refresh risk narrative, and review portfolio placement before expanding strategic use.",
                "scenario_priority_rank": 100 + int(i) + 1,
                "source_tables": "enterprise_healthcare_importance_master_v6_simulation; sensitivity_analysis_results_v1",
                "scenario_version": VERSION,
                "build_timestamp": now,
            })

    if table_exists(conn, "emerging_therapeutic_class_v1"):
        emerging = read_sql(
            conn,
            """
            SELECT portfolio_type, portfolio_code, portfolio_name, emerging_signal,
                   opportunity_tier, recommended_action, opportunity_use_case,
                   enterprise_opportunity_rank
            FROM emerging_therapeutic_class_v1
            WHERE emerging_signal IN ('Emerging Priority','Watchlist')
            ORDER BY enterprise_opportunity_rank ASC
            LIMIT 25
            """,
        )
        for i, r in emerging.iterrows():
            name = r.get("portfolio_name") or r.get("portfolio_code") or "Emerging therapeutic class"
            rows.append({
                "scenario_name": "New therapeutic breakthrough",
                "scenario_type": "Therapeutic Breakthrough",
                "scenario_signal": r.get("emerging_signal") or "Watchlist",
                "target_domain": name,
                "affected_rxcui": None,
                "affected_medication": name,
                "portfolio_impact": f"{name} portfolio opportunity may increase if breakthrough evidence or adoption accelerates.",
                "disease_impact": "Future disease priorities may shift toward therapeutic areas with new evidence, adoption, or delivery-model advantages.",
                "medication_impact": "Medications in this class should be monitored for emerging strategic priority status.",
                "executive_recommendation": r.get("recommended_action") or "Monitor evidence, utilization, and portfolio opportunity signals.",
                "scenario_priority_rank": 200 + int(i) + 1,
                "source_tables": "emerging_therapeutic_class_v1; emerging_medication_intelligence_v1",
                "scenario_version": VERSION,
                "build_timestamp": now,
            })

    if not rows and table_exists(conn, "disease_burden_forecasting_v1"):
        fallback = read_sql(conn, "SELECT * FROM disease_burden_forecasting_v1 ORDER BY population_burden_rank DESC LIMIT 10")
        for i, r in fallback.iterrows():
            domain = r.get("disease_domain") or "Disease burden domain"
            rows.append({
                "scenario_name": f"{domain} burden shift",
                "scenario_type": "Population Burden Change",
                "scenario_signal": r.get("burden_trend_signal") or "Growing",
                "target_domain": domain,
                "affected_rxcui": None,
                "affected_medication": domain,
                "portfolio_impact": f"Portfolio attention may increase if {domain} burden grows.",
                "disease_impact": r.get("forecast_narrative") or f"{domain} has forward-looking burden context.",
                "medication_impact": "Mapped medications should be reviewed for population-health relevance.",
                "executive_recommendation": "Review disease burden trend and prioritize relevant medication portfolios for monitoring.",
                "scenario_priority_rank": int(i) + 1,
                "source_tables": "disease_burden_forecasting_v1",
                "scenario_version": VERSION,
                "build_timestamp": now,
            })

    return pd.DataFrame(rows)


def build(conn: sqlite3.Connection) -> dict:
    scenario = make_rows(conn)
    if scenario.empty:
        raise RuntimeError("No H4B.4 scenario rows could be generated from available source tables.")

    conn.execute("DROP TABLE IF EXISTS executive_scenario_engine_v1")
    scenario.to_sql("executive_scenario_engine_v1", conn, index=False)

    summary = (
        scenario.groupby(["scenario_type", "scenario_name"], dropna=False)
        .agg(
            scenario_count=("scenario_name", "size"),
            affected_medication_count=("affected_medication", "nunique"),
            top_recommendation=("executive_recommendation", "first"),
        )
        .reset_index()
    )
    summary["scenario_version"] = VERSION
    summary["build_timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn.execute("DROP TABLE IF EXISTS scenario_impact_summary_v1")
    summary.to_sql("scenario_impact_summary_v1", conn, index=False)

    recommendations = scenario[[
        "scenario_name",
        "scenario_type",
        "target_domain",
        "portfolio_impact",
        "disease_impact",
        "medication_impact",
        "executive_recommendation",
        "scenario_version",
        "build_timestamp",
    ]].drop_duplicates().copy()
    recommendations.insert(0, "recommendation_rank", range(1, len(recommendations) + 1))
    conn.execute("DROP TABLE IF EXISTS scenario_recommendation_v1")
    recommendations.to_sql("scenario_recommendation_v1", conn, index=False)

    conn.commit()
    return {
        "scenario_rows": len(scenario),
        "summary_rows": len(summary),
        "recommendation_rows": len(recommendations),
        "scenario_types": ", ".join(sorted(scenario["scenario_type"].dropna().unique())),
    }


def main() -> None:
    print("=" * 80)
    print("H4B.4 — Executive Scenario Intelligence Productization")
    print("=" * 80)
    print(f"Project root: {PROJECT_ROOT}")
    print(f"Database path: {DB_PATH}")
    print(f"Output folder: {OUTPUT_DIR}")
    print("-" * 80)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(DB_PATH) as conn:
        result = build(conn)
        scenario = pd.read_sql_query("SELECT * FROM executive_scenario_engine_v1", conn)
        summary = pd.read_sql_query("SELECT * FROM scenario_impact_summary_v1", conn)
        recommendations = pd.read_sql_query("SELECT * FROM scenario_recommendation_v1", conn)

    scenario.to_csv(OUTPUT_DIR / "executive_scenario_engine_v1.csv", index=False)
    summary.to_csv(OUTPUT_DIR / "scenario_impact_summary_v1.csv", index=False)
    recommendations.to_csv(OUTPUT_DIR / "scenario_recommendation_v1.csv", index=False)

    report_path = OUTPUT_DIR / "executive_scenario_intelligence_report.xlsx"
    with pd.ExcelWriter(report_path) as writer:
        scenario.to_excel(writer, sheet_name="executive_scenarios", index=False)
        summary.to_excel(writer, sheet_name="impact_summary", index=False)
        recommendations.to_excel(writer, sheet_name="recommendations", index=False)

    print("Created table: executive_scenario_engine_v1", f"({result['scenario_rows']} rows)")
    print("Created table: scenario_impact_summary_v1", f"({result['summary_rows']} rows)")
    print("Created table: scenario_recommendation_v1", f"({result['recommendation_rows']} rows)")
    print("-" * 80)
    print("Scenario types:", result["scenario_types"])
    print("Visible score created: No")
    print("Primary artifact: Portfolio impact, disease impact, medication impact, and executive recommendation")
    print("-" * 80)
    print("Top scenario records:")
    print(scenario[["scenario_name", "scenario_type", "target_domain", "affected_medication"]].head(15).to_string(index=False))
    print("-" * 80)
    print("H4B.4 complete.")


if __name__ == "__main__":
    main()

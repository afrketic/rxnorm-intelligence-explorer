import os
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("RXNORM_DB_PATH", PROJECT_ROOT / "database" / "rxnorm_research.db"))
OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "ehi_v5_dashboard_migration"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BUILD_VERSION = "H3A16_DASHBOARD_MIGRATION_TO_CALIBRATED_V5_V1"
BUILD_TS = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

conn = sqlite3.connect(DB_PATH)

source = pd.read_sql_query("""
SELECT *
FROM enterprise_healthcare_importance_master_v5_blended
""", conn)

dashboard = source.copy()

dashboard["dashboard_ehi_version"] = "EHI V5 Calibrated"
dashboard["dashboard_ehi_score"] = dashboard["ehi_score_v5_blended"]
dashboard["dashboard_ehi_rank"] = dashboard["ehi_rank_v5_blended"]
dashboard["dashboard_ehi_tier"] = dashboard["ehi_v5_blended_tier"]
dashboard["dashboard_ehi_tier_label"] = dashboard["ehi_v5_blended_tier_label"]
dashboard["dashboard_primary_driver"] = dashboard["primary_driver"]
dashboard["dashboard_limiting_factor"] = dashboard["primary_limiting_factor"]
dashboard["dashboard_explainability_narrative"] = dashboard["executive_explainability_narrative"]
dashboard["dashboard_methodology_version"] = BUILD_VERSION
dashboard["dashboard_calculation_date"] = BUILD_TS
dashboard["dashboard_source_table"] = "enterprise_healthcare_importance_master_v5_blended"

dashboard_cols = [
    "rxcui",
    "drug_name",
    "dashboard_ehi_version",
    "dashboard_ehi_score",
    "dashboard_ehi_rank",
    "dashboard_ehi_tier",
    "dashboard_ehi_tier_label",
    "dashboard_primary_driver",
    "secondary_driver",
    "dashboard_limiting_factor",
    "secondary_limiting_factor",
    "dashboard_explainability_narrative",
    "ehi_score_v4",
    "ehi_rank_v4",
    "ehi_score_v5",
    "ehi_rank_v5",
    "ehi_score_v5_blended",
    "ehi_rank_v5_blended",
    "rank_change_v4_to_v5_blended",
    "score_change_v4_to_v5_blended",
    "utilization_score",
    "spend_score",
    "population_impact_score",
    "disease_burden_score_v2",
    "risk_score_v3_final_fda",
    "cdc_burden_score",
    "external_evidence_score_calibrated",
    "has_cdc_burden_evidence",
    "disease_domain",
    "canonical_disease_name",
    "cms_drug_name",
    "cms_spend",
    "cms_utilization",
    "cms_beneficiary_count",
    "fda_safety_score_final",
    "fda_query_name",
    "dashboard_methodology_version",
    "dashboard_calculation_date",
    "dashboard_source_table",
]

dashboard_cols = [c for c in dashboard_cols if c in dashboard.columns]
dashboard_export = dashboard[dashboard_cols].copy()

top_cards = dashboard_export.sort_values("dashboard_ehi_rank").head(500).copy()

qa = pd.DataFrame([
    {
        "qa_domain": "Dashboard Migration",
        "metric": "Dashboard master row count",
        "value": len(dashboard_export),
        "expected": 30132,
        "status": "PASS" if len(dashboard_export) == 30132 else "FAIL",
    },
    {
        "qa_domain": "Dashboard Score",
        "metric": "Non-null dashboard EHI scores",
        "value": dashboard_export["dashboard_ehi_score"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if dashboard_export["dashboard_ehi_score"].notna().sum() == 30132 else "FAIL",
    },
    {
        "qa_domain": "Dashboard Rank",
        "metric": "Unique dashboard ranks",
        "value": dashboard_export["dashboard_ehi_rank"].nunique(),
        "expected": 30132,
        "status": "PASS" if dashboard_export["dashboard_ehi_rank"].nunique() == 30132 else "FAIL",
    },
    {
        "qa_domain": "Dashboard Explainability",
        "metric": "Rows with dashboard primary driver",
        "value": dashboard_export["dashboard_primary_driver"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if dashboard_export["dashboard_primary_driver"].notna().sum() == 30132 else "FAIL",
    },
    {
        "qa_domain": "Dashboard Tier",
        "metric": "Rows with dashboard tier label",
        "value": dashboard_export["dashboard_ehi_tier_label"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if dashboard_export["dashboard_ehi_tier_label"].notna().sum() == 30132 else "FAIL",
    },
])

qa["build_version"] = BUILD_VERSION
qa["build_timestamp"] = BUILD_TS

decision = pd.DataFrame([{
    "decision_version": BUILD_VERSION,
    "build_timestamp": BUILD_TS,
    "dashboard_source": "enterprise_healthcare_importance_master_v5_blended",
    "dashboard_target": "enterprise_healthcare_importance_dashboard_current",
    "promotion_decision": "PROMOTED_TO_DASHBOARD_CURRENT",
    "production_ehi_version": "EHI V5 Calibrated",
    "recommendation": "Use enterprise_healthcare_importance_dashboard_current as the API/dashboard source going forward.",
}])

dashboard_export.to_sql("enterprise_healthcare_importance_dashboard_current", conn, if_exists="replace", index=False)
top_cards.to_sql("enterprise_healthcare_importance_dashboard_top500_v1", conn, if_exists="replace", index=False)
qa.to_sql("ehi_v5_dashboard_migration_qa_summary_v1", conn, if_exists="replace", index=False)
decision.to_sql("ehi_v5_dashboard_migration_decision_v1", conn, if_exists="replace", index=False)

dashboard_export.to_csv(OUTPUT_DIR / "enterprise_healthcare_importance_dashboard_current.csv", index=False)
top_cards.to_csv(OUTPUT_DIR / "enterprise_healthcare_importance_dashboard_top500_v1.csv", index=False)
qa.to_csv(OUTPUT_DIR / "ehi_v5_dashboard_migration_qa_summary_v1.csv", index=False)
decision.to_csv(OUTPUT_DIR / "ehi_v5_dashboard_migration_decision_v1.csv", index=False)

with pd.ExcelWriter(OUTPUT_DIR / "ehi_v5_dashboard_migration_v1.xlsx", engine="openpyxl") as writer:
    decision.to_excel(writer, sheet_name="Decision", index=False)
    qa.to_excel(writer, sheet_name="QA Summary", index=False)
    top_cards.to_excel(writer, sheet_name="Top 500", index=False)

conn.commit()
conn.close()

print("=" * 80)
print("H3A.16 — Dashboard Migration to Calibrated V5")
print("=" * 80)
print("Created tables:")
print("enterprise_healthcare_importance_dashboard_current")
print("enterprise_healthcare_importance_dashboard_top500_v1")
print("ehi_v5_dashboard_migration_qa_summary_v1")
print("ehi_v5_dashboard_migration_decision_v1")
print("-" * 80)
print("QA Summary:")
print(qa.to_string(index=False))
print("-" * 80)
print("Decision:")
print(decision.to_string(index=False))
print("-" * 80)
print(f"Output folder: {OUTPUT_DIR}")
print("H3A.16 complete.")
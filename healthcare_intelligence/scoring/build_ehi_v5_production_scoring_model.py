import os
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("RXNORM_DB_PATH", PROJECT_ROOT / "database" / "rxnorm_research.db"))
OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "ehi_v5_production"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BUILD_VERSION = "H3A12_EHI_V5_PRODUCTION_SCORING_MODEL_V1"
BUILD_TS = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

SOURCE_TABLE = "enterprise_healthcare_importance_master_v4_cdc"
EXPLAINABILITY_TABLE = "ehi_v5_explainability_summary_v1"

WEIGHTS = {
    "utilization_score": 0.20,
    "spend_score": 0.15,
    "population_impact_score": 0.15,
    "disease_burden_score_v2": 0.20,
    "risk_score_v3_final_fda": 0.15,
    "cdc_burden_score": 0.10,
    "external_evidence_score_calibrated": 0.05,
}

conn = sqlite3.connect(DB_PATH)

base = pd.read_sql_query(f"""
SELECT *
FROM {SOURCE_TABLE}
""", conn)

explain = pd.read_sql_query(f"""
SELECT
    rxcui,
    primary_driver,
    secondary_driver,
    primary_limiting_factor,
    secondary_limiting_factor,
    ehi_v5_explainability_score,
    executive_explainability_narrative
FROM {EXPLAINABILITY_TABLE}
""", conn)

# CDC imputation: if CDC burden missing, anchor to disease burden so the domain is neutral rather than zero.
base["cdc_burden_score_filled"] = base["cdc_burden_score"].fillna(base["disease_burden_score_v2"])

domain_map = {
    "utilization_score": "utilization_score",
    "spend_score": "spend_score",
    "population_impact_score": "population_impact_score",
    "disease_burden_score_v2": "disease_burden_score_v2",
    "risk_score_v3_final_fda": "risk_score_v3_final_fda",
    "cdc_burden_score": "cdc_burden_score_filled",
    "external_evidence_score_calibrated": "external_evidence_score_calibrated",
}

# Percentile normalization
for domain, source_col in domain_map.items():
    base[f"{domain}_percentile_v5"] = base[source_col].rank(pct=True) * 100
    base[f"{domain}_weighted_v5"] = base[f"{domain}_percentile_v5"] * WEIGHTS[domain]

weighted_cols = [f"{domain}_weighted_v5" for domain in WEIGHTS]

base["ehi_score_v5_raw"] = base[weighted_cols].sum(axis=1)
base["ehi_score_v5"] = base["ehi_score_v5_raw"].round(2)
base["ehi_rank_v5"] = base["ehi_score_v5_raw"].rank(method="first", ascending=False).astype(int)
base["ehi_v5_percentile"] = base["ehi_score_v5_raw"].rank(pct=True) * 100

base["ehi_v5_tier_label"] = pd.cut(
    base["ehi_v5_percentile"],
    bins=[0, 50, 75, 90, 97, 100],
    labels=[
        "Foundational",
        "Moderate",
        "High",
        "Enterprise Critical",
        "Strategic Priority",
    ],
    include_lowest=True,
)

base["ehi_v5_tier"] = pd.cut(
    base["ehi_v5_percentile"],
    bins=[0, 50, 75, 90, 97, 100],
    labels=[5, 4, 3, 2, 1],
    include_lowest=True,
).astype(int)

base["rank_change_v4_to_v5"] = base["ehi_rank_v4"] - base["ehi_rank_v5"]
base["score_change_v4_to_v5"] = base["ehi_score_v5"] - base["ehi_score_v4"]

base["methodology_version_v5"] = BUILD_VERSION
base["calculation_date_v5"] = BUILD_TS
base["ehi_v5_weighting_strategy"] = "Hybrid expert-statistical weights"
base["ehi_v5_normalization_method"] = "Percentile rank normalization"
base["ehi_v5_cdc_imputation_method"] = "Missing CDC burden imputed from disease_burden_score_v2"

master = base.merge(explain, on="rxcui", how="left")

# Preserve production-friendly column order
preferred_cols = [
    "rxcui",
    "drug_name",
    "ehi_score_v5",
    "ehi_rank_v5",
    "ehi_v5_percentile",
    "ehi_v5_tier",
    "ehi_v5_tier_label",
    "ehi_score_v4",
    "ehi_rank_v4",
    "rank_change_v4_to_v5",
    "score_change_v4_to_v5",
    "utilization_score",
    "spend_score",
    "population_impact_score",
    "disease_burden_score_v2",
    "risk_score_v3_final_fda",
    "cdc_burden_score",
    "cdc_burden_score_filled",
    "external_evidence_score_calibrated",
    "utilization_score_percentile_v5",
    "spend_score_percentile_v5",
    "population_impact_score_percentile_v5",
    "disease_burden_score_v2_percentile_v5",
    "risk_score_v3_final_fda_percentile_v5",
    "cdc_burden_score_percentile_v5",
    "external_evidence_score_calibrated_percentile_v5",
    "utilization_score_weighted_v5",
    "spend_score_weighted_v5",
    "population_impact_score_weighted_v5",
    "disease_burden_score_v2_weighted_v5",
    "risk_score_v3_final_fda_weighted_v5",
    "cdc_burden_score_weighted_v5",
    "external_evidence_score_calibrated_weighted_v5",
    "primary_driver",
    "secondary_driver",
    "primary_limiting_factor",
    "secondary_limiting_factor",
    "ehi_v5_explainability_score",
    "executive_explainability_narrative",
    "has_cdc_burden_evidence",
    "disease_domain",
    "canonical_disease_name",
    "cms_drug_name",
    "cms_spend",
    "cms_utilization",
    "cms_beneficiary_count",
    "fda_safety_score_final",
    "fda_query_name",
    "methodology_version_v5",
    "calculation_date_v5",
    "ehi_v5_weighting_strategy",
    "ehi_v5_normalization_method",
    "ehi_v5_cdc_imputation_method",
]

existing_preferred = [c for c in preferred_cols if c in master.columns]
remaining = [c for c in master.columns if c not in existing_preferred]
master = master[existing_preferred + remaining]

comparison = master[[
    "rxcui",
    "drug_name",
    "ehi_rank_v4",
    "ehi_rank_v5",
    "rank_change_v4_to_v5",
    "ehi_score_v4",
    "ehi_score_v5",
    "score_change_v4_to_v5",
    "ehi_v4_tier_label",
    "ehi_v5_tier_label",
    "primary_driver",
    "primary_limiting_factor",
    "has_cdc_burden_evidence",
]].copy()

tier_summary = master.groupby("ehi_v5_tier_label", observed=False).agg(
    drug_count=("rxcui", "count"),
    min_score=("ehi_score_v5", "min"),
    max_score=("ehi_score_v5", "max"),
    avg_score=("ehi_score_v5", "mean"),
).reset_index()

tier_summary["avg_score"] = tier_summary["avg_score"].round(2)
tier_summary["build_version"] = BUILD_VERSION
tier_summary["build_timestamp"] = BUILD_TS

qa = pd.DataFrame([
    {
        "qa_domain": "Master Table",
        "metric": "EHI V5 master row count",
        "value": len(master),
        "expected": 30132,
        "status": "PASS" if len(master) == 30132 else "FAIL",
    },
    {
        "qa_domain": "Scoring",
        "metric": "Non-null EHI V5 scores",
        "value": master["ehi_score_v5"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if master["ehi_score_v5"].notna().sum() == 30132 else "FAIL",
    },
    {
        "qa_domain": "Ranking",
        "metric": "Unique EHI V5 ranks",
        "value": master["ehi_rank_v5"].nunique(),
        "expected": 30132,
        "status": "PASS" if master["ehi_rank_v5"].nunique() == 30132 else "FAIL",
    },
    {
        "qa_domain": "Explainability",
        "metric": "Rows with primary driver",
        "value": master["primary_driver"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if master["primary_driver"].notna().sum() == 30132 else "FAIL",
    },
    {
        "qa_domain": "CDC Burden",
        "metric": "Rows with CDC burden evidence flag",
        "value": master["has_cdc_burden_evidence"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if master["has_cdc_burden_evidence"].notna().sum() == 30132 else "FAIL",
    },
])

qa["build_version"] = BUILD_VERSION
qa["build_timestamp"] = BUILD_TS

master.to_sql("enterprise_healthcare_importance_master_v5", conn, if_exists="replace", index=False)
comparison.to_sql("ehi_v4_v5_production_comparison_v1", conn, if_exists="replace", index=False)
tier_summary.to_sql("ehi_v5_production_tier_summary_v1", conn, if_exists="replace", index=False)
qa.to_sql("ehi_v5_production_qa_summary_v1", conn, if_exists="replace", index=False)

master.to_csv(OUTPUT_DIR / "enterprise_healthcare_importance_master_v5.csv", index=False)
comparison.to_csv(OUTPUT_DIR / "ehi_v4_v5_production_comparison_v1.csv", index=False)
tier_summary.to_csv(OUTPUT_DIR / "ehi_v5_production_tier_summary_v1.csv", index=False)
qa.to_csv(OUTPUT_DIR / "ehi_v5_production_qa_summary_v1.csv", index=False)

with pd.ExcelWriter(OUTPUT_DIR / "ehi_v5_production_scoring_model_v1.xlsx", engine="openpyxl") as writer:
    qa.to_excel(writer, sheet_name="QA Summary", index=False)
    tier_summary.to_excel(writer, sheet_name="Tier Summary", index=False)
    comparison.head(1000).to_excel(writer, sheet_name="V4 V5 Comparison", index=False)
    master.head(1000).to_excel(writer, sheet_name="V5 Master Preview", index=False)

conn.commit()
conn.close()

print("=" * 80)
print("H3A.12 — EHI V5 Production Scoring Model")
print("=" * 80)
print("Created tables:")
print("enterprise_healthcare_importance_master_v5")
print("ehi_v4_v5_production_comparison_v1")
print("ehi_v5_production_tier_summary_v1")
print("ehi_v5_production_qa_summary_v1")
print("-" * 80)
print("QA Summary:")
print(qa.to_string(index=False))
print("-" * 80)
print(f"Output folder: {OUTPUT_DIR}")
print("H3A.12 complete.")
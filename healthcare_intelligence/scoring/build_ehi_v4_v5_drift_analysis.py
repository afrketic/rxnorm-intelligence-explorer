import os
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("RXNORM_DB_PATH", PROJECT_ROOT / "database" / "rxnorm_research.db"))
OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "ehi_v4_v5_drift_analysis"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BUILD_VERSION = "H3A14_EHI_V4_V5_DRIFT_ANALYSIS_WEIGHT_CALIBRATION_V1"
BUILD_TS = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

conn = sqlite3.connect(DB_PATH)

df = pd.read_sql_query("""
SELECT *
FROM enterprise_healthcare_importance_master_v5
""", conn)

df["abs_rank_change_v4_to_v5"] = df["rank_change_v4_to_v5"].abs()

top_movers = df.sort_values("rank_change_v4_to_v5", ascending=False).head(500)
top_decliners = df.sort_values("rank_change_v4_to_v5", ascending=True).head(500)
largest_drift = df.sort_values("abs_rank_change_v4_to_v5", ascending=False).head(500)

domain_cols = [
    "utilization_score",
    "spend_score",
    "population_impact_score",
    "disease_burden_score_v2",
    "risk_score_v3_final_fda",
    "cdc_burden_score_filled",
    "external_evidence_score_calibrated",
]

corr_rows = []
for method in ["pearson", "spearman"]:
    corr_rows.append({
        "correlation_type": method,
        "metric_pair": "ehi_score_v4_vs_ehi_score_v5",
        "correlation": df["ehi_score_v4"].corr(df["ehi_score_v5"], method=method),
        "build_version": BUILD_VERSION,
        "build_timestamp": BUILD_TS,
    })
    corr_rows.append({
        "correlation_type": method,
        "metric_pair": "ehi_rank_v4_vs_ehi_rank_v5",
        "correlation": df["ehi_rank_v4"].corr(df["ehi_rank_v5"], method=method),
        "build_version": BUILD_VERSION,
        "build_timestamp": BUILD_TS,
    })

correlation_study = pd.DataFrame(corr_rows)

domain_drift = []
for col in domain_cols:
    percentile_col = col.replace("_filled", "") + "_percentile_v5"
    weighted_col = col.replace("_filled", "") + "_weighted_v5"

    domain_drift.append({
        "domain": col,
        "corr_with_v4_score": df[col].corr(df["ehi_score_v4"], method="spearman"),
        "corr_with_v5_score": df[col].corr(df["ehi_score_v5"], method="spearman"),
        "corr_with_rank_change": df[col].corr(df["rank_change_v4_to_v5"], method="spearman"),
        "avg_raw_score_top500_movers": top_movers[col].mean(),
        "avg_raw_score_top500_decliners": top_decliners[col].mean(),
        "mover_minus_decliner_raw_avg": top_movers[col].mean() - top_decliners[col].mean(),
        "avg_weighted_contribution": df[weighted_col].mean() if weighted_col in df.columns else None,
        "build_version": BUILD_VERSION,
        "build_timestamp": BUILD_TS,
    })

domain_drift = pd.DataFrame(domain_drift)

summary = pd.DataFrame([
    {
        "metric": "row_count",
        "value": len(df),
        "interpretation": "Total medications evaluated in V4/V5 drift analysis.",
    },
    {
        "metric": "average_rank_change_v4_to_v5",
        "value": df["rank_change_v4_to_v5"].mean(),
        "interpretation": "Directional average rank movement.",
    },
    {
        "metric": "average_absolute_rank_change_v4_to_v5",
        "value": df["abs_rank_change_v4_to_v5"].mean(),
        "interpretation": "Magnitude of rank movement regardless of direction.",
    },
    {
        "metric": "median_absolute_rank_change_v4_to_v5",
        "value": df["abs_rank_change_v4_to_v5"].median(),
        "interpretation": "Typical medication-level drift.",
    },
    {
        "metric": "max_positive_rank_change",
        "value": df["rank_change_v4_to_v5"].max(),
        "interpretation": "Largest upward movement.",
    },
    {
        "metric": "max_negative_rank_change",
        "value": df["rank_change_v4_to_v5"].min(),
        "interpretation": "Largest downward movement.",
    },
    {
        "metric": "v4_v5_score_spearman_correlation",
        "value": df["ehi_score_v4"].corr(df["ehi_score_v5"], method="spearman"),
        "interpretation": "Rank-order stability between V4 scores and V5 scores.",
    },
    {
        "metric": "v4_v5_rank_spearman_correlation",
        "value": df["ehi_rank_v4"].corr(df["ehi_rank_v5"], method="spearman"),
        "interpretation": "Direct rank stability between V4 and V5.",
    },
])

summary["build_version"] = BUILD_VERSION
summary["build_timestamp"] = BUILD_TS

# Simple calibration recommendation rules
avg_abs_rank_change = df["abs_rank_change_v4_to_v5"].mean()
rank_corr = df["ehi_rank_v4"].corr(df["ehi_rank_v5"], method="spearman")

if avg_abs_rank_change > 1000 or rank_corr < 0.95:
    recommendation = "DO_NOT_PROMOTE_V5_YET"
    recommended_action = "Calibrate V5 toward V4 using blended scoring or reduced percentile-normalization impact."
else:
    recommendation = "PROMOTE_V5"
    recommended_action = "V5 drift is within acceptable bounds."

recommendations = pd.DataFrame([
    {
        "decision_version": BUILD_VERSION,
        "build_timestamp": BUILD_TS,
        "promotion_recommendation": recommendation,
        "recommended_action": recommended_action,
        "primary_drift_hypothesis": "Percentile normalization transformed the score distribution and overpowered V4 continuity.",
        "weight_calibration_recommendation": "Test blended model: 70% V4 score + 30% V5 statistical score, then compare rank drift.",
        "normalization_recommendation": "Compare percentile normalization against min-max scaling and V4-anchored z-score scaling.",
        "next_sprint": "H3A.15 — V5 Calibrated Blended Model",
    }
])

qa = pd.DataFrame([
    {
        "qa_domain": "Drift Reports",
        "metric": "Top movers generated",
        "value": len(top_movers),
        "expected": 500,
        "status": "PASS" if len(top_movers) == 500 else "FAIL",
    },
    {
        "qa_domain": "Drift Reports",
        "metric": "Top decliners generated",
        "value": len(top_decliners),
        "expected": 500,
        "status": "PASS" if len(top_decliners) == 500 else "FAIL",
    },
    {
        "qa_domain": "Correlation Study",
        "metric": "Correlation rows generated",
        "value": len(correlation_study),
        "expected": 4,
        "status": "PASS" if len(correlation_study) == 4 else "FAIL",
    },
    {
        "qa_domain": "Domain Drift",
        "metric": "Domain drift rows generated",
        "value": len(domain_drift),
        "expected": len(domain_cols),
        "status": "PASS" if len(domain_drift) == len(domain_cols) else "FAIL",
    },
    {
        "qa_domain": "Recommendation",
        "metric": "Calibration recommendation generated",
        "value": len(recommendations),
        "expected": 1,
        "status": "PASS" if len(recommendations) == 1 else "FAIL",
    },
])

qa["build_version"] = BUILD_VERSION
qa["build_timestamp"] = BUILD_TS

summary.to_sql("ehi_v4_v5_drift_summary_v1", conn, if_exists="replace", index=False)
top_movers.to_sql("ehi_v4_v5_top500_movers_v1", conn, if_exists="replace", index=False)
top_decliners.to_sql("ehi_v4_v5_top500_decliners_v1", conn, if_exists="replace", index=False)
largest_drift.to_sql("ehi_v4_v5_largest_drift_top500_v1", conn, if_exists="replace", index=False)
domain_drift.to_sql("ehi_v4_v5_domain_drift_attribution_v1", conn, if_exists="replace", index=False)
correlation_study.to_sql("ehi_v4_v5_correlation_study_v1", conn, if_exists="replace", index=False)
recommendations.to_sql("ehi_v5_weight_calibration_recommendation_v1", conn, if_exists="replace", index=False)
qa.to_sql("ehi_v4_v5_drift_analysis_qa_summary_v1", conn, if_exists="replace", index=False)

summary.to_csv(OUTPUT_DIR / "ehi_v4_v5_drift_summary_v1.csv", index=False)
top_movers.to_csv(OUTPUT_DIR / "ehi_v4_v5_top500_movers_v1.csv", index=False)
top_decliners.to_csv(OUTPUT_DIR / "ehi_v4_v5_top500_decliners_v1.csv", index=False)
largest_drift.to_csv(OUTPUT_DIR / "ehi_v4_v5_largest_drift_top500_v1.csv", index=False)
domain_drift.to_csv(OUTPUT_DIR / "ehi_v4_v5_domain_drift_attribution_v1.csv", index=False)
correlation_study.to_csv(OUTPUT_DIR / "ehi_v4_v5_correlation_study_v1.csv", index=False)
recommendations.to_csv(OUTPUT_DIR / "ehi_v5_weight_calibration_recommendation_v1.csv", index=False)
qa.to_csv(OUTPUT_DIR / "ehi_v4_v5_drift_analysis_qa_summary_v1.csv", index=False)

with pd.ExcelWriter(OUTPUT_DIR / "ehi_v4_v5_drift_analysis_v1.xlsx", engine="openpyxl") as writer:
    qa.to_excel(writer, sheet_name="QA Summary", index=False)
    recommendations.to_excel(writer, sheet_name="Recommendation", index=False)
    summary.to_excel(writer, sheet_name="Drift Summary", index=False)
    correlation_study.to_excel(writer, sheet_name="Correlation Study", index=False)
    domain_drift.to_excel(writer, sheet_name="Domain Drift", index=False)
    top_movers.to_excel(writer, sheet_name="Top 500 Movers", index=False)
    top_decliners.to_excel(writer, sheet_name="Top 500 Decliners", index=False)
    largest_drift.to_excel(writer, sheet_name="Largest Drift Top 500", index=False)

conn.commit()
conn.close()

print("=" * 80)
print("H3A.14 — V4 vs V5 Drift Analysis & Weight Calibration")
print("=" * 80)
print("Created tables:")
print("ehi_v4_v5_drift_summary_v1")
print("ehi_v4_v5_top500_movers_v1")
print("ehi_v4_v5_top500_decliners_v1")
print("ehi_v4_v5_largest_drift_top500_v1")
print("ehi_v4_v5_domain_drift_attribution_v1")
print("ehi_v4_v5_correlation_study_v1")
print("ehi_v5_weight_calibration_recommendation_v1")
print("ehi_v4_v5_drift_analysis_qa_summary_v1")
print("-" * 80)
print("QA Summary:")
print(qa.to_string(index=False))
print("-" * 80)
print("Recommendation:")
print(recommendations.to_string(index=False))
print("-" * 80)
print(f"Output folder: {OUTPUT_DIR}")
print("H3A.14 complete.")
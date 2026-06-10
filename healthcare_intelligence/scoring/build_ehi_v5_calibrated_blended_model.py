import os
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("RXNORM_DB_PATH", PROJECT_ROOT / "database" / "rxnorm_research.db"))
OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "ehi_v5_calibrated_blended"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BUILD_VERSION = "H3A15_EHI_V5_CALIBRATED_BLENDED_MODEL_V1"
BUILD_TS = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

V4_WEIGHT = 0.70
V5_WEIGHT = 0.30

conn = sqlite3.connect(DB_PATH)

df = pd.read_sql_query("""
SELECT *
FROM enterprise_healthcare_importance_master_v5
""", conn)

# Blend V4 continuity with V5 statistical upgrade.
df["ehi_score_v5_blended_raw"] = (
    V4_WEIGHT * df["ehi_score_v4"]
    + V5_WEIGHT * df["ehi_score_v5"]
)

df["ehi_score_v5_blended"] = df["ehi_score_v5_blended_raw"].round(2)
df["ehi_rank_v5_blended"] = df["ehi_score_v5_blended_raw"].rank(method="first", ascending=False).astype(int)
df["ehi_v5_blended_percentile"] = df["ehi_score_v5_blended_raw"].rank(pct=True) * 100

df["rank_change_v4_to_v5_blended"] = df["ehi_rank_v4"] - df["ehi_rank_v5_blended"]
df["score_change_v4_to_v5_blended"] = df["ehi_score_v5_blended"] - df["ehi_score_v4"]
df["raw_v5_abs_rank_change"] = df["rank_change_v4_to_v5"].abs()
df["blended_v5_abs_rank_change"] = df["rank_change_v4_to_v5_blended"].abs()
df["rank_drift_reduction"] = df["raw_v5_abs_rank_change"] - df["blended_v5_abs_rank_change"]

df["ehi_v5_blended_tier_label"] = pd.cut(
    df["ehi_v5_blended_percentile"],
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

df["ehi_v5_blended_tier"] = pd.cut(
    df["ehi_v5_blended_percentile"],
    bins=[0, 50, 75, 90, 97, 100],
    labels=[5, 4, 3, 2, 1],
    include_lowest=True,
).astype(int)

df["methodology_version_v5_blended"] = BUILD_VERSION
df["calculation_date_v5_blended"] = BUILD_TS
df["ehi_v5_blended_method"] = "70% EHI V4 score + 30% EHI V5 statistical score"

# Stability summary
raw_score_corr = df["ehi_score_v4"].corr(df["ehi_score_v5"], method="spearman")
blended_score_corr = df["ehi_score_v4"].corr(df["ehi_score_v5_blended"], method="spearman")

raw_rank_corr = df["ehi_rank_v4"].corr(df["ehi_rank_v5"], method="spearman")
blended_rank_corr = df["ehi_rank_v4"].corr(df["ehi_rank_v5_blended"], method="spearman")

raw_avg_abs_rank_change = df["raw_v5_abs_rank_change"].mean()
blended_avg_abs_rank_change = df["blended_v5_abs_rank_change"].mean()

raw_median_abs_rank_change = df["raw_v5_abs_rank_change"].median()
blended_median_abs_rank_change = df["blended_v5_abs_rank_change"].median()

summary = pd.DataFrame([
    {
        "metric": "raw_v5_score_spearman_corr_with_v4",
        "value": raw_score_corr,
        "interpretation": "Raw V5 score relationship to V4.",
    },
    {
        "metric": "blended_v5_score_spearman_corr_with_v4",
        "value": blended_score_corr,
        "interpretation": "Blended V5 score relationship to V4.",
    },
    {
        "metric": "raw_v5_rank_spearman_corr_with_v4",
        "value": raw_rank_corr,
        "interpretation": "Raw V5 rank relationship to V4.",
    },
    {
        "metric": "blended_v5_rank_spearman_corr_with_v4",
        "value": blended_rank_corr,
        "interpretation": "Blended V5 rank relationship to V4.",
    },
    {
        "metric": "raw_v5_average_absolute_rank_change",
        "value": raw_avg_abs_rank_change,
        "interpretation": "Raw V5 rank drift magnitude.",
    },
    {
        "metric": "blended_v5_average_absolute_rank_change",
        "value": blended_avg_abs_rank_change,
        "interpretation": "Blended V5 rank drift magnitude.",
    },
    {
        "metric": "average_rank_drift_reduction",
        "value": raw_avg_abs_rank_change - blended_avg_abs_rank_change,
        "interpretation": "Average rank drift reduced by blending.",
    },
    {
        "metric": "raw_v5_median_absolute_rank_change",
        "value": raw_median_abs_rank_change,
        "interpretation": "Raw V5 typical drift.",
    },
    {
        "metric": "blended_v5_median_absolute_rank_change",
        "value": blended_median_abs_rank_change,
        "interpretation": "Blended V5 typical drift.",
    },
    {
        "metric": "median_rank_drift_reduction",
        "value": raw_median_abs_rank_change - blended_median_abs_rank_change,
        "interpretation": "Median rank drift reduced by blending.",
    },
])

summary["build_version"] = BUILD_VERSION
summary["build_timestamp"] = BUILD_TS

# Top stability comparisons
v4_top25 = set(df.nsmallest(25, "ehi_rank_v4")["rxcui"])
raw_v5_top25 = set(df.nsmallest(25, "ehi_rank_v5")["rxcui"])
blended_top25 = set(df.nsmallest(25, "ehi_rank_v5_blended")["rxcui"])

v4_top100 = set(df.nsmallest(100, "ehi_rank_v4")["rxcui"])
raw_v5_top100 = set(df.nsmallest(100, "ehi_rank_v5")["rxcui"])
blended_top100 = set(df.nsmallest(100, "ehi_rank_v5_blended")["rxcui"])

top_stability = pd.DataFrame([
    {
        "cohort": "Top 25",
        "raw_v5_overlap_with_v4": len(v4_top25 & raw_v5_top25),
        "raw_v5_overlap_pct": round(len(v4_top25 & raw_v5_top25) / 25 * 100, 2),
        "blended_v5_overlap_with_v4": len(v4_top25 & blended_top25),
        "blended_v5_overlap_pct": round(len(v4_top25 & blended_top25) / 25 * 100, 2),
    },
    {
        "cohort": "Top 100",
        "raw_v5_overlap_with_v4": len(v4_top100 & raw_v5_top100),
        "raw_v5_overlap_pct": round(len(v4_top100 & raw_v5_top100) / 100 * 100, 2),
        "blended_v5_overlap_with_v4": len(v4_top100 & blended_top100),
        "blended_v5_overlap_pct": round(len(v4_top100 & blended_top100) / 100 * 100, 2),
    },
])
top_stability["build_version"] = BUILD_VERSION
top_stability["build_timestamp"] = BUILD_TS

comparison = df[[
    "rxcui",
    "drug_name",
    "ehi_score_v4",
    "ehi_rank_v4",
    "ehi_score_v5",
    "ehi_rank_v5",
    "rank_change_v4_to_v5",
    "raw_v5_abs_rank_change",
    "ehi_score_v5_blended",
    "ehi_rank_v5_blended",
    "rank_change_v4_to_v5_blended",
    "blended_v5_abs_rank_change",
    "rank_drift_reduction",
    "ehi_v5_tier_label",
    "ehi_v5_blended_tier_label",
    "primary_driver",
    "primary_limiting_factor",
    "has_cdc_burden_evidence",
]].copy()

largest_remaining_drift = comparison.sort_values("blended_v5_abs_rank_change", ascending=False).head(500)
largest_drift_reduction = comparison.sort_values("rank_drift_reduction", ascending=False).head(500)

tier_summary = df.groupby("ehi_v5_blended_tier_label", observed=False).agg(
    drug_count=("rxcui", "count"),
    min_score=("ehi_score_v5_blended", "min"),
    max_score=("ehi_score_v5_blended", "max"),
    avg_score=("ehi_score_v5_blended", "mean"),
).reset_index()

tier_summary["avg_score"] = tier_summary["avg_score"].round(2)
tier_summary["build_version"] = BUILD_VERSION
tier_summary["build_timestamp"] = BUILD_TS

promotion_ready = (
    blended_rank_corr >= 0.99
    and blended_avg_abs_rank_change < raw_avg_abs_rank_change
    and top_stability.loc[top_stability["cohort"] == "Top 25", "blended_v5_overlap_pct"].iloc[0] >= 80
)

decision = pd.DataFrame([
    {
        "decision_version": BUILD_VERSION,
        "build_timestamp": BUILD_TS,
        "candidate_model": "EHI V5 Calibrated Blended",
        "blend_formula": "0.70 * EHI V4 + 0.30 * raw EHI V5",
        "promotion_recommendation": "PROMOTE_CALIBRATED_V5" if promotion_ready else "DO_NOT_PROMOTE_YET",
        "reason": (
            "Blended model preserves V4 continuity while incorporating V5 statistical upgrades."
            if promotion_ready
            else "Blended model improved drift but still requires additional calibration review."
        ),
        "next_step": (
            "H3A.16 — Dashboard Migration to Calibrated V5"
            if promotion_ready
            else "H3A.16 — Blend Ratio Sensitivity 80/20, 70/30, 60/40"
        ),
    }
])

qa = pd.DataFrame([
    {
        "qa_domain": "Master Candidate",
        "metric": "Calibrated rows generated",
        "value": len(df),
        "expected": 30132,
        "status": "PASS" if len(df) == 30132 else "FAIL",
    },
    {
        "qa_domain": "Scoring",
        "metric": "Non-null blended scores",
        "value": df["ehi_score_v5_blended"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if df["ehi_score_v5_blended"].notna().sum() == 30132 else "FAIL",
    },
    {
        "qa_domain": "Ranking",
        "metric": "Unique blended ranks",
        "value": df["ehi_rank_v5_blended"].nunique(),
        "expected": 30132,
        "status": "PASS" if df["ehi_rank_v5_blended"].nunique() == 30132 else "FAIL",
    },
    {
        "qa_domain": "Drift Reduction",
        "metric": "Average absolute rank drift improved",
        "value": blended_avg_abs_rank_change,
        "expected": f"Less than raw V5 {round(raw_avg_abs_rank_change, 4)}",
        "status": "PASS" if blended_avg_abs_rank_change < raw_avg_abs_rank_change else "FAIL",
    },
    {
        "qa_domain": "Top 25 Stability",
        "metric": "Blended Top 25 overlap with V4",
        "value": top_stability.loc[top_stability["cohort"] == "Top 25", "blended_v5_overlap_pct"].iloc[0],
        "expected": ">= 80%",
        "status": "PASS" if top_stability.loc[top_stability["cohort"] == "Top 25", "blended_v5_overlap_pct"].iloc[0] >= 80 else "FAIL",
    },
])

qa["build_version"] = BUILD_VERSION
qa["build_timestamp"] = BUILD_TS

df.to_sql("enterprise_healthcare_importance_master_v5_blended", conn, if_exists="replace", index=False)
comparison.to_sql("ehi_v5_blended_comparison_v1", conn, if_exists="replace", index=False)
summary.to_sql("ehi_v5_blended_drift_summary_v1", conn, if_exists="replace", index=False)
top_stability.to_sql("ehi_v5_blended_top_stability_v1", conn, if_exists="replace", index=False)
tier_summary.to_sql("ehi_v5_blended_tier_summary_v1", conn, if_exists="replace", index=False)
largest_remaining_drift.to_sql("ehi_v5_blended_largest_remaining_drift_v1", conn, if_exists="replace", index=False)
largest_drift_reduction.to_sql("ehi_v5_blended_largest_drift_reduction_v1", conn, if_exists="replace", index=False)
decision.to_sql("ehi_v5_blended_promotion_decision_v1", conn, if_exists="replace", index=False)
qa.to_sql("ehi_v5_blended_qa_summary_v1", conn, if_exists="replace", index=False)

df.to_csv(OUTPUT_DIR / "enterprise_healthcare_importance_master_v5_blended.csv", index=False)
comparison.to_csv(OUTPUT_DIR / "ehi_v5_blended_comparison_v1.csv", index=False)
summary.to_csv(OUTPUT_DIR / "ehi_v5_blended_drift_summary_v1.csv", index=False)
top_stability.to_csv(OUTPUT_DIR / "ehi_v5_blended_top_stability_v1.csv", index=False)
tier_summary.to_csv(OUTPUT_DIR / "ehi_v5_blended_tier_summary_v1.csv", index=False)
largest_remaining_drift.to_csv(OUTPUT_DIR / "ehi_v5_blended_largest_remaining_drift_v1.csv", index=False)
largest_drift_reduction.to_csv(OUTPUT_DIR / "ehi_v5_blended_largest_drift_reduction_v1.csv", index=False)
decision.to_csv(OUTPUT_DIR / "ehi_v5_blended_promotion_decision_v1.csv", index=False)
qa.to_csv(OUTPUT_DIR / "ehi_v5_blended_qa_summary_v1.csv", index=False)

with pd.ExcelWriter(OUTPUT_DIR / "ehi_v5_calibrated_blended_model_v1.xlsx", engine="openpyxl") as writer:
    qa.to_excel(writer, sheet_name="QA Summary", index=False)
    decision.to_excel(writer, sheet_name="Decision", index=False)
    summary.to_excel(writer, sheet_name="Drift Summary", index=False)
    top_stability.to_excel(writer, sheet_name="Top Stability", index=False)
    tier_summary.to_excel(writer, sheet_name="Tier Summary", index=False)
    comparison.head(1000).to_excel(writer, sheet_name="Comparison Preview", index=False)
    largest_remaining_drift.to_excel(writer, sheet_name="Remaining Drift Top500", index=False)
    largest_drift_reduction.to_excel(writer, sheet_name="Drift Reduction Top500", index=False)

conn.commit()
conn.close()

print("=" * 80)
print("H3A.15 — V5 Calibrated Blended Model")
print("=" * 80)
print("Created tables:")
print("enterprise_healthcare_importance_master_v5_blended")
print("ehi_v5_blended_comparison_v1")
print("ehi_v5_blended_drift_summary_v1")
print("ehi_v5_blended_top_stability_v1")
print("ehi_v5_blended_tier_summary_v1")
print("ehi_v5_blended_largest_remaining_drift_v1")
print("ehi_v5_blended_largest_drift_reduction_v1")
print("ehi_v5_blended_promotion_decision_v1")
print("ehi_v5_blended_qa_summary_v1")
print("-" * 80)
print("QA Summary:")
print(qa.to_string(index=False))
print("-" * 80)
print("Decision:")
print(decision.to_string(index=False))
print("-" * 80)
print(f"Output folder: {OUTPUT_DIR}")
print("H3A.15 complete.")
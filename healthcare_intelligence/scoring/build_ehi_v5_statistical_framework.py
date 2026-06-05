import os
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("RXNORM_DB_PATH", PROJECT_ROOT / "database" / "rxnorm_research.db"))
OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "ehi_v5_statistical_framework"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BUILD_VERSION = "H3A9_EHI_V5_STATISTICAL_FRAMEWORK_V1"
BUILD_TS = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

SOURCE_TABLE = "enterprise_healthcare_importance_master_v4_cdc"

conn = sqlite3.connect(DB_PATH)

df = pd.read_sql_query(f"""
SELECT
    rxcui,
    drug_name,
    ehi_score_v4,
    ehi_rank_v4,
    utilization_score,
    spend_score,
    population_impact_score,
    risk_score_v3_final_fda,
    external_evidence_score_calibrated,
    disease_burden_score_v2,
    cdc_burden_score,
    has_cms_external_evidence,
    has_final_fda_safety_evidence,
    has_cdc_burden_evidence,
    ehi_v4_tier_label
FROM {SOURCE_TABLE}
""", conn)

score_cols = [
    "utilization_score",
    "spend_score",
    "population_impact_score",
    "risk_score_v3_final_fda",
    "external_evidence_score_calibrated",
    "disease_burden_score_v2",
    "cdc_burden_score",
]

# 1. Descriptive statistics
summary = df[score_cols + ["ehi_score_v4"]].describe().T.reset_index()
summary.columns = ["metric", "count", "mean", "std", "min", "p25", "median", "p75", "max"]
summary["build_version"] = BUILD_VERSION
summary["build_timestamp"] = BUILD_TS

# 2. Missingness / coverage
coverage = []
for col in score_cols:
    coverage.append({
        "metric": col,
        "non_null_count": int(df[col].notna().sum()),
        "missing_count": int(df[col].isna().sum()),
        "coverage_pct": round(df[col].notna().mean() * 100, 2),
        "build_version": BUILD_VERSION,
        "build_timestamp": BUILD_TS,
    })
coverage = pd.DataFrame(coverage)

# 3. Correlation matrix
corr = df[score_cols + ["ehi_score_v4"]].corr(method="pearson").reset_index()
corr = corr.rename(columns={"index": "metric"})
corr["build_version"] = BUILD_VERSION
corr["build_timestamp"] = BUILD_TS

# 4. Spearman rank correlation
rank_corr = df[score_cols + ["ehi_score_v4"]].corr(method="spearman").reset_index()
rank_corr = rank_corr.rename(columns={"index": "metric"})
rank_corr["build_version"] = BUILD_VERSION
rank_corr["build_timestamp"] = BUILD_TS

# 5. Z-score normalization preview
z = df[["rxcui", "drug_name"]].copy()
for col in score_cols:
    std = df[col].std()
    if std and std != 0:
        z[col + "_z"] = (df[col] - df[col].mean()) / std
    else:
        z[col + "_z"] = 0

z["ehi_v5_equal_weight_z_score"] = z[[c + "_z" for c in score_cols]].mean(axis=1)
z["ehi_v5_equal_weight_percentile"] = z["ehi_v5_equal_weight_z_score"].rank(pct=True) * 100
z["build_version"] = BUILD_VERSION
z["build_timestamp"] = BUILD_TS

# 6. Tier calibration preview
tier_preview = z[["rxcui", "drug_name", "ehi_v5_equal_weight_percentile"]].copy()
tier_preview["ehi_v5_statistical_tier"] = pd.cut(
    tier_preview["ehi_v5_equal_weight_percentile"],
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
tier_counts = tier_preview["ehi_v5_statistical_tier"].value_counts().reset_index()
tier_counts.columns = ["ehi_v5_statistical_tier", "drug_count"]
tier_counts["build_version"] = BUILD_VERSION
tier_counts["build_timestamp"] = BUILD_TS

# 7. Sensitivity testing: remove one domain at a time
sensitivity = []
z_cols = [c + "_z" for c in score_cols]
for removed in score_cols:
    keep = [c + "_z" for c in score_cols if c != removed]
    temp_score = z[keep].mean(axis=1)
    corr_with_full = temp_score.corr(z["ehi_v5_equal_weight_z_score"], method="spearman")
    sensitivity.append({
        "removed_domain": removed,
        "spearman_correlation_with_full_equal_weight_model": round(corr_with_full, 6),
        "interpretation": "Lower correlation means this domain has higher influence.",
        "build_version": BUILD_VERSION,
        "build_timestamp": BUILD_TS,
    })
sensitivity = pd.DataFrame(sensitivity)

# 8. Methodology roadmap
roadmap = pd.DataFrame([
    ["Normalization", "Compare min-max, z-score, percentile rank, robust scaling", "Required for V5"],
    ["Weight Optimization", "Evaluate equal weights, expert weights, PCA weights, regression-informed weights", "Required for V5"],
    ["Tier Calibration", "Use percentile bands and distribution diagnostics instead of arbitrary thresholds", "Required for V5"],
    ["Correlation Analysis", "Measure redundancy and independence across scoring domains", "Complete in this sprint"],
    ["Sensitivity Analysis", "Measure model dependence on each domain", "Complete in this sprint"],
    ["Explainability Validation", "Compare top score drivers against actual domain contribution", "Next sprint"],
    ["ML Roadmap", "Prepare supervised learning using CMS spend/utilization, FDA risk, CDC burden, and future claims outcomes", "Next sprint"],
], columns=["framework_area", "statistical_method", "status"])
roadmap["build_version"] = BUILD_VERSION
roadmap["build_timestamp"] = BUILD_TS

# Write SQLite tables
summary.to_sql("ehi_v5_statistical_input_summary_v1", conn, if_exists="replace", index=False)
coverage.to_sql("ehi_v5_input_coverage_v1", conn, if_exists="replace", index=False)
corr.to_sql("ehi_v5_pearson_correlation_matrix_v1", conn, if_exists="replace", index=False)
rank_corr.to_sql("ehi_v5_spearman_rank_correlation_matrix_v1", conn, if_exists="replace", index=False)
z.to_sql("ehi_v5_equal_weight_normalized_preview_v1", conn, if_exists="replace", index=False)
tier_counts.to_sql("ehi_v5_tier_calibration_preview_v1", conn, if_exists="replace", index=False)
sensitivity.to_sql("ehi_v5_domain_sensitivity_v1", conn, if_exists="replace", index=False)
roadmap.to_sql("ehi_v5_statistical_methodology_roadmap_v1", conn, if_exists="replace", index=False)

# Write files
summary.to_csv(OUTPUT_DIR / "ehi_v5_statistical_input_summary_v1.csv", index=False)
coverage.to_csv(OUTPUT_DIR / "ehi_v5_input_coverage_v1.csv", index=False)
corr.to_csv(OUTPUT_DIR / "ehi_v5_pearson_correlation_matrix_v1.csv", index=False)
rank_corr.to_csv(OUTPUT_DIR / "ehi_v5_spearman_rank_correlation_matrix_v1.csv", index=False)
z.to_csv(OUTPUT_DIR / "ehi_v5_equal_weight_normalized_preview_v1.csv", index=False)
tier_counts.to_csv(OUTPUT_DIR / "ehi_v5_tier_calibration_preview_v1.csv", index=False)
sensitivity.to_csv(OUTPUT_DIR / "ehi_v5_domain_sensitivity_v1.csv", index=False)
roadmap.to_csv(OUTPUT_DIR / "ehi_v5_statistical_methodology_roadmap_v1.csv", index=False)

with pd.ExcelWriter(OUTPUT_DIR / "ehi_v5_statistical_framework_v1.xlsx", engine="openpyxl") as writer:
    summary.to_excel(writer, sheet_name="Input Summary", index=False)
    coverage.to_excel(writer, sheet_name="Coverage", index=False)
    corr.to_excel(writer, sheet_name="Pearson Corr", index=False)
    rank_corr.to_excel(writer, sheet_name="Spearman Corr", index=False)
    tier_counts.to_excel(writer, sheet_name="Tier Preview", index=False)
    sensitivity.to_excel(writer, sheet_name="Sensitivity", index=False)
    roadmap.to_excel(writer, sheet_name="Roadmap", index=False)
    z.head(500).to_excel(writer, sheet_name="Normalized Preview Top500", index=False)

conn.commit()
conn.close()

print("=" * 80)
print("H3A.9 — EHI V5 Statistical Framework")
print("=" * 80)
print("Created tables:")
print("ehi_v5_statistical_input_summary_v1")
print("ehi_v5_input_coverage_v1")
print("ehi_v5_pearson_correlation_matrix_v1")
print("ehi_v5_spearman_rank_correlation_matrix_v1")
print("ehi_v5_equal_weight_normalized_preview_v1")
print("ehi_v5_tier_calibration_preview_v1")
print("ehi_v5_domain_sensitivity_v1")
print("ehi_v5_statistical_methodology_roadmap_v1")
print("-" * 80)
print(f"Output folder: {OUTPUT_DIR}")
print("H3A.9 complete.")
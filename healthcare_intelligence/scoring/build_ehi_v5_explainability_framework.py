import os
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("RXNORM_DB_PATH", PROJECT_ROOT / "database" / "rxnorm_research.db"))
OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "ehi_v5_explainability"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BUILD_VERSION = "H3A11_EHI_V5_EXPLAINABILITY_DRIVER_ATTRIBUTION_V1"
BUILD_TS = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

SOURCE_TABLE = "enterprise_healthcare_importance_master_v4_cdc"

WEIGHTS = {
    "utilization_score": 0.20,
    "spend_score": 0.15,
    "population_impact_score": 0.15,
    "disease_burden_score_v2": 0.20,
    "risk_score_v3_final_fda": 0.15,
    "cdc_burden_score": 0.10,
    "external_evidence_score_calibrated": 0.05,
}

LABELS = {
    "utilization_score": "Utilization",
    "spend_score": "Spend",
    "population_impact_score": "Population Impact",
    "disease_burden_score_v2": "Disease Burden",
    "risk_score_v3_final_fda": "FDA Risk",
    "cdc_burden_score": "CDC Mortality Burden",
    "external_evidence_score_calibrated": "External Evidence",
}

conn = sqlite3.connect(DB_PATH)

df = pd.read_sql_query(f"""
SELECT
    rxcui,
    drug_name,
    ehi_score_v4,
    ehi_rank_v4,
    ehi_v4_tier_label,
    utilization_score,
    spend_score,
    population_impact_score,
    disease_burden_score_v2,
    risk_score_v3_final_fda,
    cdc_burden_score,
    external_evidence_score_calibrated,
    has_cdc_burden_evidence,
    disease_domain,
    canonical_disease_name
FROM {SOURCE_TABLE}
""", conn)

score_cols = list(WEIGHTS.keys())

# Fill CDC burden carefully:
# If CDC burden is missing, use disease burden as a neutral imputation anchor.
df["cdc_burden_score_filled"] = df["cdc_burden_score"].fillna(df["disease_burden_score_v2"])

working_cols = score_cols.copy()
working_cols[working_cols.index("cdc_burden_score")] = "cdc_burden_score_filled"

# Normalize each domain using percentile rank for explainability.
expl = df[[
    "rxcui",
    "drug_name",
    "ehi_score_v4",
    "ehi_rank_v4",
    "ehi_v4_tier_label",
    "has_cdc_burden_evidence",
    "disease_domain",
    "canonical_disease_name",
]].copy()

# Prevent pivot/grouping from dropping non-CDC rows with null disease metadata.
expl["disease_domain"] = expl["disease_domain"].fillna("No CDC Disease Mapping")
expl["canonical_disease_name"] = expl["canonical_disease_name"].fillna("No CDC Disease Mapping")
expl["ehi_v4_tier_label"] = expl["ehi_v4_tier_label"].fillna("Unclassified")

for original_col, working_col in zip(score_cols, working_cols):
    percentile_col = original_col + "_percentile"
    contribution_col = original_col + "_weighted_contribution"
    expl[percentile_col] = df[working_col].rank(pct=True) * 100
    expl[contribution_col] = expl[percentile_col] * WEIGHTS[original_col]

contribution_cols = [c + "_weighted_contribution" for c in score_cols]
expl["ehi_v5_explainability_score"] = expl[contribution_cols].sum(axis=1)

# Driver attribution
driver_rows = []

for row in expl.itertuples(index=False):
    row_dict = row._asdict()
    contributions = []
    for col in score_cols:
        contributions.append({
            "rxcui": row_dict["rxcui"],
            "drug_name": row_dict["drug_name"],
            "domain": LABELS[col],
            "domain_key": col,
            "weight": WEIGHTS[col],
            "domain_percentile": row_dict[col + "_percentile"],
            "weighted_contribution": row_dict[col + "_weighted_contribution"],
            "ehi_v5_explainability_score": row_dict["ehi_v5_explainability_score"],
            "ehi_score_v4": row_dict["ehi_score_v4"],
            "ehi_rank_v4": row_dict["ehi_rank_v4"],
            "ehi_v4_tier_label": row_dict["ehi_v4_tier_label"],
            "has_cdc_burden_evidence": row_dict["has_cdc_burden_evidence"],
            "disease_domain": row_dict["disease_domain"],
            "canonical_disease_name": row_dict["canonical_disease_name"],
            "build_version": BUILD_VERSION,
            "build_timestamp": BUILD_TS,
        })
    contributions = sorted(contributions, key=lambda x: x["weighted_contribution"], reverse=True)

    for rank, item in enumerate(contributions, start=1):
        item["driver_rank"] = rank
        if rank <= 2:
            item["driver_type"] = "Top Driver"
        elif rank >= 6:
            item["driver_type"] = "Limiting Factor"
        else:
            item["driver_type"] = "Supporting Factor"
        driver_rows.append(item)

drivers = pd.DataFrame(driver_rows)

top_drivers = drivers[drivers["driver_rank"] <= 2].copy()
limiting_factors = drivers[drivers["driver_rank"] >= 6].copy()

# Summary per drug
summary = drivers.pivot_table(
    index=[
        "rxcui",
        "drug_name",
        "ehi_rank_v4",
        "ehi_score_v4",
        "ehi_v4_tier_label",
        "ehi_v5_explainability_score",
        "has_cdc_burden_evidence",
        "disease_domain",
        "canonical_disease_name",
    ],
    columns="driver_rank",
    values="domain",
    aggfunc="first",
).reset_index()

summary = summary.rename(columns={
    1: "primary_driver",
    2: "secondary_driver",
    6: "secondary_limiting_factor",
    7: "primary_limiting_factor",
})

for col in ["primary_driver", "secondary_driver", "secondary_limiting_factor", "primary_limiting_factor"]:
    if col not in summary.columns:
        summary[col] = None

summary["executive_explainability_narrative"] = summary.apply(
    lambda r: (
        f"{r['drug_name']} ranks #{int(r['ehi_rank_v4'])} in EHI V4. "
        f"Its strongest EHI V5 drivers are {r['primary_driver']} and {r['secondary_driver']}. "
        f"The main limiting factors are {r['primary_limiting_factor']} and {r['secondary_limiting_factor']}. "
        f"This attribution profile supports transparent review of why the medication scores highly or lower within the Healthcare Importance framework."
    ),
    axis=1,
)

summary["build_version"] = BUILD_VERSION
summary["build_timestamp"] = BUILD_TS

# Domain-level contribution diagnostics
domain_diagnostics = drivers.groupby(["domain", "domain_key", "weight"], as_index=False).agg(
    average_domain_percentile=("domain_percentile", "mean"),
    average_weighted_contribution=("weighted_contribution", "mean"),
    median_weighted_contribution=("weighted_contribution", "median"),
    top_driver_count=("driver_type", lambda s: int((s == "Top Driver").sum())),
    limiting_factor_count=("driver_type", lambda s: int((s == "Limiting Factor").sum())),
)

domain_diagnostics["top_driver_pct"] = round(
    domain_diagnostics["top_driver_count"] / len(df) * 100, 2
)
domain_diagnostics["limiting_factor_pct"] = round(
    domain_diagnostics["limiting_factor_count"] / len(df) * 100, 2
)
domain_diagnostics["build_version"] = BUILD_VERSION
domain_diagnostics["build_timestamp"] = BUILD_TS

# Sensitivity attribution using prior H3A.9 sensitivity table
try:
    sensitivity = pd.read_sql_query("""
    SELECT *
    FROM ehi_v5_domain_sensitivity_v1
    """, conn)

    sensitivity["domain"] = sensitivity["removed_domain"].map(LABELS).fillna(sensitivity["removed_domain"])
    sensitivity["sensitivity_importance"] = 1 - sensitivity["spearman_correlation_with_full_equal_weight_model"]
    sensitivity["build_version"] = BUILD_VERSION
    sensitivity["build_timestamp"] = BUILD_TS
except Exception:
    sensitivity = pd.DataFrame(columns=[
        "removed_domain",
        "spearman_correlation_with_full_equal_weight_model",
        "domain",
        "sensitivity_importance",
        "build_version",
        "build_timestamp",
    ])

# QA summary
qa = pd.DataFrame([
    {
        "qa_domain": "Contribution Math",
        "metric": "Total drugs explained",
        "value": len(summary),
        "expected": 30132,
        "status": "PASS" if len(summary) == 30132 else "FAIL",
    },
    {
        "qa_domain": "Driver Attribution",
        "metric": "Driver rows generated",
        "value": len(drivers),
        "expected": 30132 * len(score_cols),
        "status": "PASS" if len(drivers) == 30132 * len(score_cols) else "FAIL",
    },
    {
        "qa_domain": "Top Driver Identification",
        "metric": "Top driver rows generated",
        "value": len(top_drivers),
        "expected": 30132 * 2,
        "status": "PASS" if len(top_drivers) == 30132 * 2 else "FAIL",
    },
    {
        "qa_domain": "Limiting Factor Identification",
        "metric": "Limiting factor rows generated",
        "value": len(limiting_factors),
        "expected": 30132 * 2,
        "status": "PASS" if len(limiting_factors) == 30132 * 2 else "FAIL",
    },
    {
        "qa_domain": "Narrative Generation",
        "metric": "Executive narratives generated",
        "value": summary["executive_explainability_narrative"].notna().sum(),
        "expected": 30132,
        "status": "PASS" if summary["executive_explainability_narrative"].notna().sum() == 30132 else "FAIL",
    },
])

qa["build_version"] = BUILD_VERSION
qa["build_timestamp"] = BUILD_TS

# Write SQLite outputs
drivers.to_sql("ehi_v5_driver_attribution_detail_v1", conn, if_exists="replace", index=False)
top_drivers.to_sql("ehi_v5_top_driver_detail_v1", conn, if_exists="replace", index=False)
limiting_factors.to_sql("ehi_v5_limiting_factor_detail_v1", conn, if_exists="replace", index=False)
summary.to_sql("ehi_v5_explainability_summary_v1", conn, if_exists="replace", index=False)
domain_diagnostics.to_sql("ehi_v5_domain_contribution_diagnostics_v1", conn, if_exists="replace", index=False)
sensitivity.to_sql("ehi_v5_sensitivity_attribution_v1", conn, if_exists="replace", index=False)
qa.to_sql("ehi_v5_explainability_qa_summary_v1", conn, if_exists="replace", index=False)

# Write files
drivers.to_csv(OUTPUT_DIR / "ehi_v5_driver_attribution_detail_v1.csv", index=False)
top_drivers.to_csv(OUTPUT_DIR / "ehi_v5_top_driver_detail_v1.csv", index=False)
limiting_factors.to_csv(OUTPUT_DIR / "ehi_v5_limiting_factor_detail_v1.csv", index=False)
summary.to_csv(OUTPUT_DIR / "ehi_v5_explainability_summary_v1.csv", index=False)
domain_diagnostics.to_csv(OUTPUT_DIR / "ehi_v5_domain_contribution_diagnostics_v1.csv", index=False)
sensitivity.to_csv(OUTPUT_DIR / "ehi_v5_sensitivity_attribution_v1.csv", index=False)
qa.to_csv(OUTPUT_DIR / "ehi_v5_explainability_qa_summary_v1.csv", index=False)

with pd.ExcelWriter(OUTPUT_DIR / "ehi_v5_explainability_framework_v1.xlsx", engine="openpyxl") as writer:
    qa.to_excel(writer, sheet_name="QA Summary", index=False)
    domain_diagnostics.to_excel(writer, sheet_name="Domain Diagnostics", index=False)
    sensitivity.to_excel(writer, sheet_name="Sensitivity Attribution", index=False)
    summary.head(1000).to_excel(writer, sheet_name="Explainability Summary", index=False)
    drivers.head(5000).to_excel(writer, sheet_name="Driver Detail", index=False)
    top_drivers.head(5000).to_excel(writer, sheet_name="Top Drivers", index=False)
    limiting_factors.head(5000).to_excel(writer, sheet_name="Limiting Factors", index=False)

conn.commit()
conn.close()

print("=" * 80)
print("H3A.11 — EHI V5 Explainability Validation & Driver Attribution Framework")
print("=" * 80)
print("Created tables:")
print("ehi_v5_driver_attribution_detail_v1")
print("ehi_v5_top_driver_detail_v1")
print("ehi_v5_limiting_factor_detail_v1")
print("ehi_v5_explainability_summary_v1")
print("ehi_v5_domain_contribution_diagnostics_v1")
print("ehi_v5_sensitivity_attribution_v1")
print("ehi_v5_explainability_qa_summary_v1")
print("-" * 80)
print("QA Summary:")
print(qa.to_string(index=False))
print("-" * 80)
print(f"Output folder: {OUTPUT_DIR}")
print("H3A.11 complete.")
import sqlite3
from pathlib import Path

DB_PATH = Path("database/rxnorm_research.db")
SOURCE_TABLE = "enterprise_healthcare_importance_master_v4_cdc"

CANDIDATES = {
    "rxcui": ["rxcui", "RXCUI"],
    "drug_name": ["drug_name", "name", "medication_name", "ingredient_name"],
    "utilization_score": ["utilization_score", "utilization"],
    "spend_score": ["spend_score", "spend"],
    "population_impact_score": ["population_impact_score", "population_impact"],
    "risk_score": [
        "risk_score_v3_final_fda",
        "risk_v3_final_fda",
        "fda_risk_score",
        "fda_safety_score_final",
        "risk_score",
        "clinical_risk_score"
    ],
    "external_evidence_score": [
        "external_evidence_score_calibrated",
        "external_evidence_calibrated",
        "external_evidence_score"
    ],
    "disease_burden_score": ["disease_burden_score_v2", "disease_burden_score"],
    "cdc_burden_score": ["cdc_burden_score", "cdc_wonder_burden_score"],
}

def pick(columns, options, required=True):
    for option in options:
        if option in columns:
            return option
    if required:
        raise ValueError(f"Missing required column. Tried: {options}")
    return None

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

columns = [row[1] for row in cur.execute(f"PRAGMA table_info({SOURCE_TABLE})")]

selected = {
    key: pick(columns, options)
    for key, options in CANDIDATES.items()
}

cur.executescript("""
DROP TABLE IF EXISTS ehi_v6_weight_configuration_v1;

CREATE TABLE ehi_v6_weight_configuration_v1 (
    domain_name TEXT,
    weight REAL,
    rationale TEXT,
    methodology_version TEXT
);

INSERT INTO ehi_v6_weight_configuration_v1 VALUES
('utilization_score', 0.15, 'Operational prevalence across healthcare systems', 'EHI_V6_HYBRID_2026'),
('spend_score', 0.20, 'Enterprise cost impact for payers, PBMs, employers, and budgets', 'EHI_V6_HYBRID_2026'),
('population_impact_score', 0.15, 'Affected lives and population health relevance', 'EHI_V6_HYBRID_2026'),
('risk_score', 0.20, 'Clinical and regulatory risk importance', 'EHI_V6_HYBRID_2026'),
('external_evidence_score', 0.10, 'External literature and evidence validation', 'EHI_V6_HYBRID_2026'),
('disease_burden_score', 0.10, 'Disease-level epidemiologic burden', 'EHI_V6_HYBRID_2026'),
('cdc_burden_score', 0.10, 'CDC WONDER mortality burden', 'EHI_V6_HYBRID_2026');

DROP TABLE IF EXISTS enterprise_healthcare_importance_master_v6;
""")

create_sql = f"""
CREATE TABLE enterprise_healthcare_importance_master_v6 AS
SELECT
    {selected["rxcui"]} AS rxcui,
    {selected["drug_name"]} AS drug_name,

    {selected["utilization_score"]} AS utilization_score,
    {selected["spend_score"]} AS spend_score,
    {selected["population_impact_score"]} AS population_impact_score,
    {selected["risk_score"]} AS risk_score,
    {selected["external_evidence_score"]} AS external_evidence_score,
    {selected["disease_burden_score"]} AS disease_burden_score,
    {selected["cdc_burden_score"]} AS cdc_burden_score,

    ROUND(
        0.15 * COALESCE({selected["utilization_score"]}, 0) +
        0.20 * COALESCE({selected["spend_score"]}, 0) +
        0.15 * COALESCE({selected["population_impact_score"]}, 0) +
        0.20 * COALESCE({selected["risk_score"]}, 0) +
        0.10 * COALESCE({selected["external_evidence_score"]}, 0) +
        0.10 * COALESCE({selected["disease_burden_score"]}, 0) +
        0.10 * COALESCE({selected["cdc_burden_score"]}, 0),
        2
    ) AS ehi_v6_score,

    CASE
        WHEN (
            0.15 * COALESCE({selected["utilization_score"]}, 0) +
            0.20 * COALESCE({selected["spend_score"]}, 0) +
            0.15 * COALESCE({selected["population_impact_score"]}, 0) +
            0.20 * COALESCE({selected["risk_score"]}, 0) +
            0.10 * COALESCE({selected["external_evidence_score"]}, 0) +
            0.10 * COALESCE({selected["disease_burden_score"]}, 0) +
            0.10 * COALESCE({selected["cdc_burden_score"]}, 0)
        ) >= 90 THEN 'Strategic Priority'
        WHEN (
            0.15 * COALESCE({selected["utilization_score"]}, 0) +
            0.20 * COALESCE({selected["spend_score"]}, 0) +
            0.15 * COALESCE({selected["population_impact_score"]}, 0) +
            0.20 * COALESCE({selected["risk_score"]}, 0) +
            0.10 * COALESCE({selected["external_evidence_score"]}, 0) +
            0.10 * COALESCE({selected["disease_burden_score"]}, 0) +
            0.10 * COALESCE({selected["cdc_burden_score"]}, 0)
        ) >= 80 THEN 'Enterprise Critical'
        WHEN (
            0.15 * COALESCE({selected["utilization_score"]}, 0) +
            0.20 * COALESCE({selected["spend_score"]}, 0) +
            0.15 * COALESCE({selected["population_impact_score"]}, 0) +
            0.20 * COALESCE({selected["risk_score"]}, 0) +
            0.10 * COALESCE({selected["external_evidence_score"]}, 0) +
            0.10 * COALESCE({selected["disease_burden_score"]}, 0) +
            0.10 * COALESCE({selected["cdc_burden_score"]}, 0)
        ) >= 65 THEN 'High Importance'
        WHEN (
            0.15 * COALESCE({selected["utilization_score"]}, 0) +
            0.20 * COALESCE({selected["spend_score"]}, 0) +
            0.15 * COALESCE({selected["population_impact_score"]}, 0) +
            0.20 * COALESCE({selected["risk_score"]}, 0) +
            0.10 * COALESCE({selected["external_evidence_score"]}, 0) +
            0.10 * COALESCE({selected["disease_burden_score"]}, 0) +
            0.10 * COALESCE({selected["cdc_burden_score"]}, 0)
        ) >= 45 THEN 'Moderate Importance'
        ELSE 'Foundational'
    END AS ehi_v6_tier,

    'EHI_V6_HYBRID_2026' AS methodology_version,
    CURRENT_TIMESTAMP AS created_at

FROM {SOURCE_TABLE};
"""

cur.execute(create_sql)

cur.executescript("""
DROP TABLE IF EXISTS ehi_v6_score_distribution_v1;

CREATE TABLE ehi_v6_score_distribution_v1 AS
SELECT
    COUNT(*) AS row_count,
    MIN(ehi_v6_score) AS min_score,
    MAX(ehi_v6_score) AS max_score,
    ROUND(AVG(ehi_v6_score), 2) AS mean_score
FROM enterprise_healthcare_importance_master_v6;

DROP TABLE IF EXISTS ehi_v6_tier_distribution_v1;

CREATE TABLE ehi_v6_tier_distribution_v1 AS
SELECT
    ehi_v6_tier,
    COUNT(*) AS medication_count,
    ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM enterprise_healthcare_importance_master_v6), 2) AS percentage
FROM enterprise_healthcare_importance_master_v6
GROUP BY ehi_v6_tier
ORDER BY medication_count DESC;

DROP TABLE IF EXISTS ehi_v6_top100_rankings_v1;

CREATE TABLE ehi_v6_top100_rankings_v1 AS
SELECT
    ROW_NUMBER() OVER (ORDER BY ehi_v6_score DESC, drug_name ASC) AS ehi_v6_rank,
    rxcui,
    drug_name,
    ehi_v6_score,
    ehi_v6_tier,
    methodology_version
FROM enterprise_healthcare_importance_master_v6
ORDER BY ehi_v6_score DESC, drug_name ASC
LIMIT 100;
""")

conn.commit()

print("H3A.11 EHI V6 build complete.")
print("Source column mapping:")
for k, v in selected.items():
    print(f"{k}: {v}")

conn.close()
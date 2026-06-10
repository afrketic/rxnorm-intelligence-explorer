DROP TABLE IF EXISTS ehi_v6_weight_configuration_v1;

CREATE TABLE ehi_v6_weight_configuration_v1 AS
SELECT 'utilization_score' AS domain_name, 0.15 AS weight, 'Operational prevalence across healthcare systems' AS rationale, 'EHI_V6_HYBRID_2026' AS methodology_version
UNION ALL SELECT 'spend_score', 0.20, 'Enterprise cost impact for payers, PBMs, employers, and budgets', 'EHI_V6_HYBRID_2026'
UNION ALL SELECT 'population_impact_score', 0.15, 'Affected lives and population health relevance', 'EHI_V6_HYBRID_2026'
UNION ALL SELECT 'risk_v3_final_fda', 0.20, 'Clinical and regulatory risk importance', 'EHI_V6_HYBRID_2026'
UNION ALL SELECT 'external_evidence_calibrated', 0.10, 'External literature and evidence validation', 'EHI_V6_HYBRID_2026'
UNION ALL SELECT 'disease_burden_score_v2', 0.10, 'Disease-level epidemiologic burden', 'EHI_V6_HYBRID_2026'
UNION ALL SELECT 'cdc_burden_score', 0.10, 'CDC WONDER mortality burden', 'EHI_V6_HYBRID_2026';


DROP TABLE IF EXISTS enterprise_healthcare_importance_master_v6;

CREATE TABLE enterprise_healthcare_importance_master_v6 AS
SELECT
    rxcui,
    drug_name,

    utilization_score,
    spend_score,
    population_impact_score,
    risk_v3_final_fda,
    external_evidence_calibrated,
    disease_burden_score_v2,
    cdc_burden_score,

    ROUND(
        0.15 * COALESCE(utilization_score, 0) +
        0.20 * COALESCE(spend_score, 0) +
        0.15 * COALESCE(population_impact_score, 0) +
        0.20 * COALESCE(risk_v3_final_fda, 0) +
        0.10 * COALESCE(external_evidence_calibrated, 0) +
        0.10 * COALESCE(disease_burden_score_v2, 0) +
        0.10 * COALESCE(cdc_burden_score, 0),
        2
    ) AS ehi_v6_score,

    CASE
        WHEN (
            0.15 * COALESCE(utilization_score, 0) +
            0.20 * COALESCE(spend_score, 0) +
            0.15 * COALESCE(population_impact_score, 0) +
            0.20 * COALESCE(risk_v3_final_fda, 0) +
            0.10 * COALESCE(external_evidence_calibrated, 0) +
            0.10 * COALESCE(disease_burden_score_v2, 0) +
            0.10 * COALESCE(cdc_burden_score, 0)
        ) >= 90 THEN 'Strategic Priority'
        WHEN (
            0.15 * COALESCE(utilization_score, 0) +
            0.20 * COALESCE(spend_score, 0) +
            0.15 * COALESCE(population_impact_score, 0) +
            0.20 * COALESCE(risk_v3_final_fda, 0) +
            0.10 * COALESCE(external_evidence_calibrated, 0) +
            0.10 * COALESCE(disease_burden_score_v2, 0) +
            0.10 * COALESCE(cdc_burden_score, 0)
        ) >= 80 THEN 'Enterprise Critical'
        WHEN (
            0.15 * COALESCE(utilization_score, 0) +
            0.20 * COALESCE(spend_score, 0) +
            0.15 * COALESCE(population_impact_score, 0) +
            0.20 * COALESCE(risk_v3_final_fda, 0) +
            0.10 * COALESCE(external_evidence_calibrated, 0) +
            0.10 * COALESCE(disease_burden_score_v2, 0) +
            0.10 * COALESCE(cdc_burden_score, 0)
        ) >= 65 THEN 'High Importance'
        WHEN (
            0.15 * COALESCE(utilization_score, 0) +
            0.20 * COALESCE(spend_score, 0) +
            0.15 * COALESCE(population_impact_score, 0) +
            0.20 * COALESCE(risk_v3_final_fda, 0) +
            0.10 * COALESCE(external_evidence_calibrated, 0) +
            0.10 * COALESCE(disease_burden_score_v2, 0) +
            0.10 * COALESCE(cdc_burden_score, 0)
        ) >= 45 THEN 'Moderate Importance'
        ELSE 'Foundational'
    END AS ehi_v6_tier,

    'EHI_V6_HYBRID_2026' AS methodology_version,
    CURRENT_TIMESTAMP AS created_at

FROM enterprise_healthcare_importance_master_v4_cdc;


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
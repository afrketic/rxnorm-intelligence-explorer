DROP TABLE IF EXISTS ehi_v6_therapeutic_portfolios_v1;

CREATE TABLE ehi_v6_therapeutic_portfolios_v1 AS
SELECT
    primary_therapeutic_domain_code,
    primary_therapeutic_domain_name,
    COUNT(DISTINCT rxcui) AS medication_count,
    ROUND(AVG(ehi_v6_score), 2) AS average_ehi_v6_score,
    ROUND(MAX(ehi_v6_score), 2) AS max_ehi_v6_score,
    SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) AS enterprise_critical_count,
    SUM(CASE WHEN ehi_v6_tier = 'Strategic Priority' THEN 1 ELSE 0 END) AS strategic_priority_count,
    ROUND(
        AVG(ehi_v6_score) * 0.60 +
        MAX(ehi_v6_score) * 0.25 +
        SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) * 0.15,
        2
    ) AS portfolio_importance_score,
    DENSE_RANK() OVER (
        ORDER BY
            ROUND(
                AVG(ehi_v6_score) * 0.60 +
                MAX(ehi_v6_score) * 0.25 +
                SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) * 0.15,
                2
            ) DESC,
            primary_therapeutic_domain_name ASC
    ) AS portfolio_rank,
    'H3B.3A_EHI_V6_PORTFOLIO_INTELLIGENCE' AS portfolio_version
FROM ehi_v6_therapeutic_benchmarks_v1
GROUP BY
    primary_therapeutic_domain_code,
    primary_therapeutic_domain_name;


DROP TABLE IF EXISTS ehi_v6_atc_portfolios_v1;

CREATE TABLE ehi_v6_atc_portfolios_v1 AS
SELECT
    atc_level,
    atc_code,
    atc_name,
    COUNT(DISTINCT rxcui) AS medication_count,
    ROUND(AVG(ehi_v6_score), 2) AS average_ehi_v6_score,
    ROUND(MAX(ehi_v6_score), 2) AS max_ehi_v6_score,
    SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) AS enterprise_critical_count,
    SUM(CASE WHEN ehi_v6_tier = 'Strategic Priority' THEN 1 ELSE 0 END) AS strategic_priority_count,
    ROUND(
        AVG(ehi_v6_score) * 0.60 +
        MAX(ehi_v6_score) * 0.25 +
        SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) * 0.15,
        2
    ) AS portfolio_importance_score,
    DENSE_RANK() OVER (
        PARTITION BY atc_level
        ORDER BY
            ROUND(
                AVG(ehi_v6_score) * 0.60 +
                MAX(ehi_v6_score) * 0.25 +
                SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) * 0.15,
                2
            ) DESC,
            atc_name ASC
    ) AS portfolio_rank,
    'H3B.3A_EHI_V6_PORTFOLIO_INTELLIGENCE' AS portfolio_version
FROM ehi_v6_atc_benchmarks_v1
GROUP BY
    atc_level,
    atc_code,
    atc_name;


DROP TABLE IF EXISTS ehi_v6_disease_portfolios_v1;

CREATE TABLE ehi_v6_disease_portfolios_v1 AS
SELECT
    disease_name,
    COUNT(DISTINCT rxcui) AS medication_count,
    ROUND(AVG(ehi_v6_score), 2) AS average_ehi_v6_score,
    ROUND(MAX(ehi_v6_score), 2) AS max_ehi_v6_score,
    SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) AS enterprise_critical_count,
    SUM(CASE WHEN ehi_v6_tier = 'Strategic Priority' THEN 1 ELSE 0 END) AS strategic_priority_count,
    ROUND(
        AVG(ehi_v6_score) * 0.60 +
        MAX(ehi_v6_score) * 0.25 +
        SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) * 0.15,
        2
    ) AS portfolio_importance_score,
    DENSE_RANK() OVER (
        ORDER BY
            ROUND(
                AVG(ehi_v6_score) * 0.60 +
                MAX(ehi_v6_score) * 0.25 +
                SUM(CASE WHEN ehi_v6_tier = 'Enterprise Critical' THEN 1 ELSE 0 END) * 0.15,
                2
            ) DESC,
            disease_name ASC
    ) AS portfolio_rank,
    'H3B.3A_EHI_V6_PORTFOLIO_INTELLIGENCE' AS portfolio_version
FROM ehi_v6_disease_benchmarks_executive_v1
GROUP BY disease_name;


DROP TABLE IF EXISTS ehi_v6_portfolio_top_opportunities_v1;

CREATE TABLE ehi_v6_portfolio_top_opportunities_v1 AS
SELECT
    'Therapeutic Domain' AS portfolio_type,
    primary_therapeutic_domain_code AS portfolio_code,
    primary_therapeutic_domain_name AS portfolio_name,
    medication_count,
    average_ehi_v6_score,
    max_ehi_v6_score,
    enterprise_critical_count,
    strategic_priority_count,
    portfolio_importance_score,
    portfolio_rank,
    portfolio_version
FROM ehi_v6_therapeutic_portfolios_v1

UNION ALL

SELECT
    atc_level AS portfolio_type,
    atc_code AS portfolio_code,
    atc_name AS portfolio_name,
    medication_count,
    average_ehi_v6_score,
    max_ehi_v6_score,
    enterprise_critical_count,
    strategic_priority_count,
    portfolio_importance_score,
    portfolio_rank,
    portfolio_version
FROM ehi_v6_atc_portfolios_v1

UNION ALL

SELECT
    'Disease Area' AS portfolio_type,
    NULL AS portfolio_code,
    disease_name AS portfolio_name,
    medication_count,
    average_ehi_v6_score,
    max_ehi_v6_score,
    enterprise_critical_count,
    strategic_priority_count,
    portfolio_importance_score,
    portfolio_rank,
    portfolio_version
FROM ehi_v6_disease_portfolios_v1;
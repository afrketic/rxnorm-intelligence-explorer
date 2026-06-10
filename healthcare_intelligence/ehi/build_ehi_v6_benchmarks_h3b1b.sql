DROP TABLE IF EXISTS ehi_v6_enterprise_percentiles_v1;

CREATE TABLE ehi_v6_enterprise_percentiles_v1 AS
WITH ranked AS (
    SELECT
        rxcui,
        drug_name,
        ehi_v6_score,
        ehi_v6_tier,
        methodology_version,
        DENSE_RANK() OVER (
            ORDER BY ehi_v6_score DESC, drug_name ASC, rxcui ASC
        ) AS overall_rank,
        COUNT(*) OVER () AS overall_population
    FROM enterprise_healthcare_importance_master_v6
)
SELECT
    *,
    ROUND((CAST(overall_rank AS REAL) / overall_population) * 100, 4) AS overall_top_share_pct,
    'Top ' || ROUND((CAST(overall_rank AS REAL) / overall_population) * 100, 2) || '% of evaluated medications' AS overall_benchmark_label
FROM ranked;


DROP TABLE IF EXISTS ehi_v6_therapeutic_benchmarks_v1;

CREATE TABLE ehi_v6_therapeutic_benchmarks_v1 AS
WITH atc1 AS (
    SELECT
        CAST(rxcui AS TEXT) AS rxcui,
        class_id AS primary_therapeutic_domain_code,
        class_name AS primary_therapeutic_domain_name,
        ROW_NUMBER() OVER (
            PARTITION BY CAST(rxcui AS TEXT)
            ORDER BY class_id ASC, class_name ASC
        ) AS rn
    FROM research_classification_detail
    WHERE class_type = 'ATC1'
),
base AS (
    SELECT
        e.rxcui,
        e.drug_name,
        e.ehi_v6_score,
        e.ehi_v6_tier,
        e.methodology_version,
        COALESCE(a.primary_therapeutic_domain_code, 'UNMAPPED') AS primary_therapeutic_domain_code,
        COALESCE(a.primary_therapeutic_domain_name, 'Unmapped Therapeutic Domain') AS primary_therapeutic_domain_name
    FROM enterprise_healthcare_importance_master_v6 e
    LEFT JOIN atc1 a
        ON CAST(e.rxcui AS TEXT) = CAST(a.rxcui AS TEXT)
       AND a.rn = 1
),
ranked AS (
    SELECT
        *,
        DENSE_RANK() OVER (
            PARTITION BY primary_therapeutic_domain_code
            ORDER BY ehi_v6_score DESC, drug_name ASC, rxcui ASC
        ) AS therapeutic_rank,
        COUNT(*) OVER (
            PARTITION BY primary_therapeutic_domain_code
        ) AS therapeutic_population
    FROM base
)
SELECT
    *,
    ROUND((CAST(therapeutic_rank AS REAL) / therapeutic_population) * 100, 4) AS therapeutic_top_share_pct,
    '#' || therapeutic_rank || ' of ' || therapeutic_population || ' in ' || primary_therapeutic_domain_name AS therapeutic_benchmark_label
FROM ranked;


DROP TABLE IF EXISTS ehi_v6_atc_benchmarks_v1;

CREATE TABLE ehi_v6_atc_benchmarks_v1 AS
WITH atc AS (
    SELECT DISTINCT
        CAST(rxcui AS TEXT) AS rxcui,
        class_type AS atc_level,
        class_id AS atc_code,
        class_name AS atc_name
    FROM research_classification_detail
    WHERE class_type IN ('ATC1', 'ATC2', 'ATC3', 'ATC4')
      AND class_id IS NOT NULL
      AND TRIM(class_id) <> ''
),
base AS (
    SELECT
        e.rxcui,
        e.drug_name,
        e.ehi_v6_score,
        e.ehi_v6_tier,
        e.methodology_version,
        a.atc_level,
        a.atc_code,
        COALESCE(a.atc_name, a.atc_code) AS atc_name
    FROM enterprise_healthcare_importance_master_v6 e
    INNER JOIN atc a
        ON CAST(e.rxcui AS TEXT) = CAST(a.rxcui AS TEXT)
),
ranked AS (
    SELECT
        *,
        DENSE_RANK() OVER (
            PARTITION BY atc_level, atc_code
            ORDER BY ehi_v6_score DESC, drug_name ASC, rxcui ASC
        ) AS atc_rank,
        COUNT(*) OVER (
            PARTITION BY atc_level, atc_code
        ) AS atc_population
    FROM base
)
SELECT
    *,
    ROUND((CAST(atc_rank AS REAL) / atc_population) * 100, 4) AS atc_top_share_pct,
    '#' || atc_rank || ' of ' || atc_population || ' in ' || atc_name AS atc_benchmark_label
FROM ranked;


DROP TABLE IF EXISTS ehi_v6_disease_benchmarks_v1;

CREATE TABLE ehi_v6_disease_benchmarks_v1 AS
WITH disease AS (
    SELECT DISTINCT
        CAST(rxcui AS TEXT) AS rxcui,
        class_id AS disease_code,
        class_name AS disease_name
    FROM research_classification_detail
    WHERE class_type = 'DISEASE'
      AND class_id IS NOT NULL
      AND TRIM(class_id) <> ''
),
base AS (
    SELECT
        e.rxcui,
        e.drug_name,
        e.ehi_v6_score,
        e.ehi_v6_tier,
        e.methodology_version,
        d.disease_code,
        COALESCE(d.disease_name, d.disease_code) AS disease_name
    FROM enterprise_healthcare_importance_master_v6 e
    INNER JOIN disease d
        ON CAST(e.rxcui AS TEXT) = CAST(d.rxcui AS TEXT)
),
ranked AS (
    SELECT
        *,
        DENSE_RANK() OVER (
            PARTITION BY disease_code
            ORDER BY ehi_v6_score DESC, drug_name ASC, rxcui ASC
        ) AS disease_rank,
        COUNT(*) OVER (
            PARTITION BY disease_code
        ) AS disease_population
    FROM base
)
SELECT
    *,
    ROUND((CAST(disease_rank AS REAL) / disease_population) * 100, 4) AS disease_top_share_pct,
    '#' || disease_rank || ' of ' || disease_population || ' in ' || disease_name AS disease_benchmark_label
FROM ranked;
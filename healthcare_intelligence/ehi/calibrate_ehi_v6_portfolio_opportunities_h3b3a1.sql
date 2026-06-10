DROP TABLE IF EXISTS ehi_v6_portfolio_top_opportunities_executive_v1;

CREATE TABLE ehi_v6_portfolio_top_opportunities_executive_v1 AS
WITH filtered AS (
    SELECT *
    FROM ehi_v6_portfolio_top_opportunities_v1
    WHERE
        portfolio_type = 'Therapeutic Domain'

        OR (
            portfolio_type = 'ATC2'
            AND medication_count >= 25
        )

        OR (
            portfolio_type = 'ATC3'
            AND medication_count >= 10
        )

        OR (
            portfolio_type = 'ATC4'
            AND medication_count >= 10
        )

        OR (
            portfolio_type = 'Disease Area'
            AND medication_count >= 25
        )
),
ranked AS (
    SELECT
        *,
        DENSE_RANK() OVER (
            ORDER BY portfolio_importance_score DESC, portfolio_name ASC
        ) AS executive_opportunity_rank
    FROM filtered
)
SELECT
    portfolio_type,
    portfolio_code,
    portfolio_name,
    medication_count,
    average_ehi_v6_score,
    max_ehi_v6_score,
    enterprise_critical_count,
    strategic_priority_count,
    portfolio_importance_score,
    portfolio_rank AS source_portfolio_rank,
    executive_opportunity_rank,
    portfolio_version,
    'H3B.3A.1_EXECUTIVE_PORTFOLIO_CALIBRATION' AS calibration_version,
    CASE
        WHEN portfolio_type = 'Therapeutic Domain' THEN 'Full therapeutic domain portfolio'
        WHEN portfolio_type = 'ATC2' THEN 'Executive-valid ATC2 portfolio with at least 25 medications'
        WHEN portfolio_type = 'ATC3' THEN 'Executive-valid ATC3 portfolio with at least 10 medications'
        WHEN portfolio_type = 'ATC4' THEN 'Executive-valid ATC4 portfolio with at least 10 medications'
        WHEN portfolio_type = 'Disease Area' THEN 'Executive-valid disease portfolio with at least 25 medications'
        ELSE 'Executive-valid portfolio'
    END AS calibration_rule
FROM ranked;
DROP TABLE IF EXISTS ehi_v6_portfolio_maturity_scores_v1;

CREATE TABLE ehi_v6_portfolio_maturity_scores_v1 AS
WITH base AS (
    SELECT
        *,
        CASE
            WHEN medication_count >= 1000 THEN 100
            WHEN medication_count >= 500 THEN 90
            WHEN medication_count >= 250 THEN 80
            WHEN medication_count >= 100 THEN 70
            WHEN medication_count >= 50 THEN 60
            WHEN medication_count >= 25 THEN 50
            WHEN medication_count >= 10 THEN 40
            ELSE 25
        END AS population_maturity_score,

        CASE
            WHEN enterprise_critical_count >= 25 THEN 100
            WHEN enterprise_critical_count >= 15 THEN 90
            WHEN enterprise_critical_count >= 10 THEN 80
            WHEN enterprise_critical_count >= 5 THEN 70
            WHEN enterprise_critical_count >= 3 THEN 60
            WHEN enterprise_critical_count >= 1 THEN 45
            ELSE 25
        END AS critical_mass_maturity_score,

        CASE
            WHEN average_ehi_v6_score >= 70 THEN 90
            WHEN average_ehi_v6_score >= 65 THEN 80
            WHEN average_ehi_v6_score >= 60 THEN 70
            WHEN average_ehi_v6_score >= 55 THEN 60
            WHEN average_ehi_v6_score >= 50 THEN 50
            ELSE 40
        END AS average_strength_maturity_score
    FROM ehi_v6_portfolio_top_opportunities_executive_v1
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
    executive_opportunity_rank,

    population_maturity_score,
    critical_mass_maturity_score,
    average_strength_maturity_score,

    ROUND(
        population_maturity_score * 0.35 +
        critical_mass_maturity_score * 0.35 +
        average_strength_maturity_score * 0.30,
        2
    ) AS portfolio_maturity_score,

    'H3B.4A_PORTFOLIO_MATURITY_SCORE' AS maturity_version
FROM base;


DROP TABLE IF EXISTS ehi_v6_portfolio_opportunity_scores_v1;

CREATE TABLE ehi_v6_portfolio_opportunity_scores_v1 AS
WITH scored AS (
    SELECT
        *,
        ROUND(portfolio_importance_score, 2) AS normalized_importance_score,

        ROUND(
            (
                portfolio_importance_score * 0.55
            ) +
            (
                (100 - portfolio_maturity_score) * 0.45
            ),
            2
        ) AS enterprise_opportunity_score
    FROM ehi_v6_portfolio_maturity_scores_v1
),
ranked AS (
    SELECT
        *,
        DENSE_RANK() OVER (
            ORDER BY enterprise_opportunity_score DESC, portfolio_name ASC
        ) AS enterprise_opportunity_rank
    FROM scored
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
    normalized_importance_score,
    portfolio_maturity_score,
    enterprise_opportunity_score,

    executive_opportunity_rank,
    enterprise_opportunity_rank,

    CASE
        WHEN enterprise_opportunity_score >= 70 THEN 'High Growth Opportunity'
        WHEN enterprise_opportunity_score >= 60 THEN 'Strategic Opportunity'
        WHEN enterprise_opportunity_score >= 50 THEN 'Selective Opportunity'
        WHEN enterprise_opportunity_score >= 40 THEN 'Monitor'
        ELSE 'Mature / Lower Upside'
    END AS opportunity_tier,

    CASE
        WHEN portfolio_importance_score >= 60 AND portfolio_maturity_score < 50 THEN 'High importance with underdeveloped portfolio maturity'
        WHEN portfolio_importance_score >= 60 AND portfolio_maturity_score >= 70 THEN 'High importance but relatively mature portfolio'
        WHEN portfolio_importance_score < 55 AND portfolio_maturity_score < 50 THEN 'Lower current importance but potential emerging area'
        ELSE 'Balanced opportunity profile'
    END AS opportunity_interpretation,

    'H3B.4A_ENTERPRISE_OPPORTUNITY_SCORE' AS opportunity_version
FROM ranked;


DROP TABLE IF EXISTS ehi_v6_enterprise_opportunities_v1;

CREATE TABLE ehi_v6_enterprise_opportunities_v1 AS
SELECT
    *,
    CASE
        WHEN opportunity_tier IN ('High Growth Opportunity', 'Strategic Opportunity')
            THEN 'Prioritize for executive review'
        WHEN opportunity_tier = 'Selective Opportunity'
            THEN 'Evaluate selectively for claims, AI, or portfolio strategy'
        WHEN opportunity_tier = 'Monitor'
            THEN 'Monitor for future signal growth'
        ELSE 'Maintain awareness; lower near-term upside'
    END AS recommended_action,

    CASE
        WHEN portfolio_type IN ('ATC4', 'ATC3') THEN 'Best AI Deployment Target'
        WHEN portfolio_type = 'Disease Area' THEN 'Best Disease Portfolio Target'
        WHEN portfolio_type = 'Therapeutic Domain' THEN 'Best Enterprise Strategy Target'
        ELSE 'Portfolio Opportunity Target'
    END AS opportunity_use_case
FROM ehi_v6_portfolio_opportunity_scores_v1;
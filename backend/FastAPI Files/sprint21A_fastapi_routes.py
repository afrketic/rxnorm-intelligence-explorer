"""
Sprint 21A — FastAPI explainability route additions

Paste below Sprint 20B executive leaderboard routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/explainability/{rxcui}", tags=["Explainability"])
def get_drug_explainability(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "drug_explainability_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM drug_explainability_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No explainability profile found for RxCUI {rxcui}")

        reason_rows = conn.execute(
            """
            SELECT *
            FROM explainability_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY
                CASE WHEN reason_direction = 'positive' THEN 0 ELSE 1 END,
                reason_score DESC
            """,
            (str(rxcui),),
        ).fetchall()

        tier_rows = conn.execute(
            """
            SELECT *
            FROM explainability_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "explainability": {
            "explainability_score": item.get("explainability_score"),
            "explainability_tier": item.get("explainability_tier"),
            "positive_driver_count": item.get("positive_driver_count"),
            "limiting_factor_count": item.get("limiting_factor_count"),
            "executive_narrative": item.get("executive_narrative"),
            "recommended_action": item.get("recommended_action"),
        },
        "scores": {
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "confidence_score": item.get("confidence_score"),
            "consensus_score": item.get("consensus_score"),
            "pca_score": item.get("pca_score"),
            "overall_intelligence_score": item.get("overall_intelligence_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
            "risk_score": item.get("risk_score"),
        },
        "reasons": rows_to_dicts(reason_rows),
        "tier_distribution": rows_to_dicts(tier_rows),
        "methodology": {
            "explainability_version": item.get("explainability_version"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/explainability/{rxcui}/reasons", tags=["Explainability"])
def get_drug_explainability_reasons(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "explainability_reason_codes_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM explainability_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY
                CASE WHEN reason_direction = 'positive' THEN 0 ELSE 1 END,
                reason_score DESC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/explainability/distribution/tiers", tags=["Explainability"])
def get_explainability_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "explainability_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM explainability_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

"""
Sprint 21B — FastAPI executive recommendation route additions

Paste below Sprint 21A explainability routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/recommendations/{rxcui}", tags=["Executive Recommendations"])
def get_executive_recommendation(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No executive recommendation found for RxCUI {rxcui}")

        use_case_rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_use_cases_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY use_case_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        audience_rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_audiences_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY audience_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "recommendation": {
            "executive_recommendation_rank": item.get("executive_recommendation_rank"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "executive_recommendation_percentile": item.get("executive_recommendation_percentile"),
            "business_impact_tier": item.get("business_impact_tier"),
            "recommendation_priority": item.get("recommendation_priority"),
            "primary_recommended_use_case": item.get("primary_recommended_use_case"),
            "primary_recommended_audience": item.get("primary_recommended_audience"),
            "recommended_action_plan": item.get("recommended_action_plan"),
        },
        "scores": {
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "confidence_score": item.get("confidence_score"),
            "consensus_score": item.get("consensus_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "explainability_score": item.get("explainability_score"),
            "risk_score": item.get("risk_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
        },
        "use_cases": rows_to_dicts(use_case_rows),
        "audiences": rows_to_dicts(audience_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "recommendation_version": item.get("recommendation_version"),
            "recommendation_methodology": item.get("recommendation_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/recommendations/{rxcui}/use-cases", tags=["Executive Recommendations"])
def get_executive_recommendation_use_cases(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_use_cases_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_use_cases_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY use_case_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/recommendations/{rxcui}/audiences", tags=["Executive Recommendations"])
def get_executive_recommendation_audiences(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_audiences_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_audiences_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY audience_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/recommendations/distribution/impact", tags=["Executive Recommendations"])
def get_executive_recommendation_distribution():
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/recommendations/top", tags=["Executive Recommendations"])
def get_top_executive_recommendations(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "executive_recommendation_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_recommendation_master_v1
            ORDER BY executive_recommendation_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)

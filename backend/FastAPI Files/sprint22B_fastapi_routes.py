"""
Sprint 22B — FastAPI portfolio optimization route additions

Paste below Sprint 22A strategic opportunity routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/portfolio-optimization/{rxcui}", tags=["Portfolio Optimization"])
def get_portfolio_optimization(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No portfolio optimization profile found for RxCUI {rxcui}")

        action_rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        segment_rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_segments_v1
            """
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_distribution_v1
            ORDER BY action_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "optimization": {
            "portfolio_optimization_rank": item.get("portfolio_optimization_rank"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "portfolio_optimization_percentile": item.get("portfolio_optimization_percentile"),
            "portfolio_segment": item.get("portfolio_segment"),
            "primary_optimization_action": item.get("primary_optimization_action"),
            "investment_priority": item.get("investment_priority"),
            "optimization_action_plan": item.get("optimization_action_plan"),
        },
        "scores": {
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "explainability_score": item.get("explainability_score"),
            "confidence_score": item.get("confidence_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "risk_score": item.get("risk_score"),
        },
        "actions": rows_to_dicts(action_rows),
        "segments": rows_to_dicts(segment_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "optimization_version": item.get("optimization_version"),
            "optimization_methodology": item.get("optimization_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/portfolio-optimization/{rxcui}/actions", tags=["Portfolio Optimization"])
def get_portfolio_optimization_actions(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_actions_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/portfolio-optimization/top", tags=["Portfolio Optimization"])
def get_top_portfolio_optimization(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_master_v1
            ORDER BY portfolio_optimization_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/portfolio-optimization/distribution/actions", tags=["Portfolio Optimization"])
def get_portfolio_optimization_distribution():
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_distribution_v1
            ORDER BY action_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/portfolio-optimization/segments", tags=["Portfolio Optimization"])
def get_portfolio_optimization_segments():
    with get_connection() as conn:
        validate_table(conn, "portfolio_optimization_segments_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM portfolio_optimization_segments_v1
            ORDER BY avg_portfolio_optimization_score DESC
            """
        ).fetchall()

    return rows_to_dicts(rows)

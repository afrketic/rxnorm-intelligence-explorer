"""
Sprint 22A — FastAPI strategic opportunity route additions

Paste below Sprint 21B recommendation routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/opportunities/{rxcui}", tags=["Strategic Opportunities"])
def get_strategic_opportunity(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No strategic opportunity found for RxCUI {rxcui}")

        driver_rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_drivers_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY driver_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "opportunity": {
            "strategic_opportunity_rank": item.get("strategic_opportunity_rank"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "strategic_opportunity_percentile": item.get("strategic_opportunity_percentile"),
            "strategic_opportunity_tier": item.get("strategic_opportunity_tier"),
            "strategic_opportunity_type": item.get("strategic_opportunity_type"),
            "market_position": item.get("market_position"),
            "strategic_action_plan": item.get("strategic_action_plan"),
        },
        "scores": {
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "confidence_score": item.get("confidence_score"),
            "explainability_score": item.get("explainability_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "consensus_score": item.get("consensus_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
            "risk_score": item.get("risk_score"),
        },
        "leaderboard": {
            "leaderboard_appearance_count": item.get("leaderboard_appearance_count"),
            "best_leaderboard_rank": item.get("best_leaderboard_rank"),
        },
        "drivers": rows_to_dicts(driver_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "opportunity_version": item.get("opportunity_version"),
            "opportunity_methodology": item.get("opportunity_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/opportunities/{rxcui}/drivers", tags=["Strategic Opportunities"])
def get_strategic_opportunity_drivers(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_drivers_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_drivers_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY driver_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/opportunities/top", tags=["Strategic Opportunities"])
def get_top_strategic_opportunities(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_master_v1
            ORDER BY strategic_opportunity_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/opportunities/distribution/tiers", tags=["Strategic Opportunities"])
def get_strategic_opportunity_distribution():
    with get_connection() as conn:
        validate_table(conn, "strategic_opportunity_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM strategic_opportunity_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

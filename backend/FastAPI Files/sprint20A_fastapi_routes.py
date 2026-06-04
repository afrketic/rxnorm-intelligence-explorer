"""
Sprint 20A — FastAPI executive portfolio route additions

Paste below Sprint 19B production candidate routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
"""


@app.get("/executive/{rxcui}", tags=["Executive Portfolio"])
def get_executive_portfolio(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "executive_portfolio_rankings_v1")

        row = conn.execute(
            """
            SELECT *
            FROM executive_portfolio_rankings_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No executive portfolio ranking found for RxCUI {rxcui}")

        tier_rows = conn.execute(
            """
            SELECT *
            FROM executive_portfolio_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "executive": {
            "executive_rank": item.get("executive_rank"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "executive_percentile": item.get("executive_percentile"),
            "executive_tier": item.get("executive_tier"),
            "executive_interpretation": item.get("executive_interpretation"),
        },
        "scores": {
            "production_candidate_score": item.get("production_candidate_score"),
            "deployment_priority_score": item.get("deployment_priority_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "confidence_score": item.get("confidence_score"),
            "consensus_score": item.get("consensus_score"),
            "predictive_readiness_score": item.get("predictive_readiness_score"),
            "opportunity_score": item.get("opportunity_score"),
            "risk_score": item.get("risk_score"),
            "pca_score": item.get("pca_score"),
            "overall_intelligence_score": item.get("overall_intelligence_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
        },
        "flags": {
            "is_executive_top_10": item.get("is_executive_top_10"),
            "is_executive_top_25": item.get("is_executive_top_25"),
            "is_executive_top_100": item.get("is_executive_top_100"),
        },
        "methodology": {
            "executive_version": item.get("executive_version"),
            "executive_methodology": item.get("executive_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "tier_distribution": rows_to_dicts(tier_rows),
        "raw": item,
    }


@app.get("/executive/top10", tags=["Executive Portfolio"])
def get_executive_top10():
    with get_connection() as conn:
        validate_table(conn, "executive_top_10_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_top_10_v1
            ORDER BY executive_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/top25", tags=["Executive Portfolio"])
def get_executive_top25():
    with get_connection() as conn:
        validate_table(conn, "executive_top_25_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_top_25_v1
            ORDER BY executive_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/top100", tags=["Executive Portfolio"])
def get_executive_top100():
    with get_connection() as conn:
        validate_table(conn, "executive_top_100_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_top_100_v1
            ORDER BY executive_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/categories", tags=["Executive Portfolio"])
def get_executive_categories():
    with get_connection() as conn:
        validate_table(conn, "executive_category_leaders_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_category_leaders_v1
            ORDER BY category ASC, category_rank ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/distribution/tiers", tags=["Executive Portfolio"])
def get_executive_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "executive_portfolio_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_portfolio_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

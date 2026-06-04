"""
Sprint 24A — FastAPI website deployment route additions

Paste below Sprint 23B enterprise deployment routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/website-demo/assets/{rxcui}", tags=["Website Demo"])
def get_website_demo_asset(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "website_demo_assets_v1")

        row = conn.execute(
            """
            SELECT *
            FROM website_demo_assets_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No website demo asset found for RxCUI {rxcui}")

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "website_demo": {
            "website_demo_rank": item.get("website_demo_rank"),
            "website_demo_score": item.get("website_demo_score"),
            "website_demo_percentile": item.get("website_demo_percentile"),
            "website_demo_badge": item.get("website_demo_badge"),
            "website_visibility": item.get("website_visibility"),
            "website_card_title": item.get("website_card_title"),
            "website_card_subtitle": item.get("website_card_subtitle"),
            "website_hero_copy": item.get("website_hero_copy"),
            "website_cta_label": item.get("website_cta_label"),
            "website_route": item.get("website_route"),
        },
        "scores": {
            "enterprise_deployment_score": item.get("enterprise_deployment_score"),
            "ai_copilot_score": item.get("ai_copilot_score"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_portfolio_score": item.get("executive_portfolio_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "confidence_score": item.get("confidence_score"),
            "risk_score": item.get("risk_score"),
            "deployment_gate_pass_rate": item.get("deployment_gate_pass_rate"),
        },
        "deployment": {
            "enterprise_deployment_tier": item.get("enterprise_deployment_tier"),
            "enterprise_deployment_status": item.get("enterprise_deployment_status"),
        },
        "methodology": {
            "website_layer_version": item.get("website_layer_version"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/website-demo/featured", tags=["Website Demo"])
def get_website_featured_medications(limit: int = Query(default=25, ge=1, le=100)):
    with get_connection() as conn:
        validate_table(conn, "website_featured_medications_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM website_featured_medications_v1
            ORDER BY featured_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/website-demo/collections", tags=["Website Demo"])
def get_website_demo_collections(collection_name: str | None = Query(default=None)):
    with get_connection() as conn:
        validate_table(conn, "website_demo_collections_v1")

        params = []
        where_clause = ""
        if collection_name:
            where_clause = "WHERE collection_name = ?"
            params.append(collection_name)

        rows = conn.execute(
            f"""
            SELECT *
            FROM website_demo_collections_v1
            {where_clause}
            ORDER BY collection_name ASC, collection_rank ASC
            """,
            params,
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/website-demo/summary", tags=["Website Demo"])
def get_website_launch_readiness_summary():
    with get_connection() as conn:
        validate_table(conn, "website_launch_readiness_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM website_launch_readiness_summary_v1
            """
        ).fetchall()

    return rows_to_dicts(rows)

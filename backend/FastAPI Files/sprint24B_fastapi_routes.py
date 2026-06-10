"""
Sprint 24B — FastAPI production hardening route additions

Paste below Sprint 24A website demo routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/production-hardening/{rxcui}", tags=["Production Hardening"])
def get_production_hardening(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "production_hardening_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM production_hardening_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No production hardening profile found for RxCUI {rxcui}")

        gate_rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        action_rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "hardening": {
            "production_hardening_rank": item.get("production_hardening_rank"),
            "production_hardening_score": item.get("production_hardening_score"),
            "production_hardening_percentile": item.get("production_hardening_percentile"),
            "production_hardening_tier": item.get("production_hardening_tier"),
            "launch_decision": item.get("launch_decision"),
            "website_visibility": item.get("website_visibility"),
            "hardening_gate_pass_count": item.get("hardening_gate_pass_count"),
            "hardening_gate_total_count": item.get("hardening_gate_total_count"),
            "hardening_gate_pass_rate": item.get("hardening_gate_pass_rate"),
            "production_hardening_action_plan": item.get("production_hardening_action_plan"),
        },
        "scores": {
            "website_demo_score": item.get("website_demo_score"),
            "enterprise_deployment_score": item.get("enterprise_deployment_score"),
            "ai_copilot_score": item.get("ai_copilot_score"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "confidence_score": item.get("confidence_score"),
            "risk_score": item.get("risk_score"),
            "api_payload_readiness": item.get("api_payload_readiness"),
            "frontend_display_readiness": item.get("frontend_display_readiness"),
            "data_completeness_readiness": item.get("data_completeness_readiness"),
            "demo_fallback_readiness": item.get("demo_fallback_readiness"),
        },
        "gates": rows_to_dicts(gate_rows),
        "actions": rows_to_dicts(action_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "hardening_version": item.get("hardening_version"),
            "hardening_methodology": item.get("hardening_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/production-hardening/{rxcui}/gates", tags=["Production Hardening"])
def get_production_hardening_gates(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "production_hardening_gates_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-hardening/top", tags=["Production Hardening"])
def get_top_production_hardening_assets(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "production_hardening_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_master_v1
            ORDER BY production_hardening_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-hardening/distribution/tiers", tags=["Production Hardening"])
def get_production_hardening_distribution():
    with get_connection() as conn:
        validate_table(conn, "production_hardening_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_hardening_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-hardening/platform/summary", tags=["Production Hardening"])
def get_production_platform_readiness_summary():
    with get_connection() as conn:
        validate_table(conn, "production_platform_readiness_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_platform_readiness_summary_v1
            """
        ).fetchall()

    return rows_to_dicts(rows)

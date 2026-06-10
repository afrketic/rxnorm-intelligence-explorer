"""
Sprint 23B — FastAPI enterprise deployment route additions

Paste below Sprint 23A AI copilot routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/deployment/{rxcui}", tags=["Enterprise Deployment"])
def get_enterprise_deployment(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No enterprise deployment profile found for RxCUI {rxcui}")

        gate_rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        action_rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_actions_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY action_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "deployment": {
            "enterprise_deployment_rank": item.get("enterprise_deployment_rank"),
            "enterprise_deployment_score": item.get("enterprise_deployment_score"),
            "enterprise_deployment_percentile": item.get("enterprise_deployment_percentile"),
            "enterprise_deployment_tier": item.get("enterprise_deployment_tier"),
            "enterprise_deployment_status": item.get("enterprise_deployment_status"),
            "deployment_gate_pass_count": item.get("deployment_gate_pass_count"),
            "deployment_gate_total_count": item.get("deployment_gate_total_count"),
            "deployment_gate_pass_rate": item.get("deployment_gate_pass_rate"),
            "deployment_action_plan": item.get("deployment_action_plan"),
        },
        "scores": {
            "ai_copilot_score": item.get("ai_copilot_score"),
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "production_candidate_score": item.get("production_candidate_score"),
            "explainability_score": item.get("explainability_score"),
            "confidence_score": item.get("confidence_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "graph_connectivity_score": item.get("graph_connectivity_score"),
            "risk_score": item.get("risk_score"),
        },
        "gates": rows_to_dicts(gate_rows),
        "actions": rows_to_dicts(action_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "deployment_version": item.get("deployment_version"),
            "deployment_methodology": item.get("deployment_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/deployment/{rxcui}/gates", tags=["Enterprise Deployment"])
def get_enterprise_deployment_gates(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_gates_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_gates_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY gate_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/deployment/top", tags=["Enterprise Deployment"])
def get_top_enterprise_deployment_assets(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_master_v1
            ORDER BY enterprise_deployment_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/deployment/distribution/tiers", tags=["Enterprise Deployment"])
def get_enterprise_deployment_distribution():
    with get_connection() as conn:
        validate_table(conn, "enterprise_deployment_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_deployment_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/deployment/platform/summary", tags=["Enterprise Deployment"])
def get_enterprise_platform_launch_summary():
    with get_connection() as conn:
        validate_table(conn, "enterprise_platform_launch_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM enterprise_platform_launch_summary_v1
            """
        ).fetchall()

    return rows_to_dicts(rows)

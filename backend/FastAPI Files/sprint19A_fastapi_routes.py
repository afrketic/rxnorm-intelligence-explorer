"""
Sprint 19A — FastAPI predictive intelligence route additions

Paste below Sprint 18B methodology routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
"""


@app.get("/predictive/{rxcui}", tags=["Predictive Intelligence"])
def get_predictive_intelligence(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "predictive_intelligence_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM predictive_intelligence_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No predictive intelligence found for RxCUI {rxcui}")

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM predictive_priority_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "predictive": {
            "predictive_readiness_score": score.get("predictive_readiness_score"),
            "opportunity_score": score.get("opportunity_score"),
            "risk_score": score.get("risk_score"),
            "risk_tier": score.get("risk_tier"),
            "deployment_priority_score": score.get("deployment_priority_score"),
            "deployment_priority_percentile": score.get("deployment_priority_percentile"),
            "deployment_priority_tier": score.get("deployment_priority_tier"),
            "recommended_action": score.get("recommended_action"),
        },
        "source_scores": {
            "intelligence_score": score.get("intelligence_score"),
            "readiness_score": score.get("readiness_score"),
            "confidence_score": score.get("confidence_score"),
            "pca_score": score.get("pca_score"),
            "consensus_score": score.get("consensus_score"),
            "agreement_index": score.get("agreement_index"),
            "methodology_variance": score.get("methodology_variance"),
            "graph_connectivity_score": score.get("graph_connectivity_score"),
            "benchmark_percentile": score.get("benchmark_percentile"),
        },
        "methodology": {
            "predictive_model_version": score.get("predictive_model_version"),
            "predictive_methodology": score.get("predictive_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "distribution": rows_to_dicts(distribution_rows),
        "raw": score,
    }


@app.get("/predictive/distribution", tags=["Predictive Intelligence"])
def get_predictive_distribution():
    with get_connection() as conn:
        validate_table(conn, "predictive_priority_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM predictive_priority_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

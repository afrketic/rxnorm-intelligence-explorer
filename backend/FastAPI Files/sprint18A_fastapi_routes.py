"""
Sprint 18A — FastAPI PCA route additions

Paste below Sprint 17B confidence routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
"""


@app.get("/pca/{rxcui}", tags=["PCA"])
def get_pca_score(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "pca_readiness_scores_v1")

        row = conn.execute(
            """
            SELECT *
            FROM pca_readiness_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No PCA score found for RxCUI {rxcui}")

        summary_rows = conn.execute(
            """
            SELECT *
            FROM pca_model_summary_v1
            ORDER BY component
            """
        ).fetchall()

        tier_rows = conn.execute(
            """
            SELECT *
            FROM pca_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    feature_values = {
        key.replace("feature_", ""): value
        for key, value in score.items()
        if key.startswith("feature_")
    }

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "pca": {
            "pca_component_1": score.get("pca_component_1"),
            "pca_component_2": score.get("pca_component_2"),
            "pca_component_3": score.get("pca_component_3"),
            "pca_component_1_score": score.get("pca_component_1_score"),
            "pca_component_2_score": score.get("pca_component_2_score"),
            "pca_component_3_score": score.get("pca_component_3_score"),
            "pca_overall_score": score.get("pca_overall_score"),
            "pca_percentile": score.get("pca_percentile"),
            "pca_tier": score.get("pca_tier"),
        },
        "comparison": {
            "expert_overall_readiness_score": score.get("expert_overall_readiness_score"),
            "overall_intelligence_score": score.get("overall_intelligence_score"),
            "confidence_score": score.get("confidence_score"),
            "pca_vs_expert_delta": score.get("pca_vs_expert_delta"),
        },
        "features": feature_values,
        "model_summary": rows_to_dicts(summary_rows),
        "tier_distribution": rows_to_dicts(tier_rows),
        "methodology": {
            "pca_model_version": score.get("pca_model_version"),
            "pca_build_timestamp": score.get("pca_build_timestamp"),
        },
        "raw": score,
    }


@app.get("/pca/distribution/tiers", tags=["PCA"])
def get_pca_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "pca_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM pca_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/pca/model/summary", tags=["PCA"])
def get_pca_model_summary():
    with get_connection() as conn:
        validate_table(conn, "pca_model_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM pca_model_summary_v1
            ORDER BY component
            """
        ).fetchall()

    return rows_to_dicts(rows)

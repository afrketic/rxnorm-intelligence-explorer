"""
Sprint 25A — Methodology Selection Engine FastAPI routes

Paste below Validation Track routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/methodology-selection/{rxcui}", tags=["Methodology Selection"])
def get_methodology_selection_engine(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_engine_v1")

        row = conn.execute(
            """
            SELECT *
            FROM methodology_selection_engine_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No methodology selection profile found for RxCUI {rxcui}")

        reason_rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY reason_score DESC, reason_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

        summary_rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_summary_v2
            ORDER BY winner_count DESC
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "selection": {
            "methodology_selection_rank": item.get("methodology_selection_rank"),
            "winning_methodology": item.get("winning_methodology"),
            "methodology_selection_score": item.get("methodology_selection_score"),
            "methodology_selection_percentile": item.get("methodology_selection_percentile"),
            "methodology_selection_tier": item.get("methodology_selection_tier"),
            "selection_confidence": item.get("selection_confidence"),
            "winner_margin": item.get("winner_margin"),
            "selection_reason": item.get("selection_reason"),
        },
        "method_scores": {
            "expert_score": item.get("expert_score"),
            "pca_score": item.get("pca_score"),
            "efa_score": item.get("efa_score"),
            "regression_score": item.get("regression_score"),
            "ahp_score": item.get("ahp_score"),
        },
        "selection_scores": {
            "expert_selection_score": item.get("expert_selection_score"),
            "pca_selection_score": item.get("pca_selection_score"),
            "efa_selection_score": item.get("efa_selection_score"),
            "regression_selection_score": item.get("regression_selection_score"),
            "ahp_selection_score": item.get("ahp_selection_score"),
        },
        "validation_signals": {
            "agreement_score": item.get("agreement_score"),
            "bootstrap_stability": item.get("bootstrap_stability"),
            "rank_stability": item.get("rank_stability"),
            "confidence_score": item.get("confidence_score"),
            "explainability_score": item.get("explainability_score"),
            "deployment_score": item.get("deployment_score"),
            "production_hardening_score": item.get("production_hardening_score"),
            "confidence_interval_width": item.get("confidence_interval_width"),
            "regression_model_r2": item.get("regression_model_r2"),
            "regression_model_rmse": item.get("regression_model_rmse"),
            "efa_factor_strength": item.get("efa_factor_strength"),
            "pca_variance_proxy": item.get("pca_variance_proxy"),
        },
        "reason_codes": rows_to_dicts(reason_rows),
        "summary": rows_to_dicts(summary_rows),
        "methodology": {
            "selection_version": item.get("selection_version"),
            "selection_methodology": item.get("selection_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/methodology-selection/{rxcui}/reasons", tags=["Methodology Selection"])
def get_methodology_selection_reasons(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_reason_codes_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY reason_score DESC, reason_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/methodology-selection/top", tags=["Methodology Selection"])
def get_top_methodology_selection_profiles(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_engine_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_engine_v1
            ORDER BY methodology_selection_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/methodology-selection/summary/winners", tags=["Methodology Selection"])
def get_methodology_selection_summary_v2():
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_summary_v2")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_summary_v2
            ORDER BY winner_count DESC
            """
        ).fetchall()

    return rows_to_dicts(rows)

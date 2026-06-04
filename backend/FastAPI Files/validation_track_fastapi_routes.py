"""
Validation Track V1–V5 — FastAPI routes

Paste below Sprint 24B production hardening routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/validation/regression/{rxcui}", tags=["Validation Track"])
def get_validation_regression(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "regression_readiness_scores_v1")
        row = conn.execute(
            """
            SELECT *
            FROM regression_readiness_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No regression score found for RxCUI {rxcui}")
        summary = conn.execute("SELECT * FROM regression_model_summary_v1 ORDER BY feature_rank ASC").fetchall()
    return {"rxcui": str(rxcui), "regression": dict(row), "model_summary": rows_to_dicts(summary)}


@app.get("/validation/efa/{rxcui}", tags=["Validation Track"])
def get_validation_efa(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "efa_factor_scores_v1")
        row = conn.execute(
            """
            SELECT *
            FROM efa_factor_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No EFA score found for RxCUI {rxcui}")
        loadings = conn.execute("SELECT * FROM efa_loadings_v1 ORDER BY factor_number ASC, absolute_loading DESC").fetchall()
        summary = conn.execute("SELECT * FROM efa_model_summary_v1 ORDER BY factor_number ASC").fetchall()
    return {"rxcui": str(rxcui), "efa": dict(row), "loadings": rows_to_dicts(loadings), "model_summary": rows_to_dicts(summary)}


@app.get("/validation/bootstrap/{rxcui}", tags=["Validation Track"])
def get_validation_bootstrap(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "bootstrap_score_stability_v1")
        score = conn.execute(
            """
            SELECT *
            FROM bootstrap_score_stability_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        rank = conn.execute(
            """
            SELECT *
            FROM bootstrap_rank_stability_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        ci = conn.execute(
            """
            SELECT *
            FROM confidence_intervals_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if score is None:
            raise HTTPException(status_code=404, detail=f"No bootstrap validation found for RxCUI {rxcui}")
    return {
        "rxcui": str(rxcui),
        "score_stability": dict(score) if score else None,
        "rank_stability": dict(rank) if rank else None,
        "confidence_interval": dict(ci) if ci else None,
    }


@app.get("/validation/sensitivity/{rxcui}", tags=["Validation Track"])
def get_validation_sensitivity(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "rank_volatility_v1")
        volatility = conn.execute(
            """
            SELECT *
            FROM rank_volatility_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        scenarios = conn.execute(
            """
            SELECT *
            FROM sensitivity_analysis_results_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY perturbed_domain ASC, weight_delta_pct ASC
            """,
            (str(rxcui),),
        ).fetchall()
        if volatility is None:
            raise HTTPException(status_code=404, detail=f"No sensitivity profile found for RxCUI {rxcui}")
    return {"rxcui": str(rxcui), "volatility": dict(volatility), "scenarios": rows_to_dicts(scenarios)}


@app.get("/validation/methodology/{rxcui}", tags=["Validation Track"])
def get_validation_methodology_selection(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_comparison_master_v2")
        row = conn.execute(
            """
            SELECT *
            FROM methodology_comparison_master_v2
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No methodology v2 profile found for RxCUI {rxcui}")
        summary = conn.execute("SELECT * FROM methodology_selection_summary_v1 ORDER BY medication_count DESC").fetchall()
    return {"rxcui": str(rxcui), "methodology": dict(row), "selection_summary": rows_to_dicts(summary)}


@app.get("/validation/{rxcui}", tags=["Validation Track"])
def get_validation_track_profile(rxcui: str):
    return {
        "rxcui": str(rxcui),
        "regression": get_validation_regression(rxcui),
        "efa": get_validation_efa(rxcui),
        "bootstrap": get_validation_bootstrap(rxcui),
        "sensitivity": get_validation_sensitivity(rxcui),
        "methodology_selection": get_validation_methodology_selection(rxcui),
    }


@app.get("/validation/top", tags=["Validation Track"])
def get_validation_top(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "methodology_comparison_master_v2")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_comparison_master_v2
            ORDER BY methodology_v2_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/validation/summary/methodology-selection", tags=["Validation Track"])
def get_validation_methodology_selection_summary():
    with get_connection() as conn:
        validate_table(conn, "methodology_selection_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_selection_summary_v1
            ORDER BY medication_count DESC
            """
        ).fetchall()
    return rows_to_dicts(rows)

"""
Publication Readiness Release — Sprint 25B, 26A, 26B FastAPI Routes

Paste below Sprint 25A routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/publication-validation/{rxcui}", tags=["Publication Readiness"])
def get_publication_validation_profile(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "publication_validation_master_v1")
        row = conn.execute(
            """
            SELECT *
            FROM publication_validation_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No publication validation profile found for RxCUI {rxcui}")

        reasons = conn.execute(
            """
            SELECT *
            FROM publication_validation_reason_codes_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY reason_score DESC, reason_code ASC
            """,
            (str(rxcui),),
        ).fetchall()

        performance = conn.execute(
            """
            SELECT *
            FROM methodology_performance_comparison_v1
            ORDER BY methodology_performance_rank ASC
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "publication": {
            "publication_rank": item.get("publication_rank"),
            "winning_methodology": item.get("winning_methodology"),
            "publication_score": item.get("publication_score"),
            "publication_percentile": item.get("publication_percentile"),
            "publication_tier": item.get("publication_tier"),
            "publication_readiness": item.get("publication_readiness"),
        },
        "validation": {
            "methodology_selection_score": item.get("methodology_selection_score"),
            "selection_confidence": item.get("selection_confidence"),
            "statistical_defensibility_score": item.get("statistical_defensibility_score"),
            "interpretability_readiness_score": item.get("interpretability_readiness_score"),
            "agreement_score": item.get("agreement_score"),
            "bootstrap_stability": item.get("bootstrap_stability"),
            "rank_stability": item.get("rank_stability"),
            "confidence_interval_width": item.get("confidence_interval_width"),
            "regression_model_r2": item.get("regression_model_r2"),
            "regression_model_rmse": item.get("regression_model_rmse"),
            "regression_performance_score": item.get("regression_performance_score"),
            "efa_explained_variance_score": item.get("efa_explained_variance_score"),
            "explainability_score": item.get("explainability_score"),
            "deployment_score": item.get("deployment_score"),
            "production_hardening_score": item.get("production_hardening_score"),
        },
        "reason_codes": rows_to_dicts(reasons),
        "methodology_performance": rows_to_dicts(performance),
        "methodology": {
            "publication_release_version": item.get("publication_release_version"),
            "publication_methodology": item.get("publication_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/publication-validation/top", tags=["Publication Readiness"])
def get_top_publication_validation_profiles(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "publication_validation_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM publication_validation_master_v1
            ORDER BY publication_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/publication-validation/summary", tags=["Publication Readiness"])
def get_publication_validation_summary():
    with get_connection() as conn:
        validate_table(conn, "publication_validation_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM publication_validation_summary_v1
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/publication-validation/methodology-performance", tags=["Publication Readiness"])
def get_methodology_performance_comparison():
    with get_connection() as conn:
        validate_table(conn, "methodology_performance_comparison_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_performance_comparison_v1
            ORDER BY methodology_performance_rank ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/scientific-benchmark/{rxcui}", tags=["Scientific Benchmark"])
def get_scientific_benchmark_profile(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "benchmark_validation_master_v1")
        row = conn.execute(
            """
            SELECT *
            FROM benchmark_validation_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No scientific benchmark profile found for RxCUI {rxcui}")

        summary = conn.execute(
            """
            SELECT *
            FROM scientific_benchmark_summary_v1
            """
        ).fetchall()

    item = dict(row)
    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "scientific": {
            "overall_scientific_rank": item.get("overall_scientific_rank"),
            "winning_methodology": item.get("winning_methodology"),
            "overall_scientific_score": item.get("overall_scientific_score"),
            "overall_scientific_percentile": item.get("overall_scientific_percentile"),
            "scientific_tier": item.get("scientific_tier"),
            "accuracy_score": item.get("accuracy_score"),
            "stability_score": item.get("stability_score"),
            "interpretability_score": item.get("interpretability_score"),
            "deployment_utility_score": item.get("deployment_utility_score"),
        },
        "publication": {
            "publication_score": item.get("publication_score"),
            "publication_tier": item.get("publication_tier"),
            "selection_confidence": item.get("selection_confidence"),
            "regression_model_r2": item.get("regression_model_r2"),
            "bootstrap_stability": item.get("bootstrap_stability"),
            "rank_stability": item.get("rank_stability"),
        },
        "summary": rows_to_dicts(summary),
        "methodology": {
            "scientific_benchmark_version": item.get("scientific_benchmark_version"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/scientific-benchmark/top", tags=["Scientific Benchmark"])
def get_top_scientific_benchmark_profiles(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "benchmark_validation_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM benchmark_validation_master_v1
            ORDER BY overall_scientific_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/scientific-benchmark/rankings", tags=["Scientific Benchmark"])
def get_scientific_rankings(
    category: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=250),
):
    with get_connection() as conn:
        validate_table(conn, "scientific_rankings_v1")
        params = []
        where_clause = ""
        if category:
            where_clause = "WHERE scientific_category = ?"
            params.append(category)

        rows = conn.execute(
            f"""
            SELECT *
            FROM scientific_rankings_v1
            {where_clause}
            ORDER BY scientific_category ASC, scientific_category_rank ASC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/scientific-benchmark/summary", tags=["Scientific Benchmark"])
def get_scientific_benchmark_summary():
    with get_connection() as conn:
        validate_table(conn, "scientific_benchmark_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM scientific_benchmark_summary_v1
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/white-paper/sections", tags=["White Paper"])
def get_white_paper_sections():
    with get_connection() as conn:
        validate_table(conn, "white_paper_sections_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM white_paper_sections_v1
            ORDER BY section_order ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/white-paper/metrics", tags=["White Paper"])
def get_white_paper_metrics():
    with get_connection() as conn:
        validate_table(conn, "white_paper_metrics_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM white_paper_metrics_v1
            ORDER BY metric_group ASC, metric_name ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)


@app.get("/white-paper/appendix", tags=["White Paper"])
def get_white_paper_appendix():
    with get_connection() as conn:
        validate_table(conn, "white_paper_methodology_appendix_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM white_paper_methodology_appendix_v1
            ORDER BY appendix_order ASC
            """
        ).fetchall()
    return rows_to_dicts(rows)

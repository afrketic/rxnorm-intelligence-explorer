"""
Sprint 18B — FastAPI methodology consensus route additions

Paste below Sprint 18A PCA routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
"""


@app.get("/methodology/{rxcui}", tags=["Methodology"])
def get_methodology_consensus(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "methodology_comparison_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM methodology_comparison_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No methodology consensus found for RxCUI {rxcui}")

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM methodology_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "methodology_scores": {
            "intelligence_score": score.get("intelligence_score"),
            "readiness_score": score.get("readiness_score"),
            "confidence_score": score.get("confidence_score"),
            "pca_score": score.get("pca_score"),
        },
        "consensus": {
            "consensus_score": score.get("consensus_score"),
            "consensus_percentile": score.get("consensus_percentile"),
            "consensus_tier": score.get("consensus_tier"),
            "agreement_index": score.get("agreement_index"),
            "methodology_variance": score.get("methodology_variance"),
            "methodology_range": score.get("methodology_range"),
            "methodology_min_score": score.get("methodology_min_score"),
            "methodology_max_score": score.get("methodology_max_score"),
            "model_count": score.get("model_count"),
        },
        "tiers": {
            "readiness_tier": score.get("readiness_tier"),
            "confidence_tier": score.get("confidence_tier"),
            "pca_tier": score.get("pca_tier"),
        },
        "methodology": {
            "consensus_version": score.get("consensus_version"),
            "consensus_methodology": score.get("consensus_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "distribution": rows_to_dicts(distribution_rows),
        "raw": score,
    }


@app.get("/methodology/distribution", tags=["Methodology"])
def get_methodology_distribution():
    with get_connection() as conn:
        validate_table(conn, "methodology_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM methodology_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

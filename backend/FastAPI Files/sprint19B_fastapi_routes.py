"""
Sprint 19B — FastAPI production candidate route additions

Paste below Sprint 19A predictive routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/production-candidates/{rxcui}", tags=["Production Candidates"])
def get_production_candidate(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "production_candidate_rankings_v1")

        row = conn.execute(
            """
            SELECT *
            FROM production_candidate_rankings_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No production candidate ranking found for RxCUI {rxcui}")

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM production_candidate_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

        summary_rows = conn.execute(
            """
            SELECT *
            FROM production_candidate_summary_v1
            """
        ).fetchall()

    candidate = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": candidate.get("display_name"),
        "rank": {
            "production_rank": candidate.get("production_rank"),
            "production_candidate_score": candidate.get("production_candidate_score"),
            "production_candidate_percentile": candidate.get("production_candidate_percentile"),
            "production_candidate_tier": candidate.get("production_candidate_tier"),
            "production_status": candidate.get("production_status"),
            "showcase_recommendation": candidate.get("showcase_recommendation"),
        },
        "signals": {
            "deployment_priority_score": candidate.get("deployment_priority_score"),
            "predictive_readiness_score": candidate.get("predictive_readiness_score"),
            "opportunity_score": candidate.get("opportunity_score"),
            "risk_score": candidate.get("risk_score"),
            "confidence_score": candidate.get("confidence_score"),
            "consensus_score": candidate.get("consensus_score"),
            "graph_connectivity_score": candidate.get("graph_connectivity_score"),
            "benchmark_percentile": candidate.get("benchmark_percentile"),
            "pca_score": candidate.get("pca_score"),
            "readiness_score": candidate.get("readiness_score"),
            "intelligence_score": candidate.get("intelligence_score"),
        },
        "flags": {
            "is_top_10_candidate": candidate.get("is_top_10_candidate"),
            "is_top_100_candidate": candidate.get("is_top_100_candidate"),
            "is_flagship_candidate": candidate.get("is_flagship_candidate"),
        },
        "methodology": {
            "candidate_engine_version": candidate.get("candidate_engine_version"),
            "candidate_methodology": candidate.get("candidate_methodology"),
            "build_timestamp": candidate.get("build_timestamp"),
        },
        "distribution": rows_to_dicts(distribution_rows),
        "summary": rows_to_dicts(summary_rows),
        "raw": candidate,
    }


@app.get("/production-candidates", tags=["Production Candidates"])
def list_production_candidates(
    limit: int = Query(default=25, ge=1, le=250),
    offset: int = Query(default=0, ge=0),
    tier: str | None = Query(default=None),
):
    with get_connection() as conn:
        validate_table(conn, "production_candidate_rankings_v1")

        params = []
        where_clause = ""
        if tier:
            where_clause = "WHERE production_candidate_tier = ?"
            params.append(tier)

        rows = conn.execute(
            f"""
            SELECT *
            FROM production_candidate_rankings_v1
            {where_clause}
            ORDER BY production_rank ASC
            LIMIT ? OFFSET ?
            """,
            params + [limit, offset],
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/production-candidates/distribution/tiers", tags=["Production Candidates"])
def get_production_candidate_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "production_candidate_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM production_candidate_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

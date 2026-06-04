"""
Sprint 17A — FastAPI route additions

Paste below Sprint 16A benchmark analytics route and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
"""


@app.get("/readiness/{rxcui}", tags=["Readiness"])
def get_readiness_score(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "drug_readiness_scores_v1")

        row = conn.execute(
            """
            SELECT *
            FROM drug_readiness_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No readiness score found for RxCUI {rxcui}")

        tier_rows = conn.execute(
            """
            SELECT *
            FROM readiness_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "scores": {
            "interoperability_readiness_score": score.get("interoperability_readiness_score"),
            "claims_readiness_score": score.get("claims_readiness_score"),
            "ai_readiness_score": score.get("ai_readiness_score"),
            "overall_readiness_score": score.get("overall_readiness_score"),
        },
        "percentiles": {
            "interoperability_percentile": score.get("interoperability_percentile"),
            "claims_percentile": score.get("claims_percentile"),
            "ai_percentile": score.get("ai_percentile"),
            "overall_readiness_percentile": score.get("overall_readiness_percentile"),
        },
        "tier": score.get("readiness_tier"),
        "methodology": {
            "score_version": score.get("score_version"),
            "score_methodology": score.get("score_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "drivers": {
            "interoperability": {
                "relationship_count": score.get("interoperability_relationship_count_norm"),
                "relationship_diversity": score.get("interoperability_relationship_diversity_norm"),
                "identifier_count": score.get("interoperability_identifier_count_norm"),
                "atc_depth": score.get("interoperability_atc_depth_norm"),
                "class_type_count": score.get("interoperability_class_type_count_norm"),
            },
            "claims": {
                "ndc_count": score.get("claims_ndc_count_norm"),
                "package_count": score.get("claims_package_count_norm"),
                "active_fda": score.get("claims_active_fda_norm"),
                "cms_claims": score.get("claims_cms_claim_norm"),
                "cms_percentile": score.get("claims_cms_percentile_norm"),
            },
            "ai": {
                "semantic_richness": score.get("ai_semantic_richness_norm"),
                "graph_density": score.get("ai_graph_density_norm"),
                "graph_node_degree": score.get("ai_graph_node_degree_norm"),
                "explainability_index": score.get("ai_explainability_index_norm"),
                "source_confidence": score.get("ai_source_confidence_norm"),
            },
        },
        "tier_distribution": rows_to_dicts(tier_rows),
        "raw": score,
    }


@app.get("/readiness/distribution/tiers", tags=["Readiness"])
def get_readiness_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "readiness_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM readiness_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

"""
Sprint 17B — FastAPI route additions

Paste below Sprint 17A readiness routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
"""


@app.get("/confidence/{rxcui}", tags=["Confidence"])
def get_confidence_score(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "drug_confidence_scores_v1")

        row = conn.execute(
            """
            SELECT *
            FROM drug_confidence_scores_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No confidence score found for RxCUI {rxcui}")

        tier_rows = conn.execute(
            """
            SELECT *
            FROM confidence_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    score = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": score.get("display_name"),
        "confidence_score": score.get("confidence_score"),
        "confidence_percentile": score.get("confidence_percentile"),
        "confidence_tier": score.get("confidence_tier"),
        "components": {
            "evidence_strength_score": score.get("evidence_strength_score"),
            "explainability_confidence_score": score.get("explainability_confidence_score"),
            "benchmark_reliability_score": score.get("benchmark_reliability_score"),
            "readiness_stability_score": score.get("readiness_stability_score"),
        },
        "evidence_drivers": {
            "relationship_evidence_norm": score.get("relationship_evidence_norm"),
            "classification_evidence_norm": score.get("classification_evidence_norm"),
            "graph_node_evidence_norm": score.get("graph_node_evidence_norm"),
            "graph_edge_evidence_norm": score.get("graph_edge_evidence_norm"),
            "domain_evidence_norm": score.get("domain_evidence_norm"),
        },
        "explainability_drivers": {
            "semantic_explainability_norm": score.get("semantic_explainability_norm"),
            "graph_connectivity_explainability_norm": score.get("graph_connectivity_explainability_norm"),
            "classification_depth_explainability_norm": score.get("classification_depth_explainability_norm"),
        },
        "benchmark_drivers": {
            "overall_intelligence_percentile": score.get("overall_intelligence_percentile"),
            "overall_readiness_percentile": score.get("overall_readiness_percentile"),
        },
        "stability": {
            "readiness_domain_std": score.get("readiness_domain_std"),
        },
        "methodology": {
            "confidence_version": score.get("confidence_version"),
            "confidence_methodology": score.get("confidence_methodology"),
            "build_timestamp": score.get("build_timestamp"),
        },
        "tier_distribution": rows_to_dicts(tier_rows),
        "raw": score,
    }


@app.get("/confidence/distribution/tiers", tags=["Confidence"])
def get_confidence_tier_distribution():
    with get_connection() as conn:
        validate_table(conn, "confidence_tier_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM confidence_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

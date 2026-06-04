"""
Sprint 16A — FastAPI route additions

Paste this block into backend/rxnorm_intelligence_api_v1.py after the Sprint 15B benchmark routes.
It assumes your API file already has:
    - app
    - get_connection()
    - rows_to_dicts()
    - table_exists()
    - validate_table()
    - HTTPException
"""


@app.get("/benchmark/analytics/{rxcui}", tags=["Benchmarks"])
def get_benchmark_analytics(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "benchmark_analytics_master_v1")

        row = conn.execute(
            """
            SELECT *
            FROM benchmark_analytics_master_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No benchmark analytics found for RxCUI {rxcui}")

        analytics = dict(row)

    peer_comparison = []
    for i in [1, 2, 3]:
        peer_rxcui = analytics.get(f"top_peer_rxcui_{i}")
        if peer_rxcui:
            peer_comparison.append(
                {
                    "rxcui": peer_rxcui,
                    "display_name": analytics.get(f"top_peer_name_{i}"),
                    "overall_intelligence_score": analytics.get(f"top_peer_score_{i}"),
                    "benchmark_tier": analytics.get(f"top_peer_tier_{i}"),
                    "claims_readiness_score": analytics.get(f"top_peer_claims_score_{i}"),
                    "ai_readiness_score": analytics.get(f"top_peer_ai_score_{i}"),
                    "semantic_richness_score": analytics.get(f"top_peer_semantic_score_{i}"),
                    "graph_connectivity_score": analytics.get(f"top_peer_graph_score_{i}"),
                }
            )

    return {
        "rxcui": str(rxcui),
        "rank_card": {
            "rank": analytics.get("overall_intelligence_rank"),
            "population_size": analytics.get("population_size"),
            "percentile": analytics.get("overall_intelligence_percentile"),
            "top_population_share_pct": analytics.get("top_population_share_pct"),
            "top_population_label": analytics.get("top_population_label"),
            "benchmark_tier": analytics.get("benchmark_tier"),
            "overall_intelligence_score": analytics.get("overall_intelligence_score"),
        },
        "percentile_breakdown": {
            "overall": analytics.get("overall_intelligence_percentile"),
            "claims": analytics.get("claims_readiness_percentile"),
            "ai": analytics.get("ai_readiness_percentile"),
            "semantic": analytics.get("semantic_richness_percentile"),
            "graph": analytics.get("graph_connectivity_percentile"),
        },
        "population_comparison": {
            "overall": {
                "selected": analytics.get("overall_intelligence_score"),
                "population_average": analytics.get("population_average_overall_score_analytics"),
                "delta": analytics.get("overall_intelligence_vs_population_avg"),
            },
            "claims": {
                "selected": analytics.get("claims_readiness_score"),
                "population_average_delta": analytics.get("claims_readiness_vs_population_avg"),
            },
            "ai": {
                "selected": analytics.get("ai_readiness_score"),
                "population_average_delta": analytics.get("ai_readiness_vs_population_avg"),
            },
            "semantic": {
                "selected": analytics.get("semantic_richness_score"),
                "population_average_delta": analytics.get("semantic_richness_vs_population_avg"),
            },
            "graph": {
                "selected": analytics.get("graph_connectivity_score"),
                "population_average_delta": analytics.get("graph_connectivity_vs_population_avg"),
            },
        },
        "driver_breakdown": {
            "ATC Hierarchy": analytics.get("driver_atc_hierarchy_points"),
            "Disease Mapping": analytics.get("driver_disease_mapping_points"),
            "MOA/EPC Evidence": analytics.get("driver_moa_epc_points"),
            "RxNorm Relationships": analytics.get("driver_relationship_points"),
            "Graph Connectivity": analytics.get("driver_graph_connectivity_points"),
        },
        "peer_comparison": peer_comparison,
        "analytics_narrative": analytics.get("analytics_narrative"),
        "raw": analytics,
    }

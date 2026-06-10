@app.get("/explorer/drug-detail/{rxcui}", tags=["Intelligence Explorer"])
def explorer_drug_full_detail(
    rxcui: str,
    include_raw: bool = Query(default=False, description="Include raw classification/relationship rows for audit/debugging."),
    include_graph: bool = Query(default=True, description="Include a small graph subgraph for the selected RxCUI."),
) -> Dict[str, Any]:
    """
    Full Explorer detail payload for a selected RxCUI.

    This endpoint is designed for the production RxNorm Intelligence Explorer UI.
    It combines the intelligence scorecard with semantic classification details,
    relationship details, and an optional graph subgraph.
    """
    with get_connection() as conn:
        validate_table(conn, "drug_intelligence_master_v1")

        master_row = conn.execute(
            'SELECT * FROM "drug_intelligence_master_v1" WHERE CAST(rxcui AS TEXT) = ? LIMIT 1',
            (str(rxcui),),
        ).fetchone()
        if master_row is None:
            raise HTTPException(status_code=404, detail=f"RxCUI not found: {rxcui}")

        master = dict(master_row)
        classification_rows = fetch_rows_by_rxcui(conn, "research_classification_detail", rxcui, limit=5000)
        relationship_rows = fetch_rows_by_rxcui(conn, "research_relationship_detail", rxcui, limit=5000)

        classifications = build_classification_payload(classification_rows)
        relationships = build_relationship_payload(relationship_rows)

    graph_payload: Dict[str, Any] = {"center_rxcui": rxcui, "nodes": [], "edges": []}
    if include_graph:
        try:
            graph_payload = graph_subgraph(rxcui=rxcui, edge_limit=250)
        except Exception:
            graph_payload = {"center_rxcui": rxcui, "nodes": [], "edges": []}

    if not include_raw:
        classifications.pop("raw_rows", None)
        relationships.pop("raw_rows", None)

    scorecard = {
        "overall_intelligence_score": master.get("overall_intelligence_score"),
        "benchmark_tier": master.get("benchmark_tier"),
        "score_band": master.get("score_band"),
        "claims_readiness_score": master.get("claims_readiness_score"),
        "ai_readiness_score": master.get("ai_readiness_score"),
        "semantic_richness_score": master.get("semantic_richness_score"),
        "interoperability_score": master.get("interoperability_score"),
        "clinical_semantics_score": master.get("clinical_semantics_score"),
        "relationship_density_score": master.get("relationship_density_score"),
        "classification_density_score": master.get("classification_density_score"),
    }

    narrative = build_medication_narrative(
        drug=master,
        classifications=classifications,
        scorecard=scorecard,
    )

    return {
        "rxcui": str(rxcui),
        "drug": master,
        "scorecard": scorecard,
        "narrative": narrative,
        "classifications": classifications,
        "relationships": relationships,
        "graph": graph_payload,
    }

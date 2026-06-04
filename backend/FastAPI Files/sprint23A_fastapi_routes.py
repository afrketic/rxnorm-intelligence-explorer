"""
Sprint 23A — FastAPI AI copilot route additions

Paste below Sprint 22B portfolio optimization routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/copilot/{rxcui}", tags=["AI Copilot"])
def get_ai_copilot_brief(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_drug_brief_v1")

        row = conn.execute(
            """
            SELECT *
            FROM ai_copilot_drug_brief_v1
            WHERE CAST(rxcui AS TEXT) = ?
            LIMIT 1
            """,
            (str(rxcui),),
        ).fetchone()

        if row is None:
            raise HTTPException(status_code=404, detail=f"No AI copilot brief found for RxCUI {rxcui}")

        question_rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_question_bank_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY qa_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        card_rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_response_cards_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY card_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

        distribution_rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    item = dict(row)

    return {
        "rxcui": str(rxcui),
        "display_name": item.get("display_name"),
        "copilot": {
            "ai_copilot_rank": item.get("ai_copilot_rank"),
            "ai_copilot_score": item.get("ai_copilot_score"),
            "ai_copilot_percentile": item.get("ai_copilot_percentile"),
            "ai_copilot_tier": item.get("ai_copilot_tier"),
            "recommended_prompt": item.get("recommended_prompt"),
        },
        "summaries": {
            "executive_summary": item.get("executive_summary"),
            "technical_summary": item.get("technical_summary"),
            "strategic_summary": item.get("strategic_summary"),
        },
        "scores": {
            "portfolio_optimization_score": item.get("portfolio_optimization_score"),
            "strategic_opportunity_score": item.get("strategic_opportunity_score"),
            "executive_recommendation_score": item.get("executive_recommendation_score"),
            "explainability_score": item.get("explainability_score"),
            "confidence_score": item.get("confidence_score"),
            "overall_readiness_score": item.get("overall_readiness_score"),
            "risk_score": item.get("risk_score"),
        },
        "questions": rows_to_dicts(question_rows),
        "cards": rows_to_dicts(card_rows),
        "distribution": rows_to_dicts(distribution_rows),
        "methodology": {
            "copilot_version": item.get("copilot_version"),
            "copilot_methodology": item.get("copilot_methodology"),
            "build_timestamp": item.get("build_timestamp"),
        },
        "raw": item,
    }


@app.get("/copilot/{rxcui}/questions", tags=["AI Copilot"])
def get_ai_copilot_questions(rxcui: str):
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_question_bank_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_question_bank_v1
            WHERE CAST(rxcui AS TEXT) = ?
            ORDER BY qa_rank ASC
            """,
            (str(rxcui),),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/copilot/top", tags=["AI Copilot"])
def get_top_ai_copilot_assets(limit: int = Query(default=25, ge=1, le=250)):
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_drug_brief_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_drug_brief_v1
            ORDER BY ai_copilot_rank ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/copilot/distribution/tiers", tags=["AI Copilot"])
def get_ai_copilot_distribution():
    with get_connection() as conn:
        validate_table(conn, "ai_copilot_distribution_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM ai_copilot_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

    return rows_to_dicts(rows)

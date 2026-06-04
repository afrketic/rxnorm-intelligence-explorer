"""
Sprint 15B — FastAPI route additions

Paste this block into backend/rxnorm_intelligence_api_v1.py after your existing graph routes.
It assumes your API file already has:
    - app = FastAPI(...)
    - DB_PATH or equivalent SQLite path variable
    - sqlite3 imported

If your API uses a different database path variable, replace DB_PATH in get_db_path().
"""

import sqlite3
from pathlib import Path
from fastapi import HTTPException


def get_db_path():
    try:
        return DB_PATH
    except NameError:
        return Path(__file__).resolve().parents[1] / "database" / "rxnorm_research.db"


def sqlite_row_to_dict(row):
    if row is None:
        return None
    return dict(row)


@app.get("/benchmark/comparison/{rxcui}")
def get_benchmark_comparison(rxcui: str):
    db_path = get_db_path()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row

        comparison = conn.execute(
            """
            SELECT *
            FROM benchmark_comparison_master_v1
            WHERE rxcui = ?
            """,
            (str(rxcui),),
        ).fetchone()

        if comparison is None:
            raise HTTPException(status_code=404, detail=f"No benchmark comparison found for RxCUI {rxcui}")

        tier_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

        score_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_score_distribution_v1
            ORDER BY bucket_sort_order
            """
        ).fetchall()

        top_context = conn.execute(
            """
            SELECT
                rxcui,
                display_name,
                overall_intelligence_score,
                overall_intelligence_rank,
                overall_intelligence_percentile,
                benchmark_tier
            FROM benchmark_comparison_master_v1
            ORDER BY overall_intelligence_rank ASC, display_name ASC
            LIMIT 10
            """
        ).fetchall()

        peer_context = conn.execute(
            """
            SELECT
                rxcui,
                display_name,
                overall_intelligence_score,
                overall_intelligence_rank,
                overall_intelligence_percentile,
                benchmark_tier
            FROM benchmark_comparison_master_v1
            WHERE benchmark_tier = (
                SELECT benchmark_tier
                FROM benchmark_comparison_master_v1
                WHERE rxcui = ?
            )
            ORDER BY overall_intelligence_rank ASC, display_name ASC
            LIMIT 25
            """,
            (str(rxcui),),
        ).fetchall()

    comparison_dict = sqlite_row_to_dict(comparison)

    return {
        "rxcui": str(rxcui),
        "comparison": comparison_dict,
        "tier_distribution": [sqlite_row_to_dict(row) for row in tier_distribution],
        "score_distribution": [sqlite_row_to_dict(row) for row in score_distribution],
        "top_context": [sqlite_row_to_dict(row) for row in top_context],
        "peer_context": [sqlite_row_to_dict(row) for row in peer_context],
    }


@app.get("/benchmark/distribution")
def get_benchmark_distribution():
    db_path = get_db_path()

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row

        tier_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_tier_distribution_v1
            ORDER BY tier_sort_order
            """
        ).fetchall()

        score_distribution = conn.execute(
            """
            SELECT *
            FROM benchmark_score_distribution_v1
            ORDER BY bucket_sort_order
            """
        ).fetchall()

    return {
        "tier_distribution": [sqlite_row_to_dict(row) for row in tier_distribution],
        "score_distribution": [sqlite_row_to_dict(row) for row in score_distribution],
    }

"""
Sprint 20B — FastAPI executive leaderboard route additions

Paste below Sprint 20A executive routes and above generic table endpoints.
Requires:
    - app
    - get_connection()
    - validate_table()
    - rows_to_dicts()
    - HTTPException
    - Query
"""


@app.get("/executive/leaderboards", tags=["Executive Leaderboards"])
def get_executive_leaderboards(
    category: str | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
):
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_master_v1")

        params = []
        where_clause = ""
        if category:
            where_clause = "WHERE leaderboard_category = ?"
            params.append(category)

        rows = conn.execute(
            f"""
            SELECT *
            FROM executive_leaderboard_master_v1
            {where_clause}
            ORDER BY leaderboard_category ASC, leaderboard_rank ASC
            LIMIT ?
            """,
            params + [limit],
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/leaderboards/categories", tags=["Executive Leaderboards"])
def get_executive_leaderboard_categories():
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_categories_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_leaderboard_categories_v1
            ORDER BY leaderboard_category ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/leaderboards/summary", tags=["Executive Leaderboards"])
def get_executive_leaderboard_summary():
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_summary_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_leaderboard_summary_v1
            ORDER BY leaderboard_category ASC
            """
        ).fetchall()

    return rows_to_dicts(rows)


@app.get("/executive/leaderboards/{category}", tags=["Executive Leaderboards"])
def get_executive_leaderboard_by_category(
    category: str,
    limit: int = Query(default=25, ge=1, le=100),
):
    with get_connection() as conn:
        validate_table(conn, "executive_leaderboard_master_v1")
        rows = conn.execute(
            """
            SELECT *
            FROM executive_leaderboard_master_v1
            WHERE leaderboard_category = ?
            ORDER BY leaderboard_rank ASC
            LIMIT ?
            """,
            (category, limit),
        ).fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail=f"No leaderboard found for category: {category}")

    return rows_to_dicts(rows)

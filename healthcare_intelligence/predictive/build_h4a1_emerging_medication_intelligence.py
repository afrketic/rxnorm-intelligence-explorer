#!/usr/bin/env python3
"""
H4A.1 — Emerging Medication Intelligence Productization

Purpose
-------
Productize existing predictive and strategic-opportunity assets into
executive-facing forward-looking intelligence artifacts without creating
or displaying a new score.

Creates:
    - emerging_medication_intelligence_v1
    - executive_watchlist_v1
    - emerging_therapeutic_class_v1

Source tables:
    - predictive_intelligence_master_v1
    - strategic_opportunity_master_v1
    - ehi_v6_enterprise_opportunities_v1

Visible signals only:
    - Emerging Priority
    - Watchlist
    - Rising
    - Stable
    - Declining

Run:
    RXNORM_DB_PATH="database/rxnorm_research.db" \
    python healthcare_intelligence/predictive/build_h4a1_emerging_medication_intelligence.py
"""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import pandas as pd


METHODOLOGY_VERSION = "H4A1_EMERGING_MEDICATION_INTELLIGENCE_PRODUCTIZATION_V1"


def resolve_project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def resolve_db_path(project_root: Path) -> Path:
    env_path = os.getenv("RXNORM_DB_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()
    return project_root / "database" / "rxnorm_research.db"


def table_exists(conn: sqlite3.Connection, table_name: str) -> bool:
    return (
        conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            (table_name,),
        ).fetchone()
        is not None
    )


def require_table(conn: sqlite3.Connection, table_name: str) -> None:
    if not table_exists(conn, table_name):
        raise RuntimeError(f"Required source table not found: {table_name}")


def safe_str(value: Any, fallback: str = "") -> str:
    text = str(value or "").strip()
    return text if text else fallback


def classify_signal(row: Dict[str, Any]) -> str:
    deployment_tier = safe_str(row.get("deployment_priority_tier")).lower()
    strategic_tier = safe_str(row.get("strategic_opportunity_tier")).lower()
    market_position = safe_str(row.get("market_position")).lower()

    deployment_pct = float(row.get("deployment_priority_percentile") or 0)
    strategic_pct = float(row.get("strategic_opportunity_percentile") or 0)

    if "tier 1" in deployment_tier and "transformational" in strategic_tier:
        return "Emerging Priority"

    if "transformational" in strategic_tier or "strategic opportunity" in strategic_tier:
        return "Watchlist"

    if "flagship" in market_position or "strategic leader" in market_position:
        return "Watchlist"

    if deployment_pct >= 95 or strategic_pct >= 95:
        return "Rising"

    return "Stable"


def build_watch_reason(row: Dict[str, Any], signal: str) -> str:
    name = safe_str(row.get("display_name"), "This medication")
    deployment_tier = safe_str(row.get("deployment_priority_tier"), "predictive deployment signal")
    strategic_tier = safe_str(row.get("strategic_opportunity_tier"), "strategic opportunity signal")
    market_position = safe_str(row.get("market_position"), "portfolio position")

    if signal == "Emerging Priority":
        return (
            f"{name} combines Tier 1 predictive deployment readiness with transformational "
            f"strategic opportunity evidence, making it a forward-looking executive priority."
        )

    if signal == "Watchlist":
        return (
            f"{name} shows meaningful strategic opportunity evidence ({strategic_tier}) "
            f"and {market_position} positioning, warranting executive monitoring."
        )

    if signal == "Rising":
        return (
            f"{name} has high predictive or strategic percentile signals and may be gaining "
            f"enterprise relevance across future healthcare intelligence workflows."
        )

    return (
        f"{name} has a stable predictive profile based on currently available deployment, "
        f"opportunity, confidence, and graph-derived signals."
    )


def build_executive_action(row: Dict[str, Any], signal: str) -> str:
    recommended = safe_str(row.get("strategic_action_plan")) or safe_str(row.get("recommended_action"))

    if signal == "Emerging Priority":
        return recommended or "Prioritize for executive portfolio review and forward-looking deployment planning."

    if signal == "Watchlist":
        return recommended or "Monitor as an executive watchlist medication and review in future portfolio planning."

    if signal == "Rising":
        return recommended or "Track for rising enterprise relevance and reassess as predictive evidence matures."

    return recommended or "Maintain as stable intelligence context and revisit during periodic portfolio refresh."


def create_emerging_medication_table(conn: sqlite3.Connection) -> pd.DataFrame:
    require_table(conn, "predictive_intelligence_master_v1")
    require_table(conn, "strategic_opportunity_master_v1")

    rows = conn.execute(
        """
        SELECT
            p.rxcui,
            COALESCE(p.display_name, s.display_name) AS display_name,

            p.deployment_priority_tier,
            p.deployment_priority_percentile,
            p.recommended_action,

            s.strategic_opportunity_rank,
            s.strategic_opportunity_tier,
            s.strategic_opportunity_percentile,
            s.strategic_opportunity_type,
            s.market_position,
            s.strategic_action_plan,

            p.predictive_model_version,
            s.opportunity_version
        FROM predictive_intelligence_master_v1 p
        LEFT JOIN strategic_opportunity_master_v1 s
            ON CAST(s.rxcui AS TEXT) = CAST(p.rxcui AS TEXT)
        """
    ).fetchall()

    records = []
    build_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for raw in rows:
        row = dict(raw)
        signal = classify_signal(row)
        records.append(
            {
                "rxcui": str(row.get("rxcui")),
                "display_name": row.get("display_name"),
                "emerging_signal": signal,
                "watch_reason": build_watch_reason(row, signal),
                "executive_action": build_executive_action(row, signal),
                "deployment_priority_tier": row.get("deployment_priority_tier"),
                "strategic_opportunity_tier": row.get("strategic_opportunity_tier"),
                "strategic_opportunity_type": row.get("strategic_opportunity_type"),
                "market_position": row.get("market_position"),
                "strategic_opportunity_rank": row.get("strategic_opportunity_rank"),
                "methodology_version": METHODOLOGY_VERSION,
                "source_predictive_version": row.get("predictive_model_version"),
                "source_opportunity_version": row.get("opportunity_version"),
                "build_timestamp": build_timestamp,
            }
        )

    df = pd.DataFrame(records)
    if df.empty:
        raise RuntimeError("No records produced for emerging_medication_intelligence_v1")

    signal_order = {
        "Emerging Priority": 1,
        "Watchlist": 2,
        "Rising": 3,
        "Stable": 4,
        "Declining": 5,
    }
    df["_signal_sort"] = df["emerging_signal"].map(signal_order).fillna(99)
    df = df.sort_values(
        by=["_signal_sort", "strategic_opportunity_rank", "display_name"],
        ascending=[True, True, True],
        na_position="last",
    ).drop(columns=["_signal_sort"])

    df.to_sql("emerging_medication_intelligence_v1", conn, if_exists="replace", index=False)
    return df


def create_executive_watchlist_table(conn: sqlite3.Connection, emerging_df: pd.DataFrame) -> pd.DataFrame:
    watchlist_df = emerging_df[
        emerging_df["emerging_signal"].isin(["Emerging Priority", "Watchlist", "Rising"])
    ].copy()

    signal_order = {
        "Emerging Priority": 1,
        "Watchlist": 2,
        "Rising": 3,
    }
    watchlist_df["_signal_sort"] = watchlist_df["emerging_signal"].map(signal_order).fillna(99)
    watchlist_df = watchlist_df.sort_values(
        by=["_signal_sort", "strategic_opportunity_rank", "display_name"],
        ascending=[True, True, True],
        na_position="last",
    )

    watchlist_df.insert(0, "watchlist_rank", range(1, len(watchlist_df) + 1))
    watchlist_df = watchlist_df.rename(
        columns={
            "emerging_signal": "signal",
            "watch_reason": "reason",
            "executive_action": "recommended_action",
        }
    )[
        [
            "watchlist_rank",
            "rxcui",
            "display_name",
            "signal",
            "reason",
            "recommended_action",
            "methodology_version",
            "build_timestamp",
        ]
    ]

    watchlist_df.to_sql("executive_watchlist_v1", conn, if_exists="replace", index=False)
    return watchlist_df


def classify_class_signal(row: Dict[str, Any]) -> str:
    tier = safe_str(row.get("opportunity_tier")).lower()
    rank = int(row.get("enterprise_opportunity_rank") or row.get("executive_opportunity_rank") or 999999)

    if rank <= 10 or "transformational" in tier:
        return "Emerging Priority"
    if rank <= 50 or "selective" in tier:
        return "Watchlist"
    if rank <= 100:
        return "Rising"
    return "Stable"


def create_emerging_therapeutic_class_table(conn: sqlite3.Connection) -> pd.DataFrame:
    require_table(conn, "ehi_v6_enterprise_opportunities_v1")

    rows = conn.execute(
        """
        SELECT
            portfolio_type,
            portfolio_code,
            portfolio_name,
            medication_count,
            average_ehi_v6_score,
            max_ehi_v6_score,
            enterprise_critical_count,
            strategic_priority_count,
            enterprise_opportunity_rank,
            executive_opportunity_rank,
            opportunity_tier,
            opportunity_interpretation,
            recommended_action,
            opportunity_use_case,
            opportunity_version
        FROM ehi_v6_enterprise_opportunities_v1
        """
    ).fetchall()

    records = []
    build_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for raw in rows:
        row = dict(raw)
        signal = classify_class_signal(row)
        records.append(
            {
                "portfolio_type": row.get("portfolio_type"),
                "portfolio_code": row.get("portfolio_code"),
                "portfolio_name": row.get("portfolio_name"),
                "emerging_signal": signal,
                "opportunity_tier": row.get("opportunity_tier"),
                "portfolio_context": row.get("opportunity_interpretation"),
                "recommended_action": row.get("recommended_action"),
                "opportunity_use_case": row.get("opportunity_use_case"),
                "enterprise_opportunity_rank": row.get("enterprise_opportunity_rank"),
                "executive_opportunity_rank": row.get("executive_opportunity_rank"),
                "medication_count": row.get("medication_count"),
                "enterprise_critical_count": row.get("enterprise_critical_count"),
                "strategic_priority_count": row.get("strategic_priority_count"),
                "methodology_version": METHODOLOGY_VERSION,
                "source_opportunity_version": row.get("opportunity_version"),
                "build_timestamp": build_timestamp,
            }
        )

    df = pd.DataFrame(records)
    signal_order = {
        "Emerging Priority": 1,
        "Watchlist": 2,
        "Rising": 3,
        "Stable": 4,
        "Declining": 5,
    }
    df["_signal_sort"] = df["emerging_signal"].map(signal_order).fillna(99)
    df = df.sort_values(
        by=["_signal_sort", "enterprise_opportunity_rank", "portfolio_name"],
        ascending=[True, True, True],
        na_position="last",
    ).drop(columns=["_signal_sort"])

    df.to_sql("emerging_therapeutic_class_v1", conn, if_exists="replace", index=False)
    return df


def create_summary_table(conn: sqlite3.Connection, emerging_df: pd.DataFrame, watchlist_df: pd.DataFrame, class_df: pd.DataFrame) -> pd.DataFrame:
    summary_records = [
        {
            "metric": "methodology_version",
            "value": METHODOLOGY_VERSION,
        },
        {
            "metric": "build_timestamp",
            "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        },
        {
            "metric": "emerging_medication_rows",
            "value": len(emerging_df),
        },
        {
            "metric": "executive_watchlist_rows",
            "value": len(watchlist_df),
        },
        {
            "metric": "emerging_therapeutic_class_rows",
            "value": len(class_df),
        },
        {
            "metric": "emerging_priority_medications",
            "value": int((emerging_df["emerging_signal"] == "Emerging Priority").sum()),
        },
        {
            "metric": "watchlist_medications",
            "value": int((emerging_df["emerging_signal"] == "Watchlist").sum()),
        },
        {
            "metric": "rising_medications",
            "value": int((emerging_df["emerging_signal"] == "Rising").sum()),
        },
        {
            "metric": "visible_score_created",
            "value": "No",
        },
        {
            "metric": "primary_artifact",
            "value": "Forward-looking emerging signal, watch reason, and executive action",
        },
    ]

    summary_df = pd.DataFrame(summary_records)
    summary_df.to_sql("h4a1_emerging_intelligence_summary_v1", conn, if_exists="replace", index=False)
    return summary_df


def main() -> None:
    project_root = resolve_project_root()
    db_path = resolve_db_path(project_root)
    output_dir = project_root / "healthcare_intelligence" / "outputs" / "h4a1_emerging_medication_intelligence"
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 80)
    print("H4A.1 — Emerging Medication Intelligence Productization")
    print("=" * 80)
    print(f"Project root: {project_root}")
    print(f"Database path: {db_path}")
    print(f"Output folder: {output_dir}")
    print("-" * 80)

    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row

        emerging_df = create_emerging_medication_table(conn)
        watchlist_df = create_executive_watchlist_table(conn, emerging_df)
        class_df = create_emerging_therapeutic_class_table(conn)
        summary_df = create_summary_table(conn, emerging_df, watchlist_df, class_df)

        conn.commit()

    emerging_df.to_csv(output_dir / "emerging_medication_intelligence_v1.csv", index=False)
    watchlist_df.to_csv(output_dir / "executive_watchlist_v1.csv", index=False)
    class_df.to_csv(output_dir / "emerging_therapeutic_class_v1.csv", index=False)
    summary_df.to_csv(output_dir / "h4a1_emerging_intelligence_summary_v1.csv", index=False)

    with pd.ExcelWriter(output_dir / "h4a1_emerging_medication_intelligence_report.xlsx") as writer:
        summary_df.to_excel(writer, sheet_name="summary", index=False)
        emerging_df.head(500).to_excel(writer, sheet_name="emerging_medications", index=False)
        watchlist_df.head(500).to_excel(writer, sheet_name="executive_watchlist", index=False)
        class_df.head(500).to_excel(writer, sheet_name="therapeutic_classes", index=False)

    print(f"Created table: emerging_medication_intelligence_v1 ({len(emerging_df):,} rows)")
    print(f"Created table: executive_watchlist_v1 ({len(watchlist_df):,} rows)")
    print(f"Created table: emerging_therapeutic_class_v1 ({len(class_df):,} rows)")
    print("-" * 80)
    print(summary_df.to_string(index=False))
    print("-" * 80)
    print("Top emerging medication signals:")
    print(
        emerging_df[
            ["rxcui", "display_name", "emerging_signal", "market_position", "strategic_opportunity_tier"]
        ].head(25).to_string(index=False)
    )
    print("-" * 80)
    print("H4A.1 complete.")


if __name__ == "__main__":
    main()

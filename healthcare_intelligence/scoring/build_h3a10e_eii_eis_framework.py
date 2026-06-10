import os
import sqlite3
from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(
    os.environ.get(
        "RXNORM_DB_PATH",
        PROJECT_ROOT / "database" / "rxnorm_research.db",
    )
)

OUTPUT_DIR = PROJECT_ROOT / "healthcare_intelligence" / "outputs" / "H3A10E_executive_impact_framework"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def normalize_score(series: pd.Series) -> pd.Series:
    values = pd.to_numeric(series, errors="coerce").fillna(0)
    return values.clip(lower=0, upper=100)


def tier_from_percentile(percentile: float) -> str:
    if percentile >= 99:
        return "Executive Critical"
    if percentile >= 95:
        return "Strategic Priority"
    if percentile >= 85:
        return "Enterprise High"
    if percentile >= 60:
        return "Operationally Relevant"
    return "Foundational"


def main():
    print("=" * 80)
    print("H3A.10E — Enterprise Intelligence Index + Executive Impact Score")
    print("=" * 80)
    print(f"Database: {DB_PATH}")
    print(f"Output:   {OUTPUT_DIR}")

    conn = sqlite3.connect(DB_PATH)

    base = pd.read_sql_query(
        """
        SELECT
            d.rxcui,
            COALESCE(d.rxnorm_name, d.drug_name) AS drug_name,

            v6.ehi_v6_score,
            v6.ehi_v6_rank,
            v6.ehi_v6_percentile,
            v6.ehi_v6_tier_label,
            v6.ehi_v6_validation_score,
            v6.ehi_v6_validation_status,

            d.ai_readiness_score,
            d.claims_readiness_score,
            d.clinical_semantics_score,
            d.semantic_richness_score,
            d.explainability_score,
            d.overall_intelligence_score,

            COALESCE(g.graph_connectivity_score, 0) AS knowledge_graph_score,
            COALESCE(g.node_count, 0) AS graph_node_count,
            COALESCE(g.edge_count, 0) AS graph_edge_count
        FROM drug_intelligence_master_v1 d
        LEFT JOIN ehi_v6_production_master v6
            ON d.rxcui = v6.rxcui
        LEFT JOIN knowledge_graph_metrics_v1 g
            ON d.rxcui = g.rxcui
        WHERE d.rxcui IS NOT NULL
        """,
        conn,
    )

    if base.empty:
        raise RuntimeError("No rows returned. Check drug_intelligence_master_v1 and joins.")

    # ------------------------------------------------------------------
    # H3A.10E.1 — Enterprise Intelligence Index
    # ------------------------------------------------------------------

    base["ehi_v6_score_num"] = normalize_score(base["ehi_v6_score"])
    base["ai_readiness_score_num"] = normalize_score(base["ai_readiness_score"])
    base["claims_readiness_score_num"] = normalize_score(base["claims_readiness_score"])
    base["clinical_semantics_score_num"] = normalize_score(base["clinical_semantics_score"])
    base["knowledge_graph_score_num"] = normalize_score(base["knowledge_graph_score"])
    base["explainability_score_num"] = normalize_score(base["explainability_score"])

    eii_weights = {
        "ehi_v6_score_num": 0.30,
        "ai_readiness_score_num": 0.20,
        "claims_readiness_score_num": 0.15,
        "clinical_semantics_score_num": 0.15,
        "knowledge_graph_score_num": 0.10,
        "explainability_score_num": 0.10,
    }

    base["eii_score"] = sum(base[col] * weight for col, weight in eii_weights.items()).round(4)
    base["eii_rank"] = base["eii_score"].rank(method="min", ascending=False).astype(int)
    base["eii_percentile"] = (base["eii_score"].rank(pct=True) * 100).round(6)
    base["eii_tier"] = base["eii_percentile"].apply(tier_from_percentile)

    eii_master = base[
        [
            "rxcui",
            "drug_name",
            "eii_score",
            "eii_rank",
            "eii_percentile",
            "eii_tier",
            "ehi_v6_score",
            "ai_readiness_score",
            "claims_readiness_score",
            "clinical_semantics_score",
            "knowledge_graph_score",
            "explainability_score",
        ]
    ].copy()

    eii_master["eii_framework_version"] = "H3A10E_EII_MASTER_V1"
    eii_master["eii_weighting_method"] = (
        "Transparent weighted framework combining healthcare importance, AI readiness, "
        "claims readiness, clinical semantics, knowledge graph maturity, and explainability."
    )

    # ------------------------------------------------------------------
    # H3A.10E.2 — Executive Impact Score
    # ------------------------------------------------------------------

    base["validation_score_num"] = normalize_score(base["ehi_v6_validation_score"])

    # Proxy metrics until dedicated portfolio/deployment models exist.
    base["portfolio_value_score"] = (
        0.50 * base["ehi_v6_score_num"]
        + 0.30 * base["claims_readiness_score_num"]
        + 0.20 * base["clinical_semantics_score_num"]
    ).round(4)

    base["strategic_opportunity_score"] = (
        0.45 * base["ehi_v6_score_num"]
        + 0.25 * base["ai_readiness_score_num"]
        + 0.20 * base["knowledge_graph_score_num"]
        + 0.10 * base["explainability_score_num"]
    ).round(4)

    base["deployment_readiness_score"] = (
        0.35 * base["ai_readiness_score_num"]
        + 0.30 * base["claims_readiness_score_num"]
        + 0.20 * base["knowledge_graph_score_num"]
        + 0.15 * base["validation_score_num"]
    ).round(4)

    eis_weights = {
        "ehi_v6_score_num": 0.25,
        "eii_score": 0.25,
        "validation_score_num": 0.15,
        "portfolio_value_score": 0.15,
        "strategic_opportunity_score": 0.10,
        "deployment_readiness_score": 0.10,
    }

    base["eis_score"] = sum(base[col] * weight for col, weight in eis_weights.items()).round(4)
    base["eis_rank"] = base["eis_score"].rank(method="min", ascending=False).astype(int)
    base["eis_percentile"] = (base["eis_score"].rank(pct=True) * 100).round(6)
    base["eis_tier"] = base["eis_percentile"].apply(tier_from_percentile)

    eis_master = base[
        [
            "rxcui",
            "drug_name",
            "eis_score",
            "eis_rank",
            "eis_percentile",
            "eis_tier",
            "ehi_v6_score",
            "eii_score",
            "ehi_v6_validation_score",
            "portfolio_value_score",
            "strategic_opportunity_score",
            "deployment_readiness_score",
        ]
    ].copy()

    eis_master["eis_framework_version"] = "H3A10E_EIS_MASTER_V1"
    eis_master["eis_weighting_method"] = (
        "Executive impact framework combining healthcare importance, enterprise intelligence, "
        "validation strength, portfolio value, strategic opportunity, and deployment readiness."
    )

    # ------------------------------------------------------------------
    # Persist CSV outputs
    # ------------------------------------------------------------------

    eii_csv = OUTPUT_DIR / "eii_master_v1.csv"
    eis_csv = OUTPUT_DIR / "eis_master_v1.csv"
    eii_master.to_csv(eii_csv, index=False)
    eis_master.to_csv(eis_csv, index=False)

    eii_weights_df = pd.DataFrame(
        [{"input": key, "weight": value} for key, value in eii_weights.items()]
    )
    eis_weights_df = pd.DataFrame(
        [{"input": key, "weight": value} for key, value in eis_weights.items()]
    )

    eii_weights_df.to_csv(OUTPUT_DIR / "eii_weight_framework_v1.csv", index=False)
    eis_weights_df.to_csv(OUTPUT_DIR / "eis_weight_framework_v1.csv", index=False)

    # ------------------------------------------------------------------
    # Persist SQLite tables
    # ------------------------------------------------------------------

    eii_master.to_sql("eii_master_v1", conn, if_exists="replace", index=False)
    eis_master.to_sql("eis_master_v1", conn, if_exists="replace", index=False)

    conn.commit()

    # ------------------------------------------------------------------
    # QA outputs
    # ------------------------------------------------------------------

    summary = pd.DataFrame(
        [
            {
                "framework": "EII",
                "table": "eii_master_v1",
                "row_count": len(eii_master),
                "top_drug": eii_master.sort_values("eii_rank").iloc[0]["drug_name"],
                "top_score": eii_master.sort_values("eii_rank").iloc[0]["eii_score"],
            },
            {
                "framework": "EIS",
                "table": "eis_master_v1",
                "row_count": len(eis_master),
                "top_drug": eis_master.sort_values("eis_rank").iloc[0]["drug_name"],
                "top_score": eis_master.sort_values("eis_rank").iloc[0]["eis_score"],
            },
        ]
    )

    summary.to_csv(OUTPUT_DIR / "H3A10E_execution_summary.csv", index=False)

    whitepaper = OUTPUT_DIR / "H3A10E_EII_EIS_Methodology_Whitepaper.md"
    whitepaper.write_text(
        """# H3A.10E Methodology Whitepaper

## Layer 1 — Healthcare Importance Score (EHI)

EHI V6 measures healthcare importance using a statistically calibrated framework based on utilization, spend, population impact, disease burden, and risk. It answers: how important is this medication to healthcare?

## Layer 2 — Enterprise Intelligence Index (EII)

EII measures whether a medication is usable and valuable inside an enterprise intelligence platform.

Inputs:
- EHI V6
- AI Readiness
- Claims Readiness
- Clinical Semantics
- Knowledge Graph Score
- Explainability

EII answers: how enterprise-ready is this medication for analytics, AI, claims, semantic search, and decision support?

## Layer 3 — Executive Impact Score (EIS)

EIS measures business and strategic impact.

Inputs:
- EHI
- EII
- Validation Score
- Portfolio Value
- Strategic Opportunity
- Deployment Readiness

EIS answers: how much executive-level value does this medication create for payers, PBMs, consultants, pharma, health systems, and AI-enabled healthcare platforms?

## Methodology Position

EHI remains the healthcare importance foundation.
EII adds platform intelligence and usability.
EIS adds executive strategy, deployment value, and business impact.

Together, these form a complete hierarchy:

Healthcare Importance → Enterprise Intelligence → Executive Impact
""",
        encoding="utf-8",
    )

    print("\nCreated:")
    print(f"- {eii_csv}")
    print(f"- {eis_csv}")
    print(f"- {OUTPUT_DIR / 'H3A10E_EII_EIS_Methodology_Whitepaper.md'}")
    print("\nSQLite tables created:")
    print("- eii_master_v1")
    print("- eis_master_v1")
    print("\nSummary:")
    print(summary.to_string(index=False))

    conn.close()


if __name__ == "__main__":
    main()
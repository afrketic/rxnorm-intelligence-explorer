# EHI V6 Production Methodology Whitepaper

## Sprint
H3A.10C — Production EHI V6 Framework

## Purpose
EHI V6 converts the H3A.10B machine learning weight discovery research into a production-ready, transparent, auditable healthcare importance scoring model. The goal is to preserve mathematical credibility while keeping the production score interpretable for healthcare executives, payers, PBMs, consultants, analysts, and platform users.

## Core Architecture
EHI V6 intentionally separates **Healthcare Importance** from **Platform Intelligence**.

### Tier 1: Healthcare Importance Core
Included in EHI V6:

- Utilization Score
- Spend Score
- Population Impact Score
- Disease Burden Score
- Risk Score

These inputs answer: **How important is this medication to healthcare?**

### Tier 2: Platform Intelligence Layer
Excluded from EHI V6 production weighting:

- AI Readiness
- Claims Readiness
- Clinical Semantics
- Knowledge Graph
- Explainability

These inputs answer: **How useful is this medication inside the intelligence platform?** They are intentionally reserved for a future Enterprise Intelligence Index or Executive Impact Score.

## Weight Selection Methodology
Weights are not selected heuristically. They are informed by multiple statistical and machine learning approaches:

- Correlation analysis
- Sensitivity testing
- Linear regression coefficients
- Random forest feature importance
- Gradient boosting / XGBoost importance
- SHAP-style explainability
- Principal component analysis
- Healthcare domain prior weighting

Final production weights use a hybrid framework: **70% statistical evidence and 30% healthcare domain expertise**. The production model remains a transparent weighted scoring model rather than a black-box ML score.

## Production Weights
- Utilization: 39.1%
- Spend: 21.9%
- Population Impact: 16.8%
- Disease Burden: 13.8%
- Risk: 8.4%

## Production Scoring Formula
For each medication, EHI V6 is calculated as:

```text
EHI V6 Score =
  (0.390672 × Utilization Score) +
  (0.218951 × Spend Score) +
  (0.167786 × Population Impact Score) +
  (0.138309 × Disease Burden Score) +
  (0.084282 × Risk Score)
```

## Tier Calibration
EHI V6 tiers are percentile-calibrated with a distribution sanity check.

| Tier | Percentile Rule | Interpretation |
|---|---:|---|
| Strategic Priority | >= 97 | Highest enterprise healthcare importance; executive monitoring and portfolio prioritization recommended. |
| Enterprise Critical | >= 90 | High enterprise importance with strong operational, clinical, or economic relevance. |
| High Importance | >= 75 | Material medication importance for analytics, monitoring, and healthcare intelligence workflows. |
| Moderate Importance | >= 50 | Relevant medication intelligence profile with moderate enterprise impact. |
| Foundational | < 50 | Baseline medication importance; retain for completeness and long-tail intelligence coverage. |

## Validation Framework
The EHI V6 validation score summarizes production readiness across coverage, correlation quality, sensitivity stability, tier stability, and model fit.

**Healthcare Importance Validation Score: 92.5/100 — Validated.**

## Production Outputs
H3A.10C creates the following production assets:

- `ehi_v6_weight_framework_v1.csv`
- `ehi_v6_validation_framework_v1.csv`
- `ehi_v6_tier_calibration_v1.csv`
- `ehi_v6_production_master.csv`
- `ehi_v6_production_top100.csv`
- `ehi_v6_dashboard_methodology_language.txt`

## Dashboard Language
EHI V6 should be described as a statistically calibrated healthcare importance score. It should not be positioned as an AI readiness score, claims readiness score, or knowledge graph score. Those platform intelligence signals remain separate and can later support an Executive Impact Score.

## Limitation
EHI V6 is a healthcare importance model. It does not directly measure clinical appropriateness, therapeutic effectiveness, drug safety in isolation, prescribing recommendation, or platform readiness. It is intended for enterprise healthcare intelligence prioritization and portfolio-level interpretation.

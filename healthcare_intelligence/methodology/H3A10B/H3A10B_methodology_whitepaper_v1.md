# H3A.10B — Machine Learning Weight Discovery Framework

## Executive Result

Selected source file: `enterprise_healthcare_importance_master.csv`.

Reason: Selected enterprise_healthcare_importance_master.csv because it contains the pure Tier 1 EHI foundation inputs and production ehi_score target: utilization, spend, population impact, disease burden, and risk. The v2 calibrated file includes external evidence calibration fields, which are valuable later but less pure for this H3A.10B healthcare-importance-only weight discovery sprint.

Healthcare Importance was kept conceptually pure. The model uses only Tier 1 healthcare importance inputs:

- Utilization
- Spend
- Population Impact
- Disease Burden
- Risk

No AI Readiness, Claims Readiness, Clinical Semantics, Knowledge Graph, or Explainability signals were included in the EHI weight model. Those belong to a separate Platform Intelligence layer.

## Dataset

- Records analyzed: 30,132
- Target variable: `ehi_score`
- Feature variables: Utilization, Spend, Population Impact, Disease Burden, Risk

## Model Performance

| Model | R² | MAE | RMSE |
|---|---:|---:|---:|
| Linear Regression | 1.0000 | 0.0016 | 0.0022 |
| Random Forest | 0.9997 | 0.1919 | 0.4228 |
| XGBoost | 0.9998 | 0.1897 | 0.3538 |

## Recommended V6 Hybrid Weights

Weights were selected using a 70% statistical evidence / 30% healthcare domain expertise framework. Statistical evidence combines linear regression coefficient importance, random forest permutation importance, XGBoost SHAP importance, and PCA weighted loading importance.

| Variable | ML Consensus Importance | Domain Prior | V6 Recommended Weight |
|---|---:|---:|---:|
| Utilization | 45.10% | 25.0% | 39.07% |
| Spend | 20.56% | 25.0% | 21.90% |
| Population Impact | 15.40% | 20.0% | 16.78% |
| Disease Burden | 11.19% | 20.0% | 13.83% |
| Risk | 7.75% | 10.0% | 8.43% |

## Validation Score

Healthcare Importance Validation Score: **92.5 / 100 — Validated**

Component scores:

- Coverage: 100.0
- Correlation Quality: 65.7
- Sensitivity Stability: 99.7
- Tier Stability: 96.3
- Model Fit: 100.0

## Tier Methodology

Recommended V6 tiering uses percentile-calibrated boundaries with distribution sanity checks:

- Strategic Priority: Top 3%
- Enterprise Critical: Top 10%
- High Importance: Top 25%
- Moderate Importance: Top 50%
- Foundational: Bottom 50%

## Methodology Language

Weights are not selected heuristically. We evaluated multiple statistical and machine learning models across 30,132 medications, including correlation analysis, sensitivity testing, linear regression coefficients, random forest feature importance, XGBoost SHAP explainability, and principal component analysis. Final production weights were selected using a hybrid framework combining 70% statistical evidence and 30% healthcare domain expertise. This preserves transparency while grounding the score in empirical evidence.

The Healthcare Importance Score should remain distinct from Platform Intelligence. Healthcare Importance measures real-world medication importance. Platform Intelligence measures how useful a medication is inside the intelligence platform. Future executive and whitepaper versions can combine both as separate layers rather than collapsing them into one black-box score.

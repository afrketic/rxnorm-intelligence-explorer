export type ExecutiveFrameworkProfile = {
  score?: number | string | null;
  rank?: number | string | null;
  percentile?: number | string | null;
  tier?: string | null;
  tier_label?: string | null;
  validation_score?: number | string | null;
  validation_status?: string | null;
  framework_version?: string | null;
  weighting_method?: string | null;
  dashboard_language?: string | null;
  portfolio_value_score?: number | string | null;
  strategic_opportunity_score?: number | string | null;
  deployment_readiness_score?: number | string | null;
  raw?: Record<string, any>;
  [key: string]: any;
};


export type DiseaseBurdenForecastProfile = {
  available?: boolean;
  disease_domain?: string | null;
  canonical_disease_name?: string | null;
  current_prevalence?: number | string | null;
  current_mortality?: number | string | null;
  population_burden_tier?: string | null;
  trend_signal?: 'Accelerating' | 'Growing' | 'Stable' | 'Declining' | 'Not Available' | string | null;
  burden_trend_signal?: 'Accelerating' | 'Growing' | 'Stable' | 'Declining' | 'Not Available' | string | null;
  forecast_narrative?: string | null;
  forecast_version?: string | null;
  source_year?: string | number | null;
  source_dataset?: string | null;
  raw?: Record<string, any>;
  [key: string]: any;
};

export type DrugCard = {
  rxcui: string;
  drug_name?: string;
  display_name?: string;
  rxnorm_name?: string;
  name?: string;
  tty?: string;
  benchmark_tier?: string;
  tier?: string;
  overall_intelligence_score?: number;
  claims_readiness_score?: number;
  ai_readiness_score?: number;
  semantic_richness_score?: number;
  interoperability_score?: number;
  clinical_semantics_score?: number;
  ehi_v6?: ExecutiveFrameworkProfile;
  eii?: ExecutiveFrameworkProfile;
  eis?: ExecutiveFrameworkProfile;
  executive_impact?: Record<string, any>;
  [key: string]: any;
};

export type ClassificationItem = {
  class_type?: string;
  class_id?: string;
  class_name?: string;
  class_url?: string;
  rela?: string;
  rela_source?: string;
  [key: string]: any;
};

export type ClassificationBuckets = Record<string, ClassificationItem[]>;

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8000';

async function requestJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function getWebsiteSummary() {
  return requestJson<any[]>('/website/summary');
}

export async function searchDrugs(query: string, limit = 30) {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    offset: '0',
  });

  return requestJson<DrugCard[]>(`/explorer/drugs?${params.toString()}`);
}

export async function getDrug(rxcui: string) {
  const data = await requestJson<any>(
    `/explorer/drug-detail/${encodeURIComponent(String(rxcui))}`
  );

  const classifications = data.classifications || data.drug?.classifications || {};
  const scorecard = {
    ...(data.scorecard || {}),
    ...(data.ehi_v6
      ? {
          ehi_v6_score: data.ehi_v6.score,
          ehi_v6_rank: data.ehi_v6.rank,
          ehi_v6_percentile: data.ehi_v6.percentile,
          ehi_v6_tier_label: data.ehi_v6.tier_label,
          ehi_v6_validation_score: data.ehi_v6.validation_score,
          ehi_v6_validation_status: data.ehi_v6.validation_status,
        }
      : {}),
    ...(data.eii
      ? {
          eii_score: data.eii.score,
          eii_rank: data.eii.rank,
          eii_percentile: data.eii.percentile,
          eii_tier: data.eii.tier,
        }
      : {}),
    ...(data.eis
      ? {
          eis_score: data.eis.score,
          eis_rank: data.eis.rank,
          eis_percentile: data.eis.percentile,
          eis_tier: data.eis.tier,
        }
      : {}),
  };

  return {
    ...data,
    classifications,
    scorecard,
    drug: {
      ...(data.drug || {}),
      classifications,
      scorecard,
      ehi_v6: data.ehi_v6,
      eii: data.eii,
      eis: data.eis,
      executive_impact: data.executive_impact,
    },
  };
}

export async function getTable(tableName: string, limit = 100) {
  return requestJson<any[]>(`/tables/${encodeURIComponent(tableName)}?limit=${limit}`);
}

export type AtcClassDrug = DrugCard & {
  matching_class_count?: number;
};

export type AtcClassNode = {
  code?: string;
  class_id?: string;
  label?: string;
  class_name?: string;
  level?: number;
  class_type?: string;
  drug_count?: number;
  [key: string]: any;
};

export type AtcClassPayload = {
  atc_code: string;
  code?: string;
  class_id?: string;
  atc_name?: string;
  class_name?: string;
  label?: string;
  level?: number;
  class_type?: string;
  parent_pathway?: AtcClassNode[];
  pathway?: AtcClassNode[];
  children?: AtcClassNode[];
  child_classes?: AtcClassNode[];
  metrics?: Record<string, any>;
  hierarchy_analytics?: Record<string, any>;
  descendant_levels?: AtcClassNode[] | Record<string, any>[];
  landscape_intelligence?: Record<string, any>;
  peer_classes?: AtcClassNode[];
  sibling_classes?: AtcClassNode[];
  parent_benchmarks?: AtcClassNode[];
  category_benchmark?: AtcClassNode | null;
  domain_benchmark?: AtcClassNode | null;
  rollup_scope?: string;
  rollup_mode?: string;
  rollup_description?: string;
  descendant_class_count?: number;
  drug_count?: number;
  average_intelligence?: number | null;
  average_claims_readiness?: number | null;
  average_ai_readiness?: number | null;
  average_semantic_richness?: number | null;
  average_interoperability?: number | null;
  top_drugs?: AtcClassDrug[];
  bottom_drugs?: AtcClassDrug[];
  drugs?: AtcClassDrug[];
  aggregation_source?: string;
  aggregation_version?: string;
  [key: string]: any;
};

export async function getAtcClass(atcCode: string, limit = 25) {
  const params = new URLSearchParams({ limit: String(limit) });
  return requestJson<AtcClassPayload>(`/atc/${encodeURIComponent(String(atcCode))}?${params.toString()}`);
}

export type EnterpriseHealthcareImportance = {
  rxcui: string;
  drug_name?: string;
  display_name?: string;

  ehi_score?: number;
  ehi_rank?: number;
  ehi_percentile?: number;
  ehi_tier?: number | string;
  ehi_tier_label?: string;

  ehi_version?: string;
  dashboard_ehi_version?: string;
  dashboard_status?: string;
  dashboard_source_table?: string;

  primary_driver?: string;
  secondary_driver?: string;
  limiting_factor?: string;
  driver_explanation?: string;
  limiting_factor_explanation?: string;

  methodology_version?: string;
  calculation_date?: string;

  utilization_score?: number;
  spend_score?: number;
  disease_burden_score?: number;
  population_impact_score?: number;
  risk_score?: number;
  external_evidence_score?: number;
  cdc_burden_score?: number;

  current_v5_dashboard_score?: number;
  current_v5_dashboard_rank?: number;
  score_change_current_v5_to_v6?: number;
  rank_change_current_v5_to_v6?: number;

  population_size?: number;
  top_population_share_pct?: number;
  benchmark_label?: string;

  weights?: Record<string, number>;

  methodology?: {
    name?: string;
    version?: string;
    methodology_version?: string;
    status?: string;
    description?: string;
    [key: string]: any;
  };

  [key: string]: any;
};

export async function getEnterpriseHealthcareImportance(
  rxcui: string
): Promise<EnterpriseHealthcareImportance> {
  return requestJson<EnterpriseHealthcareImportance>(
    `/enterprise-healthcare-importance/${encodeURIComponent(String(rxcui))}`
  );
}


export type EnterpriseHealthcareImportanceV2 = {
  rxcui: string;
  drug_name?: string;
  ehi_v1?: {
    score?: number;
    rank?: number;
    tier?: string;
    [key: string]: any;
  };
  ehi_v2?: {
    score?: number;
    rank?: number;
    percentile?: number;
    tier?: string;
    rank_change?: number;
    score_change?: number;
    methodology_version?: string;
    calculation_date?: string;
    [key: string]: any;
  };
  domain_scores?: {
    utilization_score?: number;
    spend_score?: number;
    disease_burden_score?: number;
    population_impact_score?: number;
    risk_score?: number;
    external_evidence_score?: number;
    external_evidence_score_calibrated?: number;
    external_evidence_boost?: number;
    [key: string]: any;
  };
  cms_external_evidence?: {
    has_cms_external_evidence?: boolean;
    cms_drug_name?: string;
    cms_spend?: number;
    cms_utilization?: number;
    cms_beneficiary_count?: number;
    cms_spend_score?: number;
    cms_utilization_score?: number;
    cms_spend_rank?: number;
    cms_utilization_rank?: number;
    mapping_method?: string;
    mapping_confidence?: number;
    manual_review_flag?: number;
    calendar_year?: number;
    [key: string]: any;
  };
  explainability?: {
    primary_driver?: string;
    secondary_driver?: string;
    limiting_factor?: string;
    calibration_method?: string;
    [key: string]: any;
  };
  methodology?: {
    version?: string;
    external_evidence_weight?: number;
    external_evidence_neutral_floor?: number;
    description?: string;
    [key: string]: any;
  };
  raw?: Record<string, any>;
  [key: string]: any;
};

export async function getEnterpriseHealthcareImportanceV2(
  rxcui: string
): Promise<EnterpriseHealthcareImportanceV2> {
  return requestJson<EnterpriseHealthcareImportanceV2>(
    `/enterprise-healthcare-importance-v2/${encodeURIComponent(String(rxcui))}`
  );
}



export type EHIValidationBootstrap = {
  rxcui?: string;
  drug_name?: string;
  ehi_score?: number;
  ehi_rank?: number;
  ehi_mean?: number;
  ehi_std?: number;
  ehi_min?: number;
  ehi_max?: number;
  rank_std?: number;
  stability_score?: number;
  bootstrap_iterations?: number;
  bootstrap_method?: string;
  perturbation_sd?: number;
  validation_version?: string;
  build_timestamp?: string;
  [key: string]: any;
};

export type EHIValidationSensitivity = {
  rxcui?: string;
  drug_name?: string;
  expert_rank?: number;
  rank_min?: number;
  rank_max?: number;
  rank_range?: number;
  sensitivity_score?: number;
  scenario_count?: number;
  validation_version?: string;
  build_timestamp?: string;
  [key: string]: any;
};

export type EHIValidationMethodologyAgreement = {
  rxcui?: string;
  drug_name?: string;
  expert_rank?: number;
  equal_rank?: number;
  pca_rank?: number;
  factor_rank?: number;
  ahp_rank?: number;
  rank_std?: number;
  rank_range?: number;
  agreement_score?: number;
  validation_version?: string;
  build_timestamp?: string;
  [key: string]: any;
};

export type EHIValidationConfidenceInterval = {
  rxcui?: string;
  drug_name?: string;
  ehi_score?: number;
  ehi_rank?: number;
  ehi_ci_lower?: number;
  ehi_ci_upper?: number;
  ehi_ci_width?: number;
  confidence_level?: number;
  ci_method?: string;
  bootstrap_stability_score?: number;
  sensitivity_score?: number;
  methodology_agreement_score?: number;
  ci_width_score?: number;
  validation_confidence_score?: number;
  validation_version?: string;
  build_timestamp?: string;
  [key: string]: any;
};

export type EnterpriseHealthcareImportanceValidation = {
  rxcui: string;
  drug_name?: string;
  confidence_interval?: EHIValidationConfidenceInterval | null;
  bootstrap?: EHIValidationBootstrap | null;
  sensitivity?: EHIValidationSensitivity | null;
  methodology_agreement?: EHIValidationMethodologyAgreement | null;
  validation_version?: string;
  validation_tier?: string;
  validation_interpretation?: string;
  [key: string]: any;
};

export async function getEnterpriseHealthcareImportanceValidation(
  rxcui: string
): Promise<EnterpriseHealthcareImportanceValidation> {
  return requestJson<EnterpriseHealthcareImportanceValidation>(
    `/enterprise-healthcare-importance-validation/${encodeURIComponent(String(rxcui))}`
  );
}


export type PortfolioIntelligenceItem = {
  portfolio_type?: string;
  portfolio_code?: string | null;
  portfolio_name?: string;
  primary_therapeutic_domain_code?: string;
  primary_therapeutic_domain_name?: string;
  atc_level?: string;
  atc_code?: string;
  atc_name?: string;
  disease_name?: string;
  medication_count?: number;
  average_ehi_v6_score?: number;
  max_ehi_v6_score?: number;
  enterprise_critical_count?: number;
  strategic_priority_count?: number;
  portfolio_importance_score?: number;
  portfolio_rank?: number;
  source_portfolio_rank?: number;
  executive_opportunity_rank?: number;
  portfolio_version?: string;
  calibration_version?: string;
  calibration_rule?: string;
  [key: string]: any;
};

export async function getTherapeuticPortfolios(limit = 10): Promise<PortfolioIntelligenceItem[]> {
  return requestJson<PortfolioIntelligenceItem[]>(`/portfolio/therapeutic?limit=${encodeURIComponent(String(limit))}`);
}

export async function getAtcPortfolios(atcLevel = 'ATC4', limit = 10): Promise<PortfolioIntelligenceItem[]> {
  const params = new URLSearchParams({ atc_level: atcLevel, limit: String(limit) });
  return requestJson<PortfolioIntelligenceItem[]>(`/portfolio/atc?${params.toString()}`);
}

export async function getDiseasePortfolios(limit = 10): Promise<PortfolioIntelligenceItem[]> {
  return requestJson<PortfolioIntelligenceItem[]>(`/portfolio/disease?limit=${encodeURIComponent(String(limit))}`);
}

export async function getPortfolioTopOpportunities(limit = 10): Promise<PortfolioIntelligenceItem[]> {
  return requestJson<PortfolioIntelligenceItem[]>(`/portfolio/top-opportunities?limit=${encodeURIComponent(String(limit))}`);
}

export async function getPortfolioOpportunity(
  portfolioType: string,
  portfolioCode: string,
): Promise<PortfolioIntelligenceItem> {
  return requestJson<PortfolioIntelligenceItem>(
    `/portfolio/opportunity/${encodeURIComponent(String(portfolioType))}/${encodeURIComponent(String(portfolioCode))}`,
  );
}

export async function getDiseaseBurdenForecasting(
  limit = 25,
  signal?: string,
): Promise<DiseaseBurdenForecastProfile[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (signal) params.set('signal', signal);
  return requestJson<DiseaseBurdenForecastProfile[]>(`/disease-burden/forecasting?${params.toString()}`);
}

export async function getDiseaseBurdenForecastingSummary(): Promise<Array<{ burden_trend_signal?: string; disease_area_count?: number; [key: string]: any }>> {
  return requestJson<Array<{ burden_trend_signal?: string; disease_area_count?: number; [key: string]: any }>>('/disease-burden/forecasting/summary');
}



export type EnterpriseOpportunityItem = PortfolioIntelligenceItem & {
  normalized_importance_score?: number;
  portfolio_maturity_score?: number;
  enterprise_opportunity_score?: number;
  enterprise_opportunity_rank?: number;
  opportunity_tier?: string;
  opportunity_interpretation?: string;
  opportunity_version?: string;
  recommended_action?: string;
  opportunity_use_case?: string;
};

export type EnterpriseOpportunitiesByUseCase = {
  use_cases?: Array<{
    opportunity_use_case?: string;
    opportunity_count?: number;
    average_opportunity_score?: number;
    best_rank?: number;
    [key: string]: any;
  }>;
  use_case?: string;
  opportunities?: EnterpriseOpportunityItem[];
  [key: string]: any;
};

export async function getEnterpriseOpportunitiesTop(limit = 10): Promise<EnterpriseOpportunityItem[]> {
  return requestJson<EnterpriseOpportunityItem[]>(`/enterprise-opportunities/top?limit=${encodeURIComponent(String(limit))}`);
}

export async function getEnterpriseOpportunitiesByUseCase(
  useCase?: string,
  limit = 10,
): Promise<EnterpriseOpportunitiesByUseCase> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (useCase) params.set('use_case', useCase);
  return requestJson<EnterpriseOpportunitiesByUseCase>(`/enterprise-opportunities/by-use-case?${params.toString()}`);
}

export async function getEnterpriseOpportunityPortfolio(
  portfolioType: string,
  portfolioCode: string,
): Promise<EnterpriseOpportunityItem> {
  return requestJson<EnterpriseOpportunityItem>(
    `/enterprise-opportunities/portfolio/${encodeURIComponent(String(portfolioType))}/${encodeURIComponent(String(portfolioCode))}`,
  );
}

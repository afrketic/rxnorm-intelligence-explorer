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

  return {
    ...data,
    classifications: data.classifications || data.drug?.classifications || {},
    drug: {
      ...(data.drug || {}),
      classifications: data.classifications || data.drug?.classifications || {},
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

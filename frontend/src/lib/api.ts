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

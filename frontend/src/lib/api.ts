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

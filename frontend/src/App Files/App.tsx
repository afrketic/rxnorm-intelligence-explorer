import { useEffect, useState } from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import MedicationIntelligenceSummaryCard from './components/MedicationIntelligenceSummaryCard';

import DrugSearch from './components/DrugSearch';
import IntelligenceCard from './components/IntelligenceCard';
import ClassificationPanel from './components/ClassificationPanel';
import RelationshipPanel from './components/RelationshipPanel';
import GraphPanel from './components/GraphPanel';

import {
  DrugCard,
  getDrug,
  searchDrugs,
} from './lib/api';

export default function App() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugCard[]>([]);
  const [selected, setSelected] = useState<DrugCard | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [summary, setSummary] = useState<Array<{ metric: string; value: number | string }>>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'classification' | 'relationships' | 'graph'>('classification');

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);

      searchDrugs(query, 30)
        .then((rows) => {
          setResults(rows);

          if (!selected && rows.length) {
            setSelected(rows[0]);
          }
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query, selected]);

  useEffect(() => {
    if (!selected?.rxcui) {
      setDetail(null);
      return;
    }

    getDrug(selected.rxcui)
      .then((response) => {
        console.log('DRUG DETAIL RESPONSE', response);
        setDetail(response);
      })
      .catch((error) => {
        console.error('Failed to load drug detail:', error);
        setDetail(null);
      });
  }, [selected?.rxcui]);

  const activeDrug: DrugCard | null = detail?.drug || selected;

  const drugWithDetails: any = activeDrug
    ? {
        ...activeDrug,
        classifications: detail?.classifications,
        relationships: detail?.relationships,
        graph: detail?.graph,
      }
    : null;

  const chartData = activeDrug
    ? [
        { name: 'Claims', value: activeDrug.claims_readiness_score || 0 },
        { name: 'AI', value: activeDrug.ai_readiness_score || 0 },
        { name: 'Semantic', value: activeDrug.semantic_richness_score || 0 },
        { name: 'Interop', value: activeDrug.interoperability_score || 0 },
        { name: 'Clinical', value: activeDrug.clinical_semantics_score || 0 },
      ]
    : [];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-blue-600">
                Alex Knows AI · Live Demo
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
                RxNorm Intelligence Explorer
              </h1>

              <p className="mt-3 max-w-3xl text-slate-600">
                Production frontend for drug intelligence, benchmark tiers, AI readiness,
                claims readiness, clinical semantics, and knowledge graph exploration.
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[390px_1fr]">
        <DrugSearch
          query={query}
          onQueryChange={setQuery}
          results={results}
          selected={selected}
          onSelect={(drug) => {
            setSelected(drug);
            setDetail(null);
          }}
          loading={loading}
        />

        <div className="space-y-6">
          <IntelligenceCard drug={activeDrug} />

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-slate-950">Readiness Profile</h3>

            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="flex flex-wrap gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
            {(['classification', 'relationships', 'graph'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize ${
                  activeTab === tab
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'classification' && (
            <>
              <DebugBox
                title="Classification Debug"
                data={detail?.classifications?.counts}
              />
              <MedicationIntelligenceSummaryCard drug={drugWithDetails} />

              <ClassificationPanel drug={drugWithDetails} />
            </>
          )}

          {activeTab === 'relationships' && (
            <>
              <DebugBox
                title="Relationship Debug"
                data={detail?.relationships?.counts}
              />

              <RelationshipPanel drug={drugWithDetails} />
            </>
          )}

          {activeTab === 'graph' && (
            <>
              <DebugBox
                title="Graph Debug"
                data={{
                  node_count: detail?.graph?.nodes?.length || 0,
                  edge_count: detail?.graph?.edges?.length || 0,
                }}
              />

              <GraphPanel drug={drugWithDetails} />
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function DebugBox({
  title,
  data,
}: {
  title: string;
  data: unknown;
}) {
  return (
    <div
      style={{
        background: '#f3f4f6',
        border: '1px solid #d1d5db',
        borderRadius: '12px',
        padding: '12px',
        fontSize: '12px',
        color: '#111827',
        overflow: 'auto',
      }}
    >
      <strong>{title}</strong>
      <pre style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}


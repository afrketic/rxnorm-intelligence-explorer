import { DrugCard } from '../lib/api';

export default function RelationshipPanel({ drug }: { drug: DrugCard | null }) {
  const relationshipFields = Object.entries(drug || {}).filter(([key]) =>
    key.toLowerCase().includes('relationship') || key.toLowerCase().includes('ingredient') || key.toLowerCase().includes('dose') || key.toLowerCase().includes('tradename')
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="text-xl font-bold text-slate-950">Relationship Intelligence</h3>
      <p className="mt-1 text-sm text-slate-500">Ingredient, dose form, tradename, and related concept signals from the export layer.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl bg-slate-950 p-5 text-white">
          <p className="text-xs uppercase text-slate-300">Relationship Count</p>
          <p className="mt-2 text-4xl font-bold">{drug?.relationship_count ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-blue-50 p-5 text-blue-950">
          <p className="text-xs uppercase text-blue-600">Relationship Density</p>
          <p className="mt-2 text-4xl font-bold">{drug?.relationship_density_score ?? 0}</p>
        </div>
        <div className="rounded-2xl bg-teal-50 p-5 text-teal-950">
          <p className="text-xs uppercase text-teal-600">Classification Count</p>
          <p className="mt-2 text-4xl font-bold">{drug?.classification_count ?? 0}</p>
        </div>
      </div>
      <div className="mt-5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200">
        {relationshipFields.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No detailed relationship fields found in this API response.</p>
        ) : relationshipFields.map(([key, value]) => (
          <div key={key} className="border-b border-slate-100 p-4 last:border-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{key}</p>
            <p className="mt-1 break-words text-sm text-slate-800">{String(value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

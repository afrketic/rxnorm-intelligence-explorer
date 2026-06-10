import { DrugCard, getWebsiteSummary, searchDrugs, getDrug } from '../lib/api';

type RelationshipItem = {
  source_rxcui?: string;
  related_rxcui?: string;
  related_name?: string;
  related_tty?: string;
  tty?: string;
  relationship_type?: string;
  relationship_source?: string;
  rela?: string;
  rela_source?: string;
};

type RelationshipBuckets = {
  ingredients?: RelationshipItem[];
  tradenames?: RelationshipItem[];
  dose_forms?: RelationshipItem[];
  related_concepts?: RelationshipItem[];
  counts?: {
    ingredients?: number;
    tradenames?: number;
    dose_forms?: number;
    related_concepts?: number;
    raw_relationship_rows?: number;
  };
};

function getRelationshipValue(item: RelationshipItem, keys: string[]) {
  for (const key of keys) {
    const value = (item as any)?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return "-";
}

function RelationshipBucket({
  title,
  items,
}: {
  title: string;
  items: RelationshipItem[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-lg font-bold text-slate-950">{title}</h4>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No relationships found.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const relatedName = getRelationshipValue(item, ["related_name", "name"]);
            const relatedRxcui = getRelationshipValue(item, ["related_rxcui"]);
            const sourceRxcui = getRelationshipValue(item, ["source_rxcui"]);
            const tty = getRelationshipValue(item, ["related_tty", "tty"]);
            const relationshipType = getRelationshipValue(item, [
              "relationship_type",
              "rela",
            ]);
            const relationshipSource = getRelationshipValue(item, [
              "relationship_source",
              "rela_source",
            ]);

            return (
              <div
                key={`${relatedRxcui}-${relatedName}-${index}`}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="text-sm font-bold text-slate-950">
                  {relatedName}
                </div>

                <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                  <div>
                    <span className="font-semibold text-slate-800">
                      Source RxCUI:
                    </span>{" "}
                    {sourceRxcui}
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800">
                      Related RxCUI:
                    </span>{" "}
                    {relatedRxcui}
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800">TTY:</span>{" "}
                    {tty}
                  </div>

                  <div>
                    <span className="font-semibold text-slate-800">
                      Relationship Type:
                    </span>{" "}
                    {relationshipType}
                  </div>

                  <div className="md:col-span-2">
                    <span className="font-semibold text-slate-800">
                      Relationship Source:
                    </span>{" "}
                    {relationshipSource}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RelationshipPanel({
  drug,
}: {
  drug: (DrugCard & { relationships?: RelationshipBuckets }) | null;
}) {
  const relationships: RelationshipBuckets = drug?.relationships || {};

  const ingredients = relationships.ingredients || [];
  const tradenames = relationships.tradenames || [];
  const doseForms = relationships.dose_forms || [];
  const relatedConcepts = relationships.related_concepts || [];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
        <div>
          <h3 className="text-xl font-bold text-slate-950">
            Relationship Intelligence
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Explainable RxNorm relationship network with source, target,
            relationship type, terminology type, and semantic linkage context.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-950">
            {relationships.counts?.raw_relationship_rows ?? 
              ingredients.length +
                tradenames.length +
                doseForms.length +
                relatedConcepts.length}
          </div>
          <div className="text-xs text-slate-500">raw relationship rows</div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <RelationshipBucket title="Ingredients" items={ingredients} />

        <RelationshipBucket title="Trade Names" items={tradenames} />

        <RelationshipBucket title="Dose Forms" items={doseForms} />

        <RelationshipBucket title="Related Concepts" items={relatedConcepts} />
      </div>
    </section>
  );
}
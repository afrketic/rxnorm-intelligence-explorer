import { useMemo } from 'react';
import { ClassificationBuckets, ClassificationItem, DrugCard } from '../lib/api';

export type PathwayNode = {
  code: string;
  label: string;
  level: string;
};

type Props = {
  drug: (DrugCard & Record<string, any>) | null;
  onSelectAtc?: (code: string) => void;
};

const ATC_LEVELS = ['ATC1', 'ATC2', 'ATC3', 'ATC4'];

const ATC_LABEL_FALLBACKS: Record<string, string> = {
  A: 'Alimentary Tract and Metabolism',
  A10: 'Drugs Used in Diabetes',
  A10B: 'Blood Glucose Lowering Drugs',
  A10BJ: 'GLP-1 Analogues',
  B: 'Blood and Blood Forming Organs',
  B01: 'Antithrombotic Agents',
  C: 'Cardiovascular System',
  J: 'Antiinfectives for Systemic Use',
  M: 'Musculo-Skeletal System',
  M01: 'Anti-inflammatory and Antirheumatic Products',
  M01A: 'Anti-inflammatory and Antirheumatic Products, Non-Steroids',
  M01AE: 'Propionic Acid Derivatives',
  N: 'Nervous System',
  R: 'Respiratory System',
};

function clean(value: unknown, fallback = 'Not available') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function getDrugName(drug: any) {
  return clean(
    drug?.display_name ||
      drug?.rxnorm_name ||
      drug?.drug_name ||
      drug?.name ||
      drug?.drug?.rxnorm_name ||
      drug?.drug?.drug_name,
    'Selected medication'
  );
}

function normalizeItem(item: ClassificationItem | null | undefined, level: string): PathwayNode | null {
  if (!item) return null;

  const code = clean(item.class_id || item.classId || item.full_class_id, '');
  const fallbackLabel = ATC_LABEL_FALLBACKS[code] || code;
  const label = clean(item.class_name || item.className || item.full_class_name || fallbackLabel, fallbackLabel);

  if (!code && !label) return null;

  return {
    code: code || label,
    label,
    level,
  };
}

function getPrimaryPathway(drug: any): PathwayNode[] {
  const primary =
    drug?.primary_therapeutic_pathway ||
    drug?.drug?.primary_therapeutic_pathway ||
    null;

  const pathway = primary?.pathway;

  if (Array.isArray(pathway) && pathway.length > 0) {
    return pathway
      .map((item: ClassificationItem, index: number) => normalizeItem(item, ATC_LEVELS[index] || `ATC${index + 1}`))
      .filter(Boolean) as PathwayNode[];
  }

  const classifications: ClassificationBuckets =
    drug?.classifications || drug?.drug?.classifications || {};

  return ATC_LEVELS.map((level) => {
    const items = classifications[level];
    return normalizeItem(Array.isArray(items) ? items[0] : null, level);
  }).filter(Boolean) as PathwayNode[];
}

export function buildTherapeuticPathway(drug: any): PathwayNode[] {
  return getPrimaryPathway(drug);
}

export default function TherapeuticPathway({ drug, onSelectAtc }: Props) {
  const pathway = useMemo(() => getPrimaryPathway(drug), [drug]);
  const drugName = getDrugName(drug);

  if (!drug) return null;

  if (pathway.length === 0) {
    return (
      <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Therapeutic Pathway</p>
        <h3 className="mt-2 text-2xl font-black">ATC pathway not yet populated</h3>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          No ATC hierarchy was returned for {drugName}. Classification details may still be available in the Clinical tab.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-blue-900/50 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/60 p-6 text-white shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-300">Therapeutic Pathway</p>
          <h3 className="mt-2 text-2xl font-black">Therapeutic Pathway</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            This pathway shows where the medication resides within the global therapeutic classification hierarchy.
          </p>
        </div>
        <span className="rounded-full border border-blue-500/60 bg-blue-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
          {pathway.length}/4 ATC depth
        </span>
      </div>

      <div className="mt-6 grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
        {pathway.map((node, index) => (
          <button
            key={`${node.level}-${node.code}-${index}`}
            type="button"
            onClick={() => onSelectAtc?.(node.code)}
            className="group min-h-[165px] rounded-2xl border border-slate-700 bg-slate-950/70 p-4 text-left transition hover:border-blue-400 hover:bg-blue-950/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.20em] text-slate-500">{node.level}</p>
                <p className="mt-1 text-2xl font-black text-white group-hover:text-blue-100">{node.code}</p>
              </div>
              {index < pathway.length - 1 && (
                <span className="rounded-full border border-blue-500/50 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-200">→</span>
              )}
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-200">{node.label}</p>
            <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-blue-300">Open ATC Explorer</p>
          </button>
        ))}
      </div>
    </section>
  );
}

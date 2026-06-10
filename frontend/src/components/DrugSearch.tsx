import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { DrugCard } from '../lib/api';

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  results: DrugCard[];
  selected: DrugCard | null;
  onExplore?: (drug: DrugCard) => void;
  onSelect?: (drug: DrugCard) => void;
  loading?: boolean;
};

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getDrugName(drug: DrugCard, query = '') {
  const raw =
    (drug as any).display_name ||
    (drug as any).drug_name ||
    (drug as any).rxnorm_name ||
    (drug as any).rxnormName ||
    (drug as any).drugName ||
    (drug as any).full_name ||
    (drug as any).fullName ||
    (drug as any).concept_name ||
    (drug as any).conceptName ||
    (drug as any).name ||
    (drug as any).label ||
    '';

  const clean = String(raw || '').trim();

  if (clean && !/^rxcui\s+\d+$/i.test(clean) && !/^\d+$/.test(clean)) {
    return clean;
  }

  return query.trim() ? titleCase(query) : 'Medication result';
}

function getSubtitle(drug: DrugCard) {
  const fields = [
    (drug as any).tty_normalized,
    (drug as any).tty,
    (drug as any).term_type_normalized,
    (drug as any).term_type,
    (drug as any).termType,
    (drug as any).dose_form,
    (drug as any).strength,
    (drug as any).route,
  ]
    .filter(Boolean)
    .map(String);

  return fields.length ? fields.join(' · ') : 'Medication intelligence profile';
}

function getTier(drug: DrugCard) {
  return (
    (drug as any).benchmark_tier ||
    (drug as any).tier ||
    (drug as any).intelligence_tier ||
    'Foundational'
  );
}

function distinctMedicationOptions(results: DrugCard[], query: string) {
  const seen = new Set<string>();
  const options: DrugCard[] = [];

  for (const drug of results) {
    const name = getDrugName(drug, query).trim();
    const key = `${name.toLowerCase()}__${drug.rxcui}`;

    if (!name || seen.has(key)) continue;

    seen.add(key);
    options.push(drug);
  }

  return options;
}

export default function DrugSearch({
  query,
  onQueryChange,
  results,
  selected,
  onExplore,
  onSelect,
  loading = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftSelection, setDraftSelection] = useState<DrugCard | null>(null);

  const options = useMemo(
    () => distinctMedicationOptions(results, query),
    [results, query]
  );

  const exploreHandler = onExplore ?? onSelect;
  const chosenDrug = draftSelection || options[0] || selected || null;

  function handleExploreClick() {
    const drugToExplore = draftSelection || options[0] || selected;

    if (!drugToExplore) {
      console.warn('Explore Intelligence clicked, but no drug option is available.');
      return;
    }

    if (!exploreHandler) {
      console.error(
        'DrugSearch requires either onExplore or onSelect. No handler was passed from App.tsx.'
      );
      return;
    }

    setDraftSelection(drugToExplore);
    setIsOpen(false);
    exploreHandler(drugToExplore);
  }

  function handleOptionSelect(drug: DrugCard, name: string) {
    setDraftSelection(drug);
    onQueryChange(name);
    setIsOpen(false);
    exploreHandler?.(drug);
  }

  return (
    <div className="w-full">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="relative">
          <div className="relative">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />

            <input
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
                setDraftSelection(null);
                setIsOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleExploreClick();
                }
              }}
              onFocus={() => setIsOpen(true)}
              placeholder="Search medication..."
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 py-5 pl-14 pr-12 text-lg font-bold text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20"
            />

            <button
              type="button"
              onClick={() => setIsOpen((value) => !value)}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              aria-label="Toggle medication results"
            >
              <ChevronDown className={`h-5 w-5 transition ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {isOpen && (
            <div className="absolute z-[9999] mt-3 max-h-96 w-full overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-blue-950/40">
              {loading && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-semibold text-slate-400">
                  Searching medication names…
                </div>
              )}

              {!loading && options.length === 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm font-semibold text-slate-400">
                  No medication names found. Try a broader search term.
                </div>
              )}

              {!loading &&
                options.map((drug) => {
                  const name = getDrugName(drug, query);
                  const subtitle = getSubtitle(drug);
                  const isDraft = String(draftSelection?.rxcui) === String(drug.rxcui);
                  const isCurrent = String(selected?.rxcui) === String(drug.rxcui);

                  return (
                    <button
                      key={`${name}-${drug.rxcui}`}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        handleOptionSelect(drug, name);
                      }}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-4 text-left transition ${
                        isDraft
                          ? 'bg-blue-600 text-white'
                          : isCurrent
                            ? 'bg-slate-900 text-slate-100'
                            : 'text-slate-200 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        <p className="text-base font-black">{name}</p>
                        <p
                          className={`mt-1 text-xs font-semibold ${
                            isDraft ? 'text-blue-100' : 'text-slate-500'
                          }`}
                        >
                          {subtitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black ${
                            isDraft ? 'bg-white text-blue-700' : 'bg-slate-800 text-slate-200'
                          }`}
                        >
                          {getTier(drug)}
                        </span>

                        {isDraft && <Check className="h-5 w-5" />}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleExploreClick}
          disabled={!chosenDrug && options.length === 0}
          className="inline-flex min-h-[64px] items-center justify-center gap-3 rounded-2xl bg-blue-600 px-8 py-5 text-base font-black text-white shadow-xl shadow-blue-950/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
        >
          <Search className="h-5 w-5" />
          Explore Intelligence
        </button>
      </div>
    </div>
  );
}
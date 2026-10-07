/**
 * useBestandKorrigierenFlow — the plumbing of the flow « Bestand korrigieren », generated from the plan.
 *
 * Changes `inventar`: the record to change is picked (`flow.pick('inventar')`), the form is prefilled with its values; asks `menge`, `standort`, `zustand`.
 * The hook OWNS: the form(s) with exactly these fields and the plan's required
 * ingredients, one record search per picked field (columns and filter from
 * the plan), and the submit plan with its fixed and derived values. A page
 * that only calls `flow.submit.run()` cannot write a field the plan does not
 * know — there is no way to spell it.
 *
 * YOU decide what a person notices, through the options:
 *   steps     which wizard step asks which field (default: one step per pick,
 *             then one for the typed fields, then "Prüfen" = step 3)
 *   items     how a search hit is displayed per pick (title, subtitle, status …)
 *   initial   prefills for typed fields
 *   messages  the sentence for an empty required field, per field
 *
 *   const flow = useBestandKorrigierenFlow({
 *     steps: { inventar: 1, menge: 2, standort: 2, zustand: 2 },
 *     items: { inventar: r => ({ id: r.id, title: fieldText(r, 'bezeichnung') }) },
 *   });
 *   <IntentWizardShell forms={flow.forms} draftKey={flow.draftKey} …>
 *     // the record this flow changes: <EntitySelectStep {...flow.picks.inventar.select} {...flow.pick('inventar')} />
 *     <Bound form={flow.forms.inventar} name="menge" />
 *     <Bound form={flow.forms.inventar} name="standort" />
 *     <Bound form={flow.forms.inventar} name="zustand" />
 *     <StepNav onNext={() => flow.validateStep(n)} />
 *     {!flow.submit.done && <SummaryStep forms={flow.formList} submit={flow.submit} />}
 *     {flow.submit.result && <SuccessStep result={flow.submit.result} forms={flow.formList} submit={flow.submit} />}
 *   </IntentWizardShell>
 */
import { useState } from 'react';
import {
  useStepForm, useJourneySubmit, useRecordSearch,
  fieldText, fieldLookup, fieldLookups, fieldNumber, fieldDate, fieldRef,
  todayIso, nowIso, isEmptyValue, policyFixedValue, withPickPolicy, usePolicyVersion,
  type StepForm, type JourneyRecord, type RefContext, type SelectItemLike, type FormValues, type PlanStep,} from '@/lib/journey';
import { servicePort } from '@/services/journeyPort';
import { pickHint, whereSentence, type PickWhere } from '@/lib/journey/policy';
import { labelOf, optionsOf, type EntityKey } from '@/lib/journey/rules';
import { entityLabel } from '@/lib/journey/rules';
export type BestandKorrigierenFieldKey = 'inventar' | 'menge' | 'standort' | 'zustand';

export interface BestandKorrigierenForms {
  inventar: StepForm<'inventar'>;
}

// Alias so the option generics stay readable.
type Key = BestandKorrigierenFieldKey;

export interface BestandKorrigierenFlowOptions {
  /** field → wizard step that asks it; drives „Ändern“ links and answer chips. */
  steps?: Partial<Record<Key, number>>;
  initial?: Partial<Record<Key, unknown>>;
  messages?: Partial<Record<Key, string>>;
  /** How a search hit reads — the card's title/subtitle/status per pick. */
  items?: {
    inventar?: (record: JourneyRecord, ctx: RefContext) => SelectItemLike;
  };
}

const DEFAULT_STEPS: Record<string, number> = {"inventar": 1, "menge": 2, "standort": 2, "zustand": 2};
export const BESTANDKORRIGIEREN_REVIEW_STEP = 3;

function fromPick<T>(pick: { recordOf(id: string): JourneyRecord | undefined }, form: StepForm, field: string, read: (r: JourneyRecord) => T): T | undefined {
  const id = form.get(field);
  const rec = typeof id === 'string' && id ? pick.recordOf(id) : undefined;
  return rec ? read(rec) : undefined;
}
function isoDaysFromToday(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns T, not Partial<T>: a Record's index signature is already "maybe
// absent", and Partial<Record<string, string>> does not assign to the
// Record<string, string> useStepForm wants (tsc, live 23.09.2026 — eight
// errors, one per hook, caught only in the sandbox build).
function only<T extends Record<string, unknown>>(obj: T | undefined, keys: string[]): T | undefined {
  if (!obj) return undefined;
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out as T;
}

function hasValues(form: StepForm): boolean {
  return form.keys.some(k => !isEmptyValue(form.values[k]));
}

export function useBestandKorrigierenFlow(options: BestandKorrigierenFlowOptions = {}) {
  const steps = { ...DEFAULT_STEPS, ...(options.steps ?? {}) } as Record<string, number>;
  const [inventarTargetId, setInventarTargetId] = useState<string | null>(null);
  const inventar = useStepForm('inventar', {
    fields: ["menge", "standort", "zustand"],
    steps: only(steps, ["menge", "standort", "zustand"]) as Record<string, number>,
    initial: only(options.initial as FormValues | undefined, ["menge", "standort", "zustand"]),
    messages: only(options.messages as Record<string, string> | undefined, ["menge", "standort", "zustand"]),
  });
  const forms: BestandKorrigierenForms = { inventar };
  const formList: StepForm[] = [inventar];

  // The owner's rules after the build (intent-policies.json): a fixed value
  // for a field this flow sets itself, a narrower or wider pick — read at
  // render time, so a change works on the running application.
  usePolicyVersion();
  const searches = {
    inventar: useRecordSearch(servicePort, 'inventar', withPickPolicy('inventar', {
      searchFields: ["bezeichnung", "artikelnummer", "standort"] as never,
      toItem: options.items?.inventar as never,
    })),
  };
  // Whether a pick offers „Neu anlegen“ is the plan's call: off for the record
  // this flow changes, for multi picks, for a catalogue entity and for an
  // entity with its own flow. The page spreads `.select` and writes no `create=`.
  // what the person sees under the search field: the rule that narrows the
  // pick (the owner's, else the plan's) — and the link that changes it
  const hintFor = (key: string, entity: EntityKey, planned: PickWhere | null) => pickHint(key, planned,
    w => whereSentence(w, f => labelOf(entity, f), (f, v) => optionsOf(entity, f).find(o => o.key === String(v))?.label ?? String(v)),
    `#/verwaltung/anwendung?line=intent:bestand-korrigieren:read:${entity}`);
  const picks = {
    inventar: { ...searches.inventar, select: { ...searches.inventar.select, create: false as boolean, hint: hintFor('inventar', 'inventar', null as PickWhere | null) } },
  };

  const plan: PlanStep[] = [
    {
      key: 'inventar', entity: 'inventar', form: inventar, primary: true,
      updates: () => inventarTargetId ?? undefined,
      // the review names the record this step changes; "Ändern" leads back to its pick
      target: () => inventarTargetId
        ? { key: 'target:inventar', label: entityLabel('inventar'), value: picks.inventar.labelOf(inventarTargetId) ?? inventarTargetId, step: steps.inventar }
        : undefined,    },
  ];

  const submit = useJourneySubmit(servicePort, plan, { draftKey: 'bestand-korrigieren' });

  /** The record(s) this flow CHANGES: picked through {...flow.picks.<entity>.select} {...flow.pick('<entity>')};
   *  picking prefills the form with the record's current values, and the plan step updates that record. */
  const targets = {
    inventar: {
      selectedId: inventarTargetId,
      onSelect: (id: string) => {
        setInventarTargetId(id);
        const rec = picks.inventar.recordOf(id);
        if (rec) inventar.reset({ menge: fieldNumber(rec, "menge"), standort: fieldText(rec, "standort"), zustand: fieldLookup(rec, "zustand")?.key, });
      },
      get record(): JourneyRecord | undefined { return inventarTargetId ? picks.inventar.recordOf(inventarTargetId) : undefined; },
    },
  };
  /** Props for a single-record pick step: {...flow.picks.x.select} {...flow.pick('x')} */
  const pick = (field: BestandKorrigierenFieldKey) => {
    if (field in targets) {
      const t = targets[field as keyof typeof targets];
      return { selectedId: t.selectedId, onSelect: t.onSelect };
    }
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return {
      selectedId: (typeof owner.get(field) === 'string' ? (owner.get(field) as string) : null) || null,
      // `field as never` collapsed the conditional SetArgs<E, never> to never and
      // no argument was assignable any more (tsc, live 23.09.2026); widen `set`
      // itself instead — the label stays a required third argument.
      onSelect: (id: string) => (owner.set as (k: string, v: unknown, l?: string) => void)(field, id, search?.labelOf(id)),
    };
  };
  /** Props for a multi-record pick step: {...flow.picks.x.select} {...flow.pickMany('x')} */
  const pickMany = (field: BestandKorrigierenFieldKey) => {
    const owner = formList.find(f => f.keys.includes(field)) ?? formList[0];
    const search = (picks as Record<string, { labelOf(id: string): string | undefined }>)[field];
    return owner.records(field, id => search?.labelOf(id));
  };
  /** Validate every field the wizard asks in step `n` — for StepNav.onNext. */
  const validateStep = (n: number): boolean =>
    formList.every(f => f.validate(f.keys.filter(k => steps[k] === n)))    && Object.entries(targets).every(([k, t]) => steps[k] !== n || !!t.selectedId);
  const reset = () => { submit.reset(); formList.forEach(f => f.reset()); setInventarTargetId(null); };

  return {
    slug: 'bestand-korrigieren' as const,
    draftKey: 'bestand-korrigieren' as const,
    entity: 'inventar' as const,
    form: inventar,
    forms, formList, picks, submit, steps, targets,    reviewStep: BESTANDKORRIGIEREN_REVIEW_STEP,
    pick, pickMany, validateStep, reset,
    // the door the hook reads through — for what it does not own: availability
    // (useOccupancy(flow.port, …)), a count (useRecordCount(flow.port, …)). A page
    // importing servicePort next to the hook fails gate 3 (fewo 05.10.2026: the
    // gate taught useOccupancy(servicePort, …) and forbade servicePort at once)
    port: servicePort,
  };
}

export type BestandKorrigierenFlow = ReturnType<typeof useBestandKorrigierenFlow>;

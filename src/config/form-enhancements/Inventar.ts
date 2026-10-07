// Auto-generated. Per-entity form-enhancements config for "Inventar".
// Written by the backend form polish (app/services/form_polish.py) from the
// generator's manifest; scripts/parse-formulas.mjs expands the formula strings.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [{"row": ["bezeichnung", "artikelnummer"], "cols": "2fr 1fr"}, {"row": ["kategorie", "lieferant"], "cols": "1fr 1fr"}, {"row": ["menge", "einheit"], "cols": "1fr 1fr"}, {"row": ["mindestbestand", "standort"], "cols": "1fr 1fr"}, "zustand", {"row": ["einkaufspreis", "anschaffungsdatum"], "cols": "1fr 1fr"}, "notizen_inventar"],
  defaults: {
    'menge': { kind: 'literal', value: 1 },
    'anschaffungsdatum': { kind: 'today' },
    'zustand': { kind: 'lookup', key: 'neu', label: 'Neu' },
    'einheit': { kind: 'lookup', key: 'stueck', label: 'Stück' },
  },
  computed: {},
};

export const computedDeps: Record<string, string[]> = {};
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};

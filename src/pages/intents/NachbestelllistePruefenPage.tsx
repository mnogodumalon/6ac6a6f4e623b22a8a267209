/**
 * Nachbestellbedarf prüfen — 3-Schritt-Wizard.
 * Steps: 1) Artikel mit knappem Bestand / Zustand defekt ansehen und wählen (Lieferant auf der Karte)
 *        → 2) Lieferant erkennen & Menge nach Lieferung erhöhen → 3) Prüfen & aktualisieren.
 * Reads: inventar, lieferanten. Writes: inventar (menge, update).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useEffect, useState } from 'react';
import { IconPhone, IconMail, IconTruckDelivery } from '@tabler/icons-react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldNumber, fieldLookup, fieldRef } from '@/lib/journey';
import { useNachbestelllistePruefenFlow } from '@/lib/journey/flows/NachbestelllistePruefen';
import { tx } from '@/i18n';

interface SupplierInfo {
  name: string;
  telefon: string;
  email: string;
}

export default function NachbestelllistePruefenPage() {
  const [step, setStep] = useState(1);
  const flow = useNachbestelllistePruefenFlow({
    steps: { inventar: 1, menge: 2 },
    items: {
      inventar: (r, ctx) => {
        const menge = fieldNumber(r, 'menge');
        const min = fieldNumber(r, 'mindestbestand');
        const zustand = fieldLookup(r, 'zustand');
        const low = menge !== null && min !== null && menge < min;
        const defekt = zustand?.key === 'defekt';
        const lieferant = ctx.ref('lieferant');
        const hint = low && defekt ? tx('Knapp & defekt') : low ? tx('Unter Mindestbestand') : defekt ? tx('Defekt') : '';
        return {
          id: r.id,
          title: fieldText(r, 'bezeichnung'),
          subtitle: [hint, lieferant ? tx`Lieferant: ${lieferant}` : tx('Kein Lieferant hinterlegt')].filter(Boolean).join(' · '),
          status: zustand ?? undefined,
          stats: [
            { label: tx('Bestand'), value: menge ?? '—' },
            { label: tx('Mindestbestand'), value: min ?? '—' },
          ],
        };
      },
    },
  });

  const form = flow.forms.inventar;
  const pickedId = (form.get('inventar') as string | null | undefined) ?? null;
  const picked = pickedId ? flow.picks.inventar.recordOf(pickedId) : undefined;
  const supplierId = picked ? fieldRef(picked, 'lieferant') : null;
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);

  useEffect(() => {
    let alive = true;
    setSupplier(null);
    if (!supplierId) return;
    flow.port.get('lieferanten', supplierId).then(rec => {
      if (!alive || !rec) return;
      setSupplier({ name: fieldText(rec, 'firmenname'), telefon: fieldText(rec, 'telefon'), email: fieldText(rec, 'email') });
    }).catch(() => undefined);
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const current = picked ? fieldNumber(picked, 'menge') : null;
  const min = picked ? fieldNumber(picked, 'mindestbestand') : null;
  const enteredRaw = form.get('menge');
  const entered = enteredRaw === '' || enteredRaw == null ? null : Number(enteredRaw);

  return (
    <IntentWizardShell
      title={tx('Nachbestellbedarf prüfen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Knappe oder defekte Artikel samt Lieferant sehen und den Bestand nach der Lieferung erhöhen.'),
        needs: [tx('Gelieferte Menge')],
      }}
    >
      <WizardStep label={tx('Artikel')} description={tx('Artikel mit knappem Bestand oder Zustand „defekt" — der Lieferant steht auf der Karte.')}>
        <EntitySelectStep
          {...flow.picks.inventar.select}
          {...flow.pick('inventar')}
          avatar="none"
          searchPlaceholder={tx('Artikel suchen …')}
          emptyText={tx('Kein Artikel gefunden.')}
        />
      </WizardStep>

      <WizardStep label={tx('Menge')} description={tx('Neue Menge nach der Lieferung eintragen.')} needs={['inventar']}>
        <div className="space-y-4">
          {picked && (
            <div className="rounded-2xl border bg-card p-4 overflow-hidden space-y-2">
              <div className="flex items-center gap-2 min-w-0">
                <IconTruckDelivery size={18} className="shrink-0 text-muted-foreground" />
                <span className="font-medium truncate">{supplier?.name || (supplierId ? tx('Lieferant wird geladen …') : tx('Kein Lieferant hinterlegt'))}</span>
              </div>
              {supplier && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {supplier.telefon && (
                    <a href={`tel:${supplier.telefon}`} className="inline-flex items-center gap-1 min-w-0">
                      <IconPhone size={14} className="shrink-0" />
                      <span className="truncate">{supplier.telefon}</span>
                    </a>
                  )}
                  {supplier.email && (
                    <a href={`mailto:${supplier.email}`} className="inline-flex items-center gap-1 min-w-0">
                      <IconMail size={14} className="shrink-0" />
                      <span className="truncate">{supplier.email}</span>
                    </a>
                  )}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                {tx`Aktueller Bestand: ${current ?? '—'} · Mindestbestand: ${min ?? '—'}`}
              </p>
            </div>
          )}
          <Bound form={form} name="menge" hint={tx('Gesamtmenge nach der Lieferung, nicht nur die gelieferte Menge')} />
          {entered !== null && Number.isFinite(entered) && min !== null && entered < min && (
            <p className="text-xs text-destructive">{tx`Die Menge liegt weiter unter dem Mindestbestand von ${min}.`}</p>
          )}
          <StepNav
            onBack={() => setStep(1)}
            onNext={() => flow.validateStep(2)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Die neue Menge wird im Inventar gespeichert.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Weiteren Artikel prüfen'), onClick: () => flow.reset() },
            { label: tx('Bestand korrigieren'), href: '#/intents/bestand-korrigieren' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}

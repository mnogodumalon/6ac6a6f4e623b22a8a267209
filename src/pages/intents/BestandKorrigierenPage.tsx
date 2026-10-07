/**
 * Bestand korrigieren — 3-Schritt-Wizard.
 * Steps: 1) Artikel wählen → 2) Aktuellen Bestand ansehen & Menge, Standort, Zustand korrigieren → 3) Prüfen & speichern.
 * Reads: inventar. Writes: inventar (update — menge, standort, zustand) via useBestandKorrigierenFlow.
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText, fieldNumber, fieldLookup } from '@/lib/journey';
import { useBestandKorrigierenFlow } from '@/lib/journey/flows/BestandKorrigieren';
import { tx } from '@/i18n';

export default function BestandKorrigierenPage() {
  const [step, setStep] = useState(1);
  const flow = useBestandKorrigierenFlow({
    steps: { inventar: 1, menge: 2, standort: 2, zustand: 2 },
    items: {
      inventar: r => {
        const menge = fieldNumber(r, 'menge');
        const einheit = fieldLookup(r, 'einheit')?.label ?? '';
        const nr = fieldText(r, 'artikelnummer');
        const ort = fieldText(r, 'standort');
        return {
          id: r.id,
          title: fieldText(r, 'bezeichnung'),
          subtitle: [nr, ort].filter(Boolean).join(' · '),
          stats: [{ label: tx('Menge'), value: `${menge ?? '—'} ${einheit}`.trim() }],
        };
      },
    },
  });

  const current = flow.targets.inventar.record;
  const aktuell = current ? fieldNumber(current, 'menge') : null;
  const mindest = current ? fieldNumber(current, 'mindestbestand') : null;
  const einheit = current ? fieldLookup(current, 'einheit')?.label ?? '' : '';
  const neu = Number(flow.forms.inventar.get('menge'));
  const hasNeu = flow.forms.inventar.get('menge') !== '' && flow.forms.inventar.get('menge') != null && !Number.isNaN(neu);
  const unterMindest = hasNeu && mindest != null && neu < mindest;

  return (
    <IntentWizardShell
      title={tx('Bestand korrigieren')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Menge, Standort oder Zustand eines Artikels nach Entnahme, Lieferung oder Inventur anpassen.'),
        needs: [tx('Name oder Artikelnummer des Artikels'), tx('Gezählte Menge')],
      }}
    >
      <WizardStep label={tx('Artikel')} description={tx('Welchen Artikel willst du korrigieren?')}>
        <EntitySelectStep
          {...flow.picks.inventar.select}
          {...flow.pick('inventar')}
          searchPlaceholder={tx('Bezeichnung oder Artikelnummer …')}
        />
      </WizardStep>

      <WizardStep
        label={tx('Korrigieren')}
        description={tx('Aktuellen Bestand ansehen und die neuen Werte eintragen.')}
        needs={['inventar']}
      >
        <div className="space-y-4">
          {current && (
            <div className="rounded-2xl border bg-secondary/40 p-4 overflow-hidden">
              <p className="font-medium truncate">{fieldText(current, 'bezeichnung')}</p>
              <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{tx('Aktuelle Menge')}</dt>
                  <dd className="font-medium">{aktuell ?? '—'} {einheit}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{tx('Mindestbestand')}</dt>
                  <dd className="font-medium">{mindest ?? '—'} {mindest != null ? einheit : ''}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-muted-foreground">{tx('Standort')}</dt>
                  <dd className="font-medium truncate">{fieldText(current, 'standort') || '—'}</dd>
                </div>
              </dl>
            </div>
          )}
          <Bound form={flow.forms.inventar} name="menge" hint={einheit ? tx`Neue Menge in ${einheit}` : undefined} />
          {unterMindest && (
            <p className="text-xs text-destructive">
              {tx`Achtung: Die neue Menge liegt unter dem Mindestbestand von ${mindest ?? 0}.`}
            </p>
          )}
          <Bound form={flow.forms.inventar} name="standort" />
          <Bound form={flow.forms.inventar} name="zustand" />
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
            whatHappensNext={tx('Der Artikel wird mit den neuen Werten gespeichert. Alle anderen Angaben bleiben unverändert.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          title={tx('Bestand korrigiert')}
          next={[
            { label: tx('Weiteren Artikel korrigieren'), onClick: () => { flow.reset(); setStep(1); } },
            { label: tx('Nachbestellbedarf prüfen'), href: '#/intents/nachbestellliste-pruefen' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}

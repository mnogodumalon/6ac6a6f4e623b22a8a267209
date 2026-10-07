/**
 * Artikel aufnehmen — 5-Schritt-Wizard.
 * Steps: 1) Kategorie wählen → 2) Lieferant wählen → 3) Bezeichnung, Menge, Einheit, Standort
 *        → 4) Mindestbestand, Zustand, Preis, Datum, Artikelnummer → 5) Prüfen & speichern.
 * Reads: kategorien, lieferanten. Writes: inventar (via useArtikelAufnehmenFlow).
 * Composes: IntentWizardShell, EntitySelectStep, Bound, StepNav, SummaryStep, SuccessStep.
 */
import { useState } from 'react';
import { IntentWizardShell, WizardStep } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { Bound } from '@/components/blocks/Bound';
import { StepNav } from '@/components/blocks/StepNav';
import { SummaryStep } from '@/components/blocks/SummaryStep';
import { SuccessStep } from '@/components/blocks/SuccessStep';
import { fieldText } from '@/lib/journey';
import { useArtikelAufnehmenFlow } from '@/lib/journey/flows/ArtikelAufnehmen';
import { tx } from '@/i18n';

export default function ArtikelAufnehmenPage() {
  const [step, setStep] = useState(1);
  const flow = useArtikelAufnehmenFlow({
    steps: {
      kategorie: 1,
      lieferant: 2,
      bezeichnung: 3,
      menge: 3,
      einheit: 3,
      standort: 3,
      mindestbestand: 4,
      zustand: 4,
      einkaufspreis: 4,
      anschaffungsdatum: 4,
      artikelnummer: 4,
      notizen_inventar: 4,
    },
    items: {
      kategorie: r => ({ id: r.id, title: fieldText(r, 'kategorie_name') }),
      lieferant: r => ({ id: r.id, title: fieldText(r, 'firmenname'), subtitle: fieldText(r, 'ort') }),
    },
  });
  const inventar = flow.forms.inventar;

  return (
    <IntentWizardShell
      title={tx('Artikel aufnehmen')}
      currentStep={step}
      onStepChange={setStep}
      forms={flow.formList}
      draftKey={flow.draftKey}
      intro={{
        description: tx('Einen neuen Artikel mit Kategorie und Lieferant in einem Zug erfassen.'),
        needs: [tx('Bezeichnung und Menge'), tx('Kategorie und Lieferant'), tx('Artikelnummer, falls vorhanden')],
      }}
    >
      <WizardStep label={tx('Kategorie')} description={tx('Zu welcher Kategorie gehört der Artikel?')}>
        <EntitySelectStep {...flow.picks.kategorie.select} {...flow.pick('kategorie')} searchPlaceholder={tx('Kategorie suchen …')} />
        <StepNav hideBack onNext={() => true} nextStepLabel={tx('Lieferant')} />
      </WizardStep>

      <WizardStep label={tx('Lieferant')} description={tx('Von wem bekommst du den Artikel?')}>
        <EntitySelectStep {...flow.picks.lieferant.select} {...flow.pick('lieferant')} searchPlaceholder={tx('Firma suchen …')} />
        <StepNav onBack={() => setStep(1)} onNext={() => true} nextStepLabel={tx('Grunddaten')} />
      </WizardStep>

      <WizardStep label={tx('Grunddaten')} description={tx('Wie heißt der Artikel, wie viel ist da und wo liegt er?')}>
        <div className="space-y-4">
          <Bound form={inventar} name="bezeichnung" />
          <Bound form={inventar} name="menge" />
          <Bound form={inventar} name="einheit" />
          <Bound form={inventar} name="standort" />
          <StepNav
            onBack={() => setStep(2)}
            onNext={() => flow.validateStep(3)}
            nextStepLabel={tx('Details')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Details')} description={tx('Bestand, Zustand und Kosten ergänzen — alles optional außer der Artikelnummer-Prüfung.')}>
        <div className="space-y-4">
          <Bound form={inventar} name="mindestbestand" />
          <Bound form={inventar} name="zustand" />
          <Bound form={inventar} name="einkaufspreis" />
          <Bound form={inventar} name="anschaffungsdatum" />
          <Bound form={inventar} name="artikelnummer" />
          <Bound form={inventar} name="notizen_inventar" />
          <StepNav
            onBack={() => setStep(3)}
            onNext={() => flow.validateStep(4)}
            nextStepLabel={tx('Prüfen')}
          />
        </div>
      </WizardStep>

      <WizardStep label={tx('Prüfen')} description={tx('Artikelnummer und Angaben kontrollieren, dann speichern.')}>
        {!flow.submit.done && (
          <SummaryStep
            forms={flow.formList}
            submit={flow.submit}
            whatHappensNext={tx('Der Artikel erscheint sofort im Inventar.')}
          />
        )}
      </WizardStep>

      {flow.submit.result && (
        <SuccessStep
          result={flow.submit.result}
          forms={flow.formList}
          submit={flow.submit}
          next={[
            { label: tx('Bestand korrigieren'), href: '#/intents/bestand-korrigieren' },
            { label: tx('Zum Dashboard'), href: '#/' },
          ]}
        />
      )}
    </IntentWizardShell>
  );
}

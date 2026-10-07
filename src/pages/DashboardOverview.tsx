import { useMemo, useState } from 'react';
import { IconAlertTriangle, IconPlus, IconPackage, IconMapPin } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import type { EnrichedInventar } from '@/types/enriched';
import { lookupOption } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
import { tx, appLabel } from '@/i18n';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { DashboardGrid } from '@/components/DashboardGrid';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { WorkList } from '@/components/WorkList';
import { HeroBanner } from '@/components/HeroBanner';
import { Button } from '@/components/ui/button';
import { ChartWidget, type ChartRow } from '@/components/widgets/ChartWidget';

type Filter = 'all' | 'low';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { inventar, setInventar, fetchAll } = data;
  const clock = useClock();
  const [filter, setFilter] = useState<Filter>('all');

  const setZustand = (id: string, key: string) =>
    setInventar(prev => prev.map(r => r.record_id === id
      ? { ...r, fields: { ...r.fields, zustand: lookupOption('inventar', 'zustand', key) } }
      : r));

  // One write path: hero action + overlay footer
  const markRepaired = (id: string, name: string) => {
    const rec = inventar.find(r => r.record_id === id);
    const prevKey = rec ? lookupKey(rec.fields.zustand) : undefined;
    setZustand(id, 'gut');
    LivingAppsService.updateInventarEntry(id, { zustand: 'gut' }).catch(() => fetchAll());
    undoToast(tx`${name} — als repariert markiert`, () => {
      setZustand(id, prevKey ?? 'defekt');
      LivingAppsService.updateInventarEntry(id, { zustand: prevKey ?? 'defekt' }).catch(() => fetchAll());
    });
  };

  const crud = useEntityCrud(data, {
    footer: (top) => top.type === 'inventar' && lookupKey(top.record.fields.zustand) === 'defekt'
      ? { label: tx('Als repariert markieren'), onClick: () => markRepaired(top.record.record_id, top.record.fields.bezeichnung ?? '') }
      : undefined,
  });
  const items = crud.enriched.inventar;

  const name = (r: EnrichedInventar) => r.fields.bezeichnung ?? r.fields.artikelnummer ?? '—';
  const isLow = (r: EnrichedInventar) =>
    r.fields.mindestbestand != null && (r.fields.menge ?? 0) < r.fields.mindestbestand;
  const open = (id: string) => {
    const rec = inventar.find(r => r.record_id === id);
    if (rec) crud.inventar.openDetail(rec);
  };

  const low = useMemo(() => items.filter(isLow), [items]);
  const defekt = useMemo(() => items.filter(r => lookupKey(r.fields.zustand) === 'defekt'), [items]);
  const recent = useMemo(() => items
    .filter(r => r.fields.anschaffungsdatum)
    .sort((a, b) => (b.fields.anschaffungsdatum ?? '').localeCompare(a.fields.anschaffungsdatum ?? ''))
    .slice(0, 5), [items]);
  const withMin = items.filter(r => r.fields.mindestbestand != null).length;

  const ratio = (r: EnrichedInventar) => {
    const min = r.fields.mindestbestand ?? 0;
    return min > 0 ? (r.fields.menge ?? 0) / min : Infinity;
  };
  const listed = useMemo(() => {
    const base = filter === 'low' ? items.filter(isLow) : items;
    return [...base].sort((a, b) => ratio(a) - ratio(b)).slice(0, 12);
  }, [items, filter]);

  const rows = useMemo<ChartRow<EnrichedInventar>[]>(
    () => items.map(r => ({ id: `inventar:${r.record_id}`, data: r })), [items]);

  let context: string;
  if (items.length === 0) context = tx('Richte dein Werkstattlager ein — erfasse den ersten Artikel.');
  else if (low.length > 0) {
    const n = namen(low.map(name), 3);
    context = low.length === 1 ? tx`${n} muss nachbestellt werden.` : tx`${n} müssen nachbestellt werden.`;
  } else context = tx`Alle ${items.length} Artikel sind ausreichend vorrätig.`;

  const hero = items.length === 0 ? (
    <HeroBanner
      icon={<IconPackage size={48} />}
      action={{ label: tx('Ersten Artikel erfassen'), onClick: () => crud.inventar.openCreate({}) }}
    >
      {tx('Noch kein Artikel im Inventar — leg los und erfasse Menge, Standort und Mindestbestand.')}
    </HeroBanner>
  ) : defekt.length > 0 ? (
    <HeroBanner
      icon={<IconAlertTriangle size={18} />}
      action={{ label: tx('Als repariert markieren'), onClick: () => markRepaired(defekt[0].record_id, name(defekt[0])) }}
    >
      <b>{namen(defekt.map(name), 3)}</b> {defekt.length === 1 ? tx('ist defekt.') : tx('sind defekt.')}
    </HeroBanner>
  ) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{gruss(clock)}</h1>
          <p className="text-sm text-muted-foreground">{context}</p>
        </div>
        {crud.inventar.canWrite && (
          <Button onClick={() => crud.inventar.openCreate({})}>
            <IconPlus size={16} className="shrink-0" />
            <span>{tx('Artikel erfassen')}</span>
          </Button>
        )}
      </div>

      <DashboardGrid
        variant="split"
        hero={hero}
        kpis={items.length > 0 ? (
          <StatStrip>
            <StatStripItem
              title={tx('Unter Mindestbestand')}
              value={low.length}
              tone={low.length > 0 ? 'warning' : 'default'}
              onClick={() => setFilter(f => f === 'low' ? 'all' : 'low')}
              active={filter === 'low'}
            />
            <StatStripItem
              title={tx('Ausreichend bestückt')}
              value={`${withMin - low.length} / ${withMin}`}
            />
          </StatStrip>
        ) : undefined}
        aside={items.length > 0 ? (
          <>
            <WorkList
              title={tx('Zuletzt angeschafft')}
              items={recent.map(r => ({
                id: r.record_id,
                title: name(r),
                secondLine: <span className="text-muted-foreground">{formatDate(r.fields.anschaffungsdatum)} · {r.fields.menge ?? 0} {r.fields.einheit?.label ?? ''}</span>,
              }))}
              onItemClick={open}
              empty={{ text: tx('Noch keine Anschaffungsdaten erfasst.'), action: { label: tx('Artikel erfassen'), onClick: () => crud.inventar.openCreate({}) } }}
            />
            <ChartWidget<EnrichedInventar>
              title={tx('Artikel pro Kategorie')}
              rows={rows}
              dimension={{ kind: 'category', accessor: r => r.data.kategorieName || null, label: tx('Kategorie') }}
              interaction={{ mode: 'drill', onSegmentClick: seg => open(seg.rowIds[0].split(':')[1]) }}
            />
          </>
        ) : undefined}
        primary={items.length > 0 ? (
          <div className="rounded-[27px] bg-card shadow-lg overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-6 pt-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {filter === 'low' ? tx('Nachbestellen — Menge gegen Mindestbestand') : tx('Bestand — Menge gegen Mindestbestand')}
              </h2>
              <span className="text-xs text-muted-foreground">{appLabel('inventar')}: {items.length}</span>
            </div>
            <ul className="divide-y divide-border mt-3">
              {listed.map(r => {
                const min = r.fields.mindestbestand ?? 0;
                const qty = r.fields.menge ?? 0;
                const pct = min > 0 ? Math.min(100, Math.round((qty / min) * 100)) : 100;
                const bad = isLow(r);
                const broken = lookupKey(r.fields.zustand) === 'defekt';
                return (
                  <li key={r.record_id}>
                    <button type="button" onClick={() => open(r.record_id)}
                      className="w-full text-left px-6 py-3 hover:bg-muted/50 transition-colors flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-3 min-w-0">
                        <span className="font-medium truncate min-w-0">{name(r)}</span>
                        <span className={`text-sm shrink-0 ${bad ? 'font-semibold text-amber-600' : 'text-muted-foreground'}`}>
                          {qty} / {min > 0 ? min : '—'} {r.fields.einheit?.label ?? ''}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${bad ? 'bg-amber-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground min-w-0">
                        {r.kategorieName && <span className="truncate">{r.kategorieName}</span>}
                        {r.fields.standort && (
                          <span className="inline-flex items-center gap-1 truncate"><IconMapPin size={12} className="shrink-0" />{r.fields.standort}</span>
                        )}
                        {r.lieferantName && <span className="truncate">{r.lieferantName}</span>}
                        {broken && <span className="font-medium text-destructive">{tx('Defekt')}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
              {listed.length === 0 && (
                <li className="px-6 py-8 text-sm text-center text-muted-foreground">{tx('Alles ausreichend vorrätig.')}</li>
              )}
            </ul>
          </div>
        ) : <div />}
      />
      {crud.surfaces}
    </div>
  );
}

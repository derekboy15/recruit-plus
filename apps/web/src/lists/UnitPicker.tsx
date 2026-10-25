import type { UnitOut } from '@recruit/data/model';
import { availableUnits, resolve, type Roster, type Scope, type UnitOption } from '@recruit/data/roster';
import { useId, useMemo, useState } from 'react';
import { factionDisplayName } from '../factions/names';
import { DatasheetView, keyStats, sizeLabel } from '../ui/datasheet';
import { IconPlus, IconSearch } from '../ui/icons';
import { Sheet } from '../ui/Sheet';
import { fmt, unitName } from './editorView';
import { unitInfo, type UnitIndex } from './unitIndex';

interface Props {
  scope: Scope;
  roster: Roster;
  forceSelId: string;
  /** Only these units (a fix's suggestions), until the player asks for all. */
  only?: string[];
  /** The role chip selected at first (a role section's +). */
  role?: string;
  /** The unit whose datasheet is open over the picker (its row's key), and how to open or close it. */
  preview?: string | null;
  onPreview?: (key: string | null) => void;
  units: UnitIndex | null;
  onAdd: (entryId: string) => void;
  onClose: () => void;
}

const OTHER = 'Other';
const ALL = 'All';

/** A row or preview: an available unit (with its price and entry) or a datasheet the army's choices keep out. */
interface Item {
  key: string;
  name: string;
  role: string;
  legends: boolean;
  unit: UnitOut | undefined;
  option: UnitOption | null;
}

/** `5–10 models · M5" T4 W1 Sv3+` (whatever the datasheet has). */
function statsLine(unit: UnitOut | undefined): string | null {
  if (!unit) return null;
  const k = keyStats(unit);
  const stats = [`M${k.M}`, `T${k.T}`, `W${k.W}`, `Sv${k.Sv}`].join(' ');
  return [sizeLabel(unit), stats].filter(Boolean).join(' · ');
}

function Badges({ item }: { item: Item }) {
  return (
    <>
      {item.legends && <> <span className="badge badge--legends">Legends</span></>}
      {item.unit?.forgeWorld && <> <span className="badge badge--fw">Forge World</span></>}
    </>
  );
}

/** Search, role chips, then units with their key stats: tap one for its datasheet, or + to add it at once. */
export function UnitPicker({ scope, roster, forceSelId, only, role, preview: shownKey, onPreview, units, onAdd, onClose }: Props) {
  // Prices are worked out when the picker opens, not on every render.
  const [options] = useState(() => availableUnits(scope, roster, forceSelId));
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [chip, setChip] = useState(role ?? ALL);
  const filtered = !!only?.length && !showAll;
  const hiddenId = useId();
  // The editor keeps the preview in the URL (so Back closes it); on its own the picker keeps it here.
  const [ownKey, setOwnKey] = useState<string | null>(null);
  const previewKey = onPreview ? (shownKey ?? null) : ownKey;
  const setPreview = onPreview ?? setOwnKey;

  const force = roster.forces.find((f) => f.id === forceSelId);
  const catalogue = force ? scope.catalogue(force.catalogueId) : undefined;
  const faction = catalogue ? factionDisplayName(catalogue.name) : '';

  const available: Item[] = useMemo(
    () =>
      options
        .filter((o) => !filtered || only!.includes(o.entryId))
        .map((o) => {
          const unit = unitInfo(scope, units, o.entryId)?.unit;
          // The name's [Legends] tag, or the datasheet's Warhammer Legends source (Wahapedia).
          return { key: o.entryId, name: unitName(o.name), role: o.role ?? OTHER, legends: o.legends || !!unit?.legends, unit, option: o };
        }),
    [options, filtered, only, scope, units],
  );
  // The faction's datasheets the army can't take now (a dynasty's named characters, say). Not while showing a fix's units.
  const unavailable: Item[] = useMemo(() => {
    if (filtered || !units || !catalogue) return [];
    const taken = new Set(options.map((o) => scope.node(o.entryId)).filter(Boolean).map((n) => resolve(scope, n!).target.id));
    return [...units.values()]
      .filter((i) => i.unit.catalogueId === catalogue.id && !taken.has(i.unit.id))
      .map((i) => ({ key: i.unit.id, name: unitName(i.unit.name), role: i.unit.role || OTHER, legends: i.unit.legends, unit: i.unit, option: null }));
  }, [filtered, units, catalogue, options, scope]);

  const roles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of available) counts.set(i.role, (counts.get(i.role) ?? 0) + 1);
    return [...counts];
  }, [available]);

  const preview = previewKey ? (available.find((i) => i.key === previewKey) ?? unavailable.find((i) => i.key === previewKey) ?? null) : null;

  const q = query.trim().toLowerCase();
  const matches = (i: Item) => (chip === ALL || i.role === chip) && (!q || i.name.toLowerCase().includes(q));
  const shown = available.filter(matches);
  const hidden = unavailable.filter(matches);

  const row = (i: Item) => (
    <li key={i.key} className="picker-row">
      <button type="button" className="picker-row__open" aria-haspopup="dialog" onClick={() => setPreview(i.key)}>
        <span className="picker-row__text">
          <span className="picker-row__name">
            {i.name}
            <Badges item={i} />
          </span>
          {statsLine(i.unit) && <span className="picker-row__stats">{statsLine(i.unit)}</span>}
          {!i.option && i.unit?.needs && <span className="picker-row__needs">{`Needs ${i.unit.needs.join(' or ')}`}</span>}
        </span>
        {i.option && (
          <span className="picker-row__pts">
            <span aria-hidden="true">
              from <span className="picker-row__num">{fmt(i.option.points)}</span>
            </span>
            <span className="sr-only">{`from ${fmt(i.option.points)} points`}</span>
          </span>
        )}
      </button>
      {i.option && (
        <button type="button" className="btn btn--icon picker-row__add" aria-label={`Add ${i.name}`} onClick={() => onAdd(i.option!.entryId)}>
          <IconPlus size={22} aria-hidden="true" />
        </button>
      )}
    </li>
  );

  return (
    <Sheet title="Add a unit" kind="full" onClose={onClose}>
      <div className="picker-search">
        <IconSearch size={18} aria-hidden="true" />
        <input
          type="search"
          className="picker-search__input"
          aria-label="Search units"
          placeholder={faction ? `Search ${faction} units` : 'Search units'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {roles.length > 1 && (
        <div className="chip-row picker-chips" role="group" aria-label="Filter by role">
          {[[ALL, 0] as const, ...roles].map(([r, n]) => (
            <button key={r} type="button" className="chip" aria-pressed={chip === r} onClick={() => setChip(r)}>
              {r}
              {r !== ALL && (
                <>
                  {' '}
                  <span className="picker-chips__count">{n}</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
      {filtered && (
        <p className="picker__note">
          <span className="muted">Units that fix this problem.</span>
          <button type="button" className="btn btn--small" onClick={() => setShowAll(true)}>
            Show all units
          </button>
        </p>
      )}
      {shown.length === 0 && (
        <p className="muted">
          {q
            ? `No units match “${query.trim()}”.`
            : filtered
              ? 'None of the suggested units can be added here any more. Show all units to pick another.'
              : chip !== ALL
                ? `No ${chip} units can be added here.`
                : 'This detachment can’t take any units.'}
        </p>
      )}
      {shown.length > 0 && <ul className="picker-rows">{shown.map(row)}</ul>}
      {hidden.length > 0 && (
        <section className="picker-hidden" aria-labelledby={hiddenId}>
          <h3 id={hiddenId} className="label-caps picker-hidden__title">
            Not available with this army’s current choices
          </h3>
          <p className="muted picker-hidden__note">Changing your dynasty, detachment or Army of Renown may make these available.</p>
          <ul className="picker-rows">{hidden.map(row)}</ul>
        </section>
      )}
      {preview && (
        <Sheet
          title={preview.name}
          onClose={() => setPreview(null)}
          footer={
            preview.option ? (
              <button type="button" className="btn btn--primary" onClick={() => onAdd(preview.option!.entryId)}>
                {`Add to list · ${fmt(preview.option.points)} pts`}
              </button>
            ) : undefined
          }
        >
          {!preview.option && <p className="hint picker-hidden__hint">Your army can’t take this unit with its current choices.</p>}
          {preview.unit ? (
            <DatasheetView unit={preview.unit} headingLevel={2} hideName />
          ) : (
            <p className="muted">There’s no datasheet for this one in the rules data.</p>
          )}
        </Sheet>
      )}
    </Sheet>
  );
}

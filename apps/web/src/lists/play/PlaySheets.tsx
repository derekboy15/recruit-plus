/** The one sheet Play mode has open: the army's rules, its stratagems, or a unit's datasheet with Previous and Next. */
import { useState } from 'react';
import { RulesText } from '../../rules/RulesText';
import { WordingToggle } from '../../rules/wording';
import { DatasheetView } from '../../ui/datasheet';
import { IconBack, IconNext } from '../../ui/icons';
import { Sheet } from '../../ui/Sheet';
import { fmt, plural } from '../editorView';
import type { ArmyRule } from './armyRules';
import { stratagemsByPhase } from './armyRules';
import type { PlayData } from './loadPlayData';
import type { PlaySheet } from './PlayArmyView';
import type { PlayUnit } from './playArmy';

function RuleList({ rules, tags }: { rules: ArmyRule[]; tags: boolean }) {
  return (
    <ul className="ability-list">
      {rules.map((r) => (
        <li key={`${r.from}|${r.name}`} className="ability">
          <h4 className="ability__name">
            {r.name}
            {tags && <span className="play-tag">{r.from}</span>}
          </h4>
          <RulesText official={r.text} plain={r.plain} amended={r.amended} />
        </li>
      ))}
    </ul>
  );
}

function RulesSheetBody({ data }: { data: PlayData }) {
  const chosen = new Set(data.army.choices.map((c) => c.name));
  const mine = data.rules.filter((r) => chosen.has(r.from));
  const faction = data.rules.filter((r) => !chosen.has(r.from));
  const factions = new Set(faction.map((r) => r.from));
  return (
    <div className="play-sheet">
      <WordingToggle />
      {data.rules.length === 0 && <p className="muted">No army rules found for this list.</p>}
      {mine.length > 0 && (
        <section className="play-sheet__section">
          <h3 className="label-caps">Your choices</h3>
          <RuleList rules={mine} tags />
        </section>
      )}
      {faction.length > 0 && (
        <section className="play-sheet__section">
          <h3 className="label-caps">Faction rules</h3>
          <RuleList rules={faction} tags={factions.size > 1} />
        </section>
      )}
    </div>
  );
}

function StratagemsSheetBody({ data }: { data: PlayData }) {
  const [showAll, setShowAll] = useState(false);
  const { mine, all } = data.stratagems;
  return (
    <div className="play-sheet">
      <p className="muted play-sheet__note">
        {showAll ? 'Showing every stratagem, including ones for choices this list didn’t make.' : 'Showing stratagems for your faction and its choices.'}
      </p>
      <label className="play-check">
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Show every stratagem
      </label>
      <WordingToggle />
      {stratagemsByPhase(showAll ? all : mine).map((g) => (
        <section key={g.phase} className="play-sheet__section">
          <h3 className="label-caps">{g.phase}</h3>
          <ul className="ability-list">
            {g.stratagems.map((s) => (
              <li key={s.id} className="ability">
                <h4 className="ability__name">
                  {s.name}
                  <span className="play-tag">{s.group}</span>
                </h4>
                <p className="play-strat__meta">{[`${s.cp} CP`, s.kind].filter(Boolean).join(' · ')}</p>
                <RulesText official={s.text} plain={s.plain} amended={s.amended} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function UnitNav({ prev, next, onOpen }: { prev?: PlayUnit; next?: PlayUnit; onOpen: (s: PlaySheet) => void }) {
  if (!prev && !next) return null;
  return (
    <nav className="play-nav" aria-label="Other units in this army">
      {prev && (
        <button type="button" className="btn play-nav__btn" onClick={() => onOpen({ kind: 'unit', selId: prev.selId })}>
          <IconBack size={18} aria-hidden="true" />
          <span className="play-nav__text">
            <span className="play-nav__label">Previous</span>
            <span className="play-nav__name">{prev.name}</span>
          </span>
        </button>
      )}
      {next && (
        <button type="button" className="btn play-nav__btn play-nav__btn--next" onClick={() => onOpen({ kind: 'unit', selId: next.selId })}>
          <span className="play-nav__text">
            <span className="play-nav__label">Next</span>
            <span className="play-nav__name">{next.name}</span>
          </span>
          <IconNext size={18} aria-hidden="true" />
        </button>
      )}
    </nav>
  );
}

function UnitSheetBody({ u }: { u: PlayUnit }) {
  return (
    <div className="play-sheet">
      <p className="play-sheet__sub">{`${u.role} · ${plural(u.models, 'model', 'models')} · ${fmt(u.points)} pts`}</p>
      {u.wargear.length > 0 && <p className="play-sheet__gear">{u.wargear.join(' · ')}</p>}
      {u.unit ? (
        <DatasheetView unit={u.unit} sheet={u.sheet ?? undefined} headingLevel={2} hideName />
      ) : (
        <p className="muted">This unit has no datasheet in the rules data.</p>
      )}
    </div>
  );
}

/**
 * The open sheet, full screen on a phone. A unit's sheet steps through the army with Previous and Next; each unit is a
 * fresh sheet, so it opens at the top with focus on its name. Null for a unit the army doesn't have (a stale link).
 */
export function PlaySheets({ data, open, onOpen, closeLabel }: { data: PlayData; open: PlaySheet; onOpen: (s: PlaySheet | null) => void; closeLabel?: string }) {
  const close = () => onOpen(null);
  if (open.kind === 'rules') {
    return (
      <Sheet kind="full" title="Army rules" onClose={close} closeLabel={closeLabel}>
        <RulesSheetBody data={data} />
      </Sheet>
    );
  }
  if (open.kind === 'stratagems') {
    return (
      <Sheet kind="full" title="Stratagems" onClose={close} closeLabel={closeLabel}>
        <StratagemsSheetBody data={data} />
      </Sheet>
    );
  }
  const { units } = data.army;
  const i = units.findIndex((u) => u.selId === open.selId);
  if (i < 0) return null;
  const u = units[i];
  return (
    <Sheet
      key={u.selId}
      kind="full"
      title={u.name}
      onClose={close}
      closeLabel={closeLabel}
      footer={units.length > 1 ? <UnitNav prev={units[i - 1]} next={units[i + 1]} onOpen={onOpen} /> : undefined}
    >
      <UnitSheetBody u={u} />
    </Sheet>
  );
}

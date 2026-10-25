import { TEXT_CHARS, type AbilityOut, type ProfileOut, type UnitOut } from '@recruit/data/model';
import { useId, type ReactNode } from 'react';
import { RulesText } from '../../rules/RulesText';
import { useWording, WordingToggle } from '../../rules/wording';
import { sizeLabel } from './format';
import { factionSheet, optionLine, profileRows, type Bracket, type SheetAbility, type SheetModel, type SheetWeaponRow } from './sheetModel';
import { StatTable } from './StatTable';
import { STAT_KEYS } from './StatGrid';
import { WeaponTable } from './WeaponTable';

export interface DatasheetViewProps {
  unit: UnitOut;
  /** What to show (a unit in a list: listSheet); without it, the unit as added (factionSheet). */
  sheet?: SheetModel;
  /**
   * Weapon names this unit has ("Gauss Flayer", or "10x Gauss Flayer" for a count): shown first, the rest collapsed.
   * Until the list views pass a `sheet` (Plan H Task 5).
   */
  taken?: string[];
  /** The level of the unit's name heading: 1 on the datasheet page, 2 inside sheets. Sections sit one level below. */
  headingLevel?: 1 | 2;
  /** Inside a Sheet already titled with the unit's name: no repeated name heading (the badges and meta line stay). */
  hideName?: boolean;
}

/**
 * Plan D adds `extra?: true` to ProfileOut and AbilityOut (spec §4): weapons and abilities from relics, chapter or
 * Army-of-Renown options rather than the unit's own wargear. Read as an optional flag until then.
 */
const isExtra = (x: ProfileOut | AbilityOut) => (x as { extra?: true }).extra === true;

const TEXT_KEYS: readonly string[] = TEXT_CHARS;

/** "10x Gauss Flayer" → name "gauss flayer", count 10. */
function parseTaken(taken: string[]) {
  return taken.map((t) => {
    const m = /^(\d+)\s*x\s+(.+)$/i.exec(t.trim());
    return m ? { name: m[2].trim().toLowerCase(), count: Number(m[1]) } : { name: t.trim().toLowerCase(), count: undefined };
  });
}

const heading = (level: number) => `h${Math.min(level, 6)}` as 'h2';

function Section({ title, level, children }: { title: string; level: number; children: ReactNode }) {
  const id = useId();
  const H = heading(level);
  return (
    <section className="ds__section" aria-labelledby={id}>
      <H id={id} className="ds__section-title label-caps">
        {title}
      </H>
      {children}
    </section>
  );
}

function WoundTrack({ brackets, level }: { brackets: Bracket[]; level: number }) {
  // Only what changes between brackets; W reads N/A below the top one, so it is never listed.
  const changes = STAT_KEYS.filter(([, key]) => key !== 'W' && new Set(brackets.map((b) => b.profile.chars[key])).size > 1);
  return (
    <>
      <Section title="Wound track" level={level}>
        <ul className="wound-track">
          {brackets.map((b) => (
            <li key={b.label} className="wound-track__row">
              <span className="wound-track__label">{b.label}</span>
              <dl className="wound-track__stats">
                {changes.map(([label, key]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{b.profile.chars[key]?.trim() || '-'}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

/** Psychic powers, a transport's capacity, an old-style wound table: a name, short values in a row, then any text. */
function ProfileCard({ profile }: { profile: ProfileOut }) {
  const { wording } = useWording();
  const id = useId();
  const entries = Object.entries(profile.chars).filter(([, v]) => v?.trim() && v.trim() !== '-');
  const isText = ([k, v]: [string, string]) => TEXT_KEYS.includes(k) || v.length > 24;
  return (
    <article className="profile-card" aria-labelledby={id}>
      <p id={id} className="profile-card__name">
        {profile.name}
      </p>
      {entries.some((e) => !isText(e)) && (
        <dl className="profile-card__chars">
          {entries
            .filter((e) => !isText(e))
            .map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
        </dl>
      )}
      {entries.filter(isText).map(([k, v]) => (
        <p key={k} className="profile-card__text">
          {(wording === 'plain' && profile.plain?.[k]) || v}
        </p>
      ))}
    </article>
  );
}

function Abilities({ abilities, level }: { abilities: SheetAbility[]; level: number }) {
  const H = heading(level);
  return (
    <ul className="ability-list">
      {abilities.map(({ ability: a, who }) => (
        <li key={a.name} className="ability">
          <H className="ability__name">{a.name}</H>
          {who && <p className="ability__who">{who}</p>}
          {a.text ? <RulesText official={a.text} plain={a.plain} amended={a.amended} /> : <p className="muted">No text available.</p>}
        </li>
      ))}
    </ul>
  );
}

/** The legacy list path (until Task 5): the unit's taken weapons with their counts, and the rest. */
function takenRows(unit: UnitOut, taken: string[]): { rows: SheetWeaponRow[]; other: SheetWeaponRow[] } {
  const picks = parseTaken(taken);
  const takenOf = (w: ProfileOut) => {
    const name = w.name.toLowerCase();
    return picks.find((t) => name === t.name || name.startsWith(`${t.name} (`));
  };
  const row = (w: ProfileOut): SheetWeaponRow => ({ name: w.name, profiles: [w], carriedBy: '', ...(takenOf(w)?.count !== undefined && { count: takenOf(w)!.count }) });
  return {
    rows: unit.weapons.filter((w) => takenOf(w)).map(row),
    other: unit.weapons.filter((w) => !takenOf(w) && !isExtra(w)).map(row),
  };
}

/**
 * A unit's datasheet (spec §3, layout B): every stat line, weapon and ability says which model it belongs to. It has no
 * report button: the page that shows it places one (R3).
 */
export function DatasheetView({ unit, sheet: given, taken, headingLevel = 2, hideName = false }: DatasheetViewProps) {
  const section = headingLevel + 1;
  const Name = heading(headingLevel);
  const sheet = given ?? factionSheet(unit);
  const legacy = !given && taken ? takenRows(unit, taken) : null;
  const weapons = legacy ? legacy.rows : sheet.weapons;
  const otherWeapons = legacy ? legacy.other : [];
  const extraWeapons = legacy ? sheet.extras.weapons.filter((w) => !legacy.rows.some((r) => r.profiles.includes(w))) : sheet.extras.weapons;

  const base = unit.baseSize && !/^use model$/i.test(unit.baseSize.trim()) ? unit.baseSize.trim() : null;
  const meta = [
    unit.role,
    sizeLabel(unit),
    unit.points != null && `${unit.points} pts`,
    unit.powerLevel != null && `${unit.powerLevel} PL`,
    base && (/base/i.test(base) ? base : `${base} base`),
    // The army choices that reveal the unit in the builder; any one of them will do.
    unit.needs?.length && `Needs ${unit.needs.join(' or ')}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const badges = (unit.legends || unit.forgeWorld) && (
    <>
      {unit.legends && <span className="badge badge--legends">Legends</span>}
      {unit.forgeWorld && <span className="badge badge--fw">Forge World</span>}
    </>
  );

  return (
    <article className="ds">
      <header className="ds__head">
        {!hideName && (
          <Name className="ds__name">
            {unit.name}
            {badges}
          </Name>
        )}
        {hideName && badges && <p className="ds__badges">{badges}</p>}
        {meta && <p className="ds__meta">{meta}</p>}
        {unit.amended && <p className="note note--update">Rules update: {unit.amended}</p>}
        <WordingToggle />
      </header>

      {sheet.models.length > 0 && (
        <Section title="Models" level={section}>
          <ul className="ds-models">
            {sheet.models.map((m) => (
              <li key={`${m.name}|${m.gear.join('|')}`}>
                <span className="ds-models__name">{`${m.count}x ${m.name}`}</span>
                {m.gear.length > 0 && `: ${m.gear.join(', ')}`}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <StatTable rows={sheet.stats} />
      {sheet.stats.filter((r) => r.track).map((r) => (
        <WoundTrack key={r.label} brackets={r.track!} level={section} />
      ))}
      {unit.woundTrack.length > 0 && (
        <Section title="Wound track" level={section}>
          {unit.woundTrack.map((p) => (
            <ProfileCard key={p.name} profile={p} />
          ))}
        </Section>
      )}

      {(weapons.length > 0 || otherWeapons.length > 0) && (
        <Section title="Weapons" level={section}>
          <WeaponTable rows={weapons} />
          {otherWeapons.length > 0 && (
            <details className="ds__more">
              <summary>Other wargear options</summary>
              <WeaponTable rows={otherWeapons} />
            </details>
          )}
        </Section>
      )}

      {!legacy && sheet.options.length > 0 && (
        <details className="ds__more ds-options">
          <summary>Options</summary>
          <ul className="ds-options__list">
            {sheet.options.map((o, i) => {
              const line = optionLine(o, unit.weapons);
              return (
                <li key={`${o.name}|${i}`} className="ds-options__item">
                  <p className="ds-options__choices">{line.text}</p>
                  <WeaponTable rows={profileRows(unit, line.choices)} />
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {unit.psychic.length > 0 && (
        <Section title="Psychic" level={section}>
          {unit.psychic.map((p) => (
            <ProfileCard key={p.name} profile={p} />
          ))}
        </Section>
      )}

      {sheet.abilities.length > 0 && (
        <Section title="Abilities" level={section}>
          <Abilities abilities={sheet.abilities} level={section + 1} />
        </Section>
      )}

      {!legacy && sheet.canAlsoTake.length > 0 && (
        <Section title="Can also take" level={section}>
          <ul className="ds-models">
            {sheet.canAlsoTake.map((k) => (
              <li key={k.name}>
                <span className="ds-models__name">{k.name}</span>
                {k.weapons.length > 0 && `: ${k.weapons.map((i) => unit.weapons[i]?.name).filter(Boolean).join(', ')}`}
              </li>
            ))}
          </ul>
          <StatTable rows={sheet.canAlsoTake.filter((k) => unit.models[k.profile]).map((k) => ({ label: k.name, profile: unit.models[k.profile] }))} />
        </Section>
      )}

      {(extraWeapons.length > 0 || sheet.extras.abilities.length > 0) && (
        <details className="ds__more">
          <summary>Also available</summary>
          <WeaponTable rows={extraWeapons.map((w) => ({ name: w.name, profiles: [w], carriedBy: '' }))} />
          {sheet.extras.abilities.length > 0 && <Abilities abilities={sheet.extras.abilities.map((ability) => ({ ability, who: '' }))} level={section + 1} />}
        </details>
      )}

      {unit.transport && (
        <Section title="Transport" level={section}>
          <ProfileCard profile={unit.transport} />
        </Section>
      )}

      {(sheet.keywords.unit.length > 0 || sheet.keywords.faction.length > 0) && (
        <Section title="Keywords" level={section}>
          <p className="ds__keywords">
            {sheet.keywords.faction.length > 0 && (
              <>
                <span className="muted">Faction:</span> {sheet.keywords.faction.join(', ')}
                <br />
              </>
            )}
            {sheet.keywords.unit.length > 0 && (
              <>
                <span className="muted">Unit:</span> {sheet.keywords.unit.join(', ')}
              </>
            )}
            {sheet.keywords.perModel.map((m) => (
              <span key={m.model} className="ds__keywords-model">
                <br />
                <span className="muted">{`${m.model}:`}</span> {m.keywords.join(', ')}
              </span>
            ))}
          </p>
        </Section>
      )}
    </article>
  );
}

import { TEXT_CHARS, type AbilityOut, type ProfileOut, type UnitOut } from '@recruit/data/model';
import { useId, type ReactNode } from 'react';
import { RulesText } from '../../rules/RulesText';
import { useWording, WordingToggle } from '../../rules/wording';
import { sizeLabel } from './format';
import { STAT_KEYS, StatGrid } from './StatGrid';
import { WeaponCard } from './WeaponCard';

export interface DatasheetViewProps {
  unit: UnitOut;
  /** Weapon names this unit has ("Gauss Flayer", or "10x Gauss Flayer" for a count): shown first, the rest collapsed. */
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

/** "Doomsday Ark [2] (4-7 Wounds Remaining)" → base "Doomsday Ark", label "4–7 wounds left". */
const BRACKET = /^(.*?)\s*\[\d+\]\s*\((\d+)\s*(\+|-\s*(\d+))?\s*wounds?\s+remaining\)\s*$/i;
function bracketOf(name: string): { base: string; label: string } | null {
  const m = BRACKET.exec(name);
  if (!m) return null;
  const [, base, from, sign, to] = m;
  const label = to ? `${from}–${to} wounds left` : sign === '+' ? `${from}+ wounds left` : `${from} ${from === '1' ? 'wound' : 'wounds'} left`;
  return { base, label };
}

type StatBlock = { kind: 'model'; profile: ProfileOut } | { kind: 'track'; base: string; brackets: { label: string; profile: ProfileOut }[] };

/** Model profiles, with a degrading model's brackets folded into one stat grid plus a wound track. */
function statBlocks(models: ProfileOut[]): StatBlock[] {
  const blocks: StatBlock[] = [];
  for (const profile of models) {
    const b = bracketOf(profile.name);
    if (!b) {
      blocks.push({ kind: 'model', profile });
      continue;
    }
    const track = blocks.find((x): x is Extract<StatBlock, { kind: 'track' }> => x.kind === 'track' && x.base === b.base);
    if (track) track.brackets.push({ label: b.label, profile });
    else blocks.push({ kind: 'track', base: b.base, brackets: [{ label: b.label, profile }] });
  }
  return blocks;
}

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

function WoundTrack({ base, brackets, level }: { base: string; brackets: { label: string; profile: ProfileOut }[]; level: number }) {
  // Only what changes between brackets; W reads N/A below the top one, so it is never listed.
  const changes = STAT_KEYS.filter(([, key]) => key !== 'W' && new Set(brackets.map((b) => b.profile.chars[key])).size > 1);
  return (
    <>
      <StatGrid profile={{ ...brackets[0].profile, name: base }} />
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

function Abilities({ abilities, level }: { abilities: AbilityOut[]; level: number }) {
  const H = heading(level);
  return (
    <ul className="ability-list">
      {abilities.map((a) => (
        <li key={a.name} className="ability">
          <H className="ability__name">{a.name}</H>
          {a.text ? <RulesText official={a.text} plain={a.plain} amended={a.amended} /> : <p className="muted">No text available.</p>}
        </li>
      ))}
    </ul>
  );
}

/**
 * A unit's datasheet, laid out for a phone: stat boxes instead of a wide table, a card per weapon, then abilities and
 * keywords. It has no report button: the page that shows it places one (R3).
 */
export function DatasheetView({ unit, taken, headingLevel = 2, hideName = false }: DatasheetViewProps) {
  const section = headingLevel + 1;
  const Name = heading(headingLevel);

  const picks = taken && parseTaken(taken);
  const takenOf = (w: ProfileOut) => {
    const name = w.name.toLowerCase();
    return picks?.find((t) => name === t.name || name.startsWith(`${t.name} (`));
  };
  const weapons = picks ? unit.weapons.filter((w) => takenOf(w)) : unit.weapons.filter((w) => !isExtra(w));
  const otherWeapons = picks ? unit.weapons.filter((w) => !takenOf(w) && !isExtra(w)) : [];
  const alsoWeapons = unit.weapons.filter((w) => isExtra(w) && !(picks && takenOf(w)));
  const abilities = unit.abilities.filter((a) => !isExtra(a));
  const alsoAbilities = unit.abilities.filter(isExtra);

  const base = unit.baseSize && !/^use model$/i.test(unit.baseSize.trim()) ? unit.baseSize.trim() : null;
  const meta = [
    unit.role,
    sizeLabel(unit),
    unit.points != null && `${unit.points} pts`,
    unit.powerLevel != null && `${unit.powerLevel} PL`,
    base && (/base/i.test(base) ? base : `${base} base`),
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

      {statBlocks(unit.models).map((b) =>
        b.kind === 'model' ? (
          <StatGrid key={b.profile.name} profile={b.profile} />
        ) : (
          <WoundTrack key={b.base} base={b.base} brackets={b.brackets} level={section} />
        ),
      )}
      {unit.woundTrack.length > 0 && (
        <Section title="Wound track" level={section}>
          {unit.woundTrack.map((p) => (
            <ProfileCard key={p.name} profile={p} />
          ))}
        </Section>
      )}

      {(weapons.length > 0 || otherWeapons.length > 0) && (
        <Section title="Weapons" level={section}>
          {weapons.map((w) => (
            <WeaponCard key={w.name} weapon={w} count={takenOf(w)?.count} />
          ))}
          {otherWeapons.length > 0 && (
            <details className="ds__more">
              <summary>Other wargear options</summary>
              {otherWeapons.map((w) => (
                <WeaponCard key={w.name} weapon={w} />
              ))}
            </details>
          )}
        </Section>
      )}

      {unit.psychic.length > 0 && (
        <Section title="Psychic" level={section}>
          {unit.psychic.map((p) => (
            <ProfileCard key={p.name} profile={p} />
          ))}
        </Section>
      )}

      {abilities.length > 0 && (
        <Section title="Abilities" level={section}>
          <Abilities abilities={abilities} level={section + 1} />
        </Section>
      )}

      {(alsoWeapons.length > 0 || alsoAbilities.length > 0) && (
        <details className="ds__more">
          <summary>Also available</summary>
          {alsoWeapons.map((w) => (
            <WeaponCard key={w.name} weapon={w} />
          ))}
          {alsoAbilities.length > 0 && <Abilities abilities={alsoAbilities} level={section + 1} />}
        </details>
      )}

      {unit.transport && (
        <Section title="Transport" level={section}>
          <ProfileCard profile={unit.transport} />
        </Section>
      )}

      {(unit.keywords.length > 0 || unit.factionKeywords.length > 0) && (
        <Section title="Keywords" level={section}>
          <p className="ds__keywords">
            {unit.factionKeywords.length > 0 && (
              <>
                <span className="muted">Faction:</span> {unit.factionKeywords.join(', ')}
                <br />
              </>
            )}
            {unit.keywords.length > 0 && (
              <>
                <span className="muted">Unit:</span> {unit.keywords.join(', ')}
              </>
            )}
          </p>
        </Section>
      )}
    </article>
  );
}

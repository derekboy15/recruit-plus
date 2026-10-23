import { TEXT_CHARS, type AbilityOut, type ProfileOut, type UnitOut } from '@recruit/data/model';
import { Link, useParams } from 'react-router-dom';
import { ReportButton } from '../rules/ReportButton';
import { RulesText } from '../rules/RulesText';
import { useWording, WordingToggle } from '../rules/wording';
import { getCatalogue } from './dataClient';
import { useAsync } from './useAsync';
import { LoadError } from '../layout/OfflineNotice';

const TEXT_COLUMNS: readonly string[] = TEXT_CHARS;

const MODEL_STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'A', 'Ld', 'Save'];

/** Columns present in any profile of the list, in first-seen order. */
function columns(profiles: ProfileOut[], preferred: string[] = []): string[] {
  const seen = new Set<string>(preferred.filter((p) => profiles.some((x) => p in x.chars)));
  profiles.forEach((p) => Object.keys(p.chars).forEach((k) => seen.add(k)));
  return [...seen];
}

function ProfileTable({ caption, profiles, preferred }: { caption: string; profiles: ProfileOut[]; preferred?: string[] }) {
  const { wording } = useWording();
  if (!profiles.length) return null;
  const cols = columns(profiles, preferred);
  // Rules text columns show the plain English when it is chosen and exists.
  const cell = (p: ProfileOut, c: string) => (wording === 'plain' && TEXT_COLUMNS.includes(c) && p.plain?.[c]) || (p.chars[c] ?? '');
  return (
    <div className="table-scroll" style={{ marginBottom: '1rem' }}>
      <table className="stats">
        <caption className="muted" style={{ textAlign: 'left', padding: '0.4rem 0.6rem' }}>
          {caption}
        </caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            {cols.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.name}>
              <td>{p.name}</td>
              {cols.map((c) => (
                <td key={c} style={TEXT_COLUMNS.includes(c) ? { whiteSpace: 'normal', minWidth: '16rem', textAlign: 'left' } : undefined}>
                  {cell(p, c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AbilityCard({ a }: { a: AbilityOut }) {
  const { wording } = useWording();
  return (
    <div className="card" style={{ marginBottom: '0.5rem' }}>
      <h3 style={{ marginTop: 0 }}>{a.name}</h3>
      {a.text ? <RulesText official={a.text} plain={a.plain} amended={a.amended} /> : <p className="muted">No text available.</p>}
      {a.text && <ReportButton target={{ kind: 'ability', name: a.name }} text={wording === 'plain' && a.plain ? a.plain : a.text} />}
    </div>
  );
}

export function Datasheet({ unit }: { unit: UnitOut }) {
  const size =
    unit.minModels == null ? null : unit.minModels === unit.maxModels ? `${unit.minModels}` : `${unit.minModels}–${unit.maxModels}`;
  return (
    <article>
      <h1>
        {unit.name}
        {unit.legends && <span className="badge badge--legends">Legends</span>}
        {unit.forgeWorld && <span className="badge badge--fw">Forge World</span>}
      </h1>
      <p className="muted">
        {[unit.role, size && `${size} models`, unit.points != null && `${unit.points} pts`, unit.powerLevel != null && `${unit.powerLevel} PL`, unit.baseSize && `Base: ${unit.baseSize}`]
          .filter(Boolean)
          .join(' · ')}
      </p>
      {unit.amended && <p className="note note--update">Rules update: {unit.amended}</p>}
      <WordingToggle />
      <ProfileTable caption="Profile" profiles={unit.models} preferred={MODEL_STATS} />
      <ProfileTable caption="Wound track" profiles={unit.woundTrack} />
      <ProfileTable caption="Weapons" profiles={unit.weapons} preferred={['Range', 'Type', 'S', 'AP', 'D', 'Abilities']} />
      <ProfileTable caption="Psychic" profiles={unit.psychic} />
      {unit.transport && <ProfileTable caption="Transport" profiles={[unit.transport]} />}
      {unit.abilities.length > 0 && (
        <section>
          <h2>Abilities</h2>
          {unit.abilities.map((a) => (
            <AbilityCard key={a.name} a={a} />
          ))}
        </section>
      )}
      {(unit.keywords.length > 0 || unit.factionKeywords.length > 0) && (
        <section>
          <h2>Keywords</h2>
          <p>{unit.keywords.join(', ')}</p>
          {unit.factionKeywords.length > 0 && <p className="muted">Faction: {unit.factionKeywords.join(', ')}</p>}
        </section>
      )}
      {/* Profile, weapon and keyword errors: one report for the whole datasheet. */}
      <ReportButton target={{ kind: 'datasheet', name: unit.name }} text={unit.name} />
    </article>
  );
}

export function DatasheetPage() {
  const { slug = '', unitSlug = '' } = useParams();
  const state = useAsync(() => getCatalogue(slug), slug);
  if (state.status === 'loading') return <p className="muted">Loading datasheet…</p>;
  if (state.status === 'error') return <LoadError error={state.error} what="this faction" />;
  const unit = state.data.units.find((u) => u.slug === unitSlug);
  if (!unit) return <p role="alert">Unit not found.</p>;
  return (
    <>
      <p>
        <Link to={`/factions/${slug}`}>← {state.data.name}</Link>
      </p>
      <Datasheet unit={unit} />
    </>
  );
}

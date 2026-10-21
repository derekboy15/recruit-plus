import type { ProfileOut, UnitOut } from '@recruit/data/model';
import { Link, useParams } from 'react-router-dom';
import { getCatalogue } from './dataClient';
import { useAsync } from './useAsync';

const MODEL_STATS = ['M', 'WS', 'BS', 'S', 'T', 'W', 'A', 'Ld', 'Save'];

/** Columns present in any profile of the list, in first-seen order. */
function columns(profiles: ProfileOut[], preferred: string[] = []): string[] {
  const seen = new Set<string>(preferred.filter((p) => profiles.some((x) => p in x.chars)));
  profiles.forEach((p) => Object.keys(p.chars).forEach((k) => seen.add(k)));
  return [...seen];
}

function ProfileTable({ caption, profiles, preferred }: { caption: string; profiles: ProfileOut[]; preferred?: string[] }) {
  if (!profiles.length) return null;
  const cols = columns(profiles, preferred);
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
                <td key={c} style={c === 'Abilities' ? { whiteSpace: 'normal', minWidth: '16rem', textAlign: 'left' } : undefined}>
                  {p.chars[c] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
      <ProfileTable caption="Profile" profiles={unit.models} preferred={MODEL_STATS} />
      <ProfileTable caption="Wound track" profiles={unit.woundTrack} />
      <ProfileTable caption="Weapons" profiles={unit.weapons} preferred={['Range', 'Type', 'S', 'AP', 'D', 'Abilities']} />
      <ProfileTable caption="Psychic" profiles={unit.psychic} />
      {unit.transport && <ProfileTable caption="Transport" profiles={[unit.transport]} />}
      {unit.abilities.length > 0 && (
        <section>
          <h2>Abilities</h2>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Official wording shown. Plain-English explanations arrive in Milestone 3.
          </p>
          {unit.abilities.map((a) => (
            <div key={a.name} className="card" style={{ marginBottom: '0.5rem' }}>
              <h3 style={{ marginTop: 0 }}>{a.name}</h3>
              <p style={{ whiteSpace: 'pre-line', margin: 0 }}>{a.text || <span className="muted">No text available.</span>}</p>
            </div>
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
    </article>
  );
}

export function DatasheetPage() {
  const { slug = '', unitSlug = '' } = useParams();
  const state = useAsync(() => getCatalogue(slug), slug);
  if (state.status === 'loading') return <p className="muted">Loading datasheet…</p>;
  if (state.status === 'error') return <p role="alert">Couldn’t load this faction: {state.error.message}</p>;
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

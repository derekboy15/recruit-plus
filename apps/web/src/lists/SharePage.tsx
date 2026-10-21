/** The read-only page behind a share link. Opens without signing in; nothing here edits or saves anything. */
import {
  BATTLE_SIZES,
  COST_CP,
  COST_PL,
  COST_PTS,
  exportText,
  stripCpSuffix,
  validate,
  type ForceView,
  type Issue,
  type RosterView,
  type Scope,
  type SelView,
} from '@recruit/data/roster';
import { Link, useParams } from 'react-router-dom';
import { getIndex, getPolicy, getRosterScope } from '../factions/dataClient';
import { factionDisplayName } from '../factions/names';
import { useAsync } from '../factions/useAsync';
import { CopyButton } from './ExportSheet';
import { fmt, isArmyOption, isAutoManaged, problemsLabel, unitsByRole } from './editorView';
import { usePublicSource, type PublicListSource } from './publicSource';
import { slugsFor } from './useRosterEditor';

interface Shared {
  view: RosterView;
  issues: Issue[];
  scope: Scope;
  text: string;
  faction: string;
  updatedAt: number;
}

async function loadShared(source: PublicListSource, id: string): Promise<Shared | null> {
  const found = await source.get(id);
  if (!found) return null;
  const { roster, summary } = found.data;
  const [{ catalogues }, policy] = await Promise.all([getIndex(), getPolicy()]);
  const primary = catalogues.find((c) => c.id === roster.catalogueId)?.slug ?? summary.catalogueSlug;
  const scope = await getRosterScope(slugsFor(roster, catalogues, primary));
  const { view, issues } = validate(scope, roster, policy);
  const catalogue = scope.catalogue(roster.catalogueId)?.name;
  return {
    view,
    issues,
    scope,
    text: exportText(view, scope),
    faction: catalogue ? factionDisplayName(catalogue) : summary.faction,
    updatedAt: found.updatedAt,
  };
}

/**
 * One unit as the export prints it: the "- Name (N models) · 110 pts" line, then its indented wargear lines. Asking the
 * export for a list of just this unit keeps the page and the copied text saying exactly the same thing.
 */
function unitLines(view: RosterView, scope: Scope, fv: ForceView, unit: SelView): { head: string; points: string; details: string[] } {
  const lines = exportText({ ...view, forces: [{ ...fv, selections: [unit] }] }, scope).split('\n');
  const start = lines.indexOf('') + 3; // past the name and totals, the blank line, the detachment line and the role line
  const [first = '', ...rest] = lines.slice(start, lines.indexOf('', start));
  const cut = first.lastIndexOf(' · ');
  return {
    head: first.slice(0, cut < 0 ? undefined : cut).replace(/^- /, ''),
    points: cut < 0 ? '' : first.slice(cut + 3),
    details: rest.map((l) => l.trim()),
  };
}

/** "Dynasty Choice: Szarekhan" lines for the army choices the player made. */
const armyChoices = (scope: Scope, fv: ForceView) =>
  fv.selections
    .filter((v) => v.merged && isArmyOption(scope, v) && !isAutoManaged(v) && v.children.length > 0)
    .map((v) => `${v.name}: ${v.children.map((c) => c.name).join(', ')}`);

function Detachment({ shared, fv }: { shared: Shared; fv: ForceView }) {
  const { view, scope } = shared;
  const choices = armyChoices(scope, fv);
  const groups = unitsByRole(scope, fv);
  return (
    <section className="detachment" aria-label={stripCpSuffix(fv.name)}>
      <h2 className="detachment__title">{stripCpSuffix(fv.name)}</h2>
      {choices.map((c) => (
        <p key={c} className="muted share__choice">
          {c}
        </p>
      ))}
      {groups.length === 0 && <p className="muted">No units in this detachment.</p>}
      {groups.map((g) => (
        <div key={g.role}>
          <h3 className="role-head">{g.role}</h3>
          <ul className="list">
            {g.units.map((v) => {
              if (!v.merged) {
                return (
                  <li key={v.sel.id} className="share__unit">
                    <span className="share__name">{v.name}</span>
                  </li>
                );
              }
              const { head, points, details } = unitLines(view, scope, fv, v);
              return (
                <li key={v.sel.id} className="share__unit">
                  <div className="share__line">
                    <span className="share__name">{head}</span>
                    <span className="row__pts">{points}</span>
                  </div>
                  {details.length > 0 && (
                    <ul className="share__gear muted">
                      {details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}

const buildYourOwn = (
  <Link to="/" className="btn">
    Build your own
  </Link>
);

export function SharePage() {
  const { id = '' } = useParams();
  const { source } = usePublicSource();
  const state = useAsync(() => loadShared(source, id), id);

  if (state.status === 'loading') return <p className="muted">Loading the list…</p>;
  if (state.status === 'error') {
    return (
      <section>
        <p role="alert">{`Couldn’t open this list: ${state.error.message}`}</p>
        {buildYourOwn}
      </section>
    );
  }
  if (!state.data) {
    return (
      <section>
        <h1>List not found</h1>
        <p>This list isn't shared, or the link is wrong.</p>
        {buildYourOwn}
      </section>
    );
  }

  const shared = state.data;
  const { view, issues, faction } = shared;
  const { roster, total } = view;
  const size = BATTLE_SIZES[roster.battleSize];
  const updated = new Date(shared.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <article className="share">
      <header>
        <h1>{roster.name}</h1>
        <p className="muted share__sub">{`${faction} · ${size?.name ?? roster.battleSize}`}</p>
        <p className="share__totals">
          <span className="share__pts">{`${fmt(total[COST_PTS] ?? 0)} / ${fmt(size?.points ?? 0)} pts`}</span>
          <span className="muted">{` · ${fmt(total[COST_PL] ?? 0)} PL · ${fmt(total[COST_CP] ?? 0)} CP `}</span>
          <span className={`status ${issues.length ? 'status--bad' : 'status--ok'}`}>{problemsLabel(issues.length)}</span>
        </p>
        <p className="muted">{`Read-only copy, last updated ${updated}.`}</p>
      </header>
      <div className="sheet-actions">
        <CopyButton text={shared.text} label="Copy list" className="btn btn--primary" />
        {buildYourOwn}
      </div>
      {view.forces.map((fv) => (
        <Detachment key={fv.force.id} shared={shared} fv={fv} />
      ))}
    </article>
  );
}

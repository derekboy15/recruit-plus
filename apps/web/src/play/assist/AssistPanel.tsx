/**
 * Faction assistance (spec §3.3): for the units involved right now, their abilities (this phase's first) in plain
 * English with the official-wording switch, one-tap modifiers, the acting player's stratagems for the moment, and the
 * army rules.
 */
import type { StratagemOut } from '@recruit/data/model';
import { sheetOf, type Problem } from '@recruit/engine';
import { RulesText } from '../../rules/RulesText';
import { WordingToggle } from '../../rules/wording';
import { armyName } from '../game/names';
import type { PanelProps } from '../panels/types';
import { isRelevant, relevantAbilities, useUnitTexts } from './abilities';
import { ModifierBar } from './ModifierBar';
import { momentFor, stratagemsNow } from './stratagems';

const firstSentence = (t: string) => {
  const m = /^.*?[.!?](\s|$)/.exec(t.trim());
  return (m ? m[0] : t).trim().slice(0, 160);
};
const costs = (cp: string) => [...new Set(cp.split('/').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n)))];

function StratagemCard({ st, onUse }: { st: StratagemOut; onUse(cp: number): void }) {
  return (
    <li className="play-strat">
      <p>
        <strong>{st.name}</strong> <span className="muted">· {st.cp} CP · {st.group}</span>
      </p>
      <RulesText official={st.text} plain={st.plain} amended={st.amended} />
      <div className="play-row">
        {costs(st.cp).map((n) => (
          <button key={n} type="button" className="btn btn--small" onClick={() => onUse(n)}>
            Use ({n} CP)
          </button>
        ))}
      </div>
    </li>
  );
}

export function AssistPanel(props: PanelProps) {
  const { sb, ui } = props;
  const s = sb.state;
  const meta = sb.doc.data.meta;
  const { texts, armyRules, stratagems, loading, error } = useUnitTexts(meta);
  const acting = sb.step.actingPlayer;
  const ids = [...new Set([ui.selectedUnitId, ...sb.step.involvedUnitIds].filter((x): x is string => !!x && !!s.units[x]))];
  const now = stratagemsNow(stratagems[acting] ?? [], momentFor(s, acting));
  const use = (st: StratagemOut, cp: number) => {
    const unitIds = ui.selectedUnitId && s.units[ui.selectedUnitId]?.player === acting ? [ui.selectedUnitId] : [];
    ui.setProblems((sb.act({ type: 'useStratagem', by: acting, name: st.name, cp, unitIds, note: firstSentence(st.plain ?? st.text) }) as Problem[] | null) ?? []);
  };

  return (
    <details className="play-assist" open>
      <summary>Faction rules for this moment</summary>
      <WordingToggle />
      {loading && <p className="muted">Loading faction rules…</p>}
      {error && <p className="muted">{error}</p>}
      {ids.map((id) => {
        const unit = texts.get(sheetOf(s, id).id);
        const abilities = unit ? relevantAbilities(unit, s.phase) : [];
        const lead = abilities.filter((a) => isRelevant(a, s.phase));
        const rest = abilities.filter((a) => !isRelevant(a, s.phase));
        return (
          <section key={id} aria-label={s.units[id].name} className="play-assist__unit">
            <h3>
              {s.units[id].name} <span className="muted play-small">({armyName(s, s.units[id].player)})</span>
            </h3>
            {lead.map((a) => (
              <div key={a.name}>
                <h4>{a.name}</h4>
                <RulesText official={a.text} plain={a.plain} amended={a.amended} />
              </div>
            ))}
            {rest.length > 0 && (
              <details className="play-details">
                <summary>{lead.length ? 'Other abilities' : 'Abilities'}</summary>
                {rest.map((a) => (
                  <div key={a.name}>
                    <h4>{a.name}</h4>
                    <RulesText official={a.text} plain={a.plain} amended={a.amended} />
                  </div>
                ))}
              </details>
            )}
            {s.phase !== 'pre-battle' && <ModifierBar {...props} unitId={id} />}
          </section>
        );
      })}
      {!loading && (
        <section aria-label="Stratagems now" className="play-assist__strats">
          <h3>{armyName(s, acting)}: stratagems you could use now</h3>
          {now.length ? (
            <ul className="list">
              {now.map((st) => (
                <StratagemCard key={st.id} st={st} onUse={(cp) => use(st, cp)} />
              ))}
            </ul>
          ) : (
            <p className="muted">None for this moment.</p>
          )}
          <p className="muted play-small">Using one spends its CP and logs it; apply what it does with the one-tap rules or the toolkit.</p>
        </section>
      )}
      {!loading && (
        <section aria-label="Army rules">
          <h3>Army rules</h3>
          {(['A', 'B'] as const).map((p) =>
            armyRules[p].length ? (
              <details key={p} className="play-details">
                <summary>{armyName(s, p)}</summary>
                {armyRules[p].map((r) => (
                  <details key={r.id} className="play-details">
                    <summary>{r.name}</summary>
                    <RulesText official={r.text} plain={r.plain} amended={r.amended} />
                  </details>
                ))}
              </details>
            ) : null,
          )}
        </section>
      )}
    </details>
  );
}

import type { StratagemOut } from '@recruit/data/model';
import type { ReportPart } from '../rules/ReportButton';
import { RulesText } from '../rules/RulesText';
import type { Wording } from '../rules/wording';

/** The stratagems on a page as report parts, each with the text the reader sees. */
export const stratagemParts = (all: StratagemOut[], wording: Wording): ReportPart[] =>
  all.map((s) => ({ name: s.name, text: wording === 'plain' && s.plain ? s.plain : s.text }));

/** One stratagem: name, cost, kind and phases, and its text in the chosen wording. The page has the report button. */
export function StratagemCard({ s }: { s: StratagemOut }) {
  return (
    <article id={`strat-${s.id}`} className="card stratagem">
      <h3 style={{ margin: 0 }}>{s.name}</h3>
      <p className="muted stratagem__meta">{[`${s.cp} CP`, s.kind, s.phases.join(', ')].filter(Boolean).join(' · ')}</p>
      <RulesText official={s.text} plain={s.plain} amended={s.amended} />
    </article>
  );
}

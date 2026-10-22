import type { StratagemOut } from '@recruit/data/model';
import { ReportButton } from '../rules/ReportButton';
import { RulesText } from '../rules/RulesText';
import { useWording } from '../rules/wording';

/** One stratagem: name, cost, kind and phases, its text in the chosen wording, and a report button. */
export function StratagemCard({ s }: { s: StratagemOut }) {
  const { wording } = useWording();
  return (
    <article id={`strat-${s.id}`} className="card stratagem">
      <h3 style={{ margin: 0 }}>{s.name}</h3>
      <p className="muted stratagem__meta">{[`${s.cp} CP`, s.kind, s.phases.join(', ')].filter(Boolean).join(' · ')}</p>
      <RulesText official={s.text} plain={s.plain} amended={s.amended} />
      <ReportButton target={{ kind: 'stratagem', name: s.name }} text={wording === 'plain' && s.plain ? s.plain : s.text} />
    </article>
  );
}

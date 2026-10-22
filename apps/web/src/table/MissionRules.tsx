import type { MissionOut } from '@recruit/data/missions';
import { RulesText } from '../rules/RulesText';

/** A mission's rules and primary objective in the chosen wording, plus anything we couldn't confirm. */
export function MissionRules({ mission }: { mission: MissionOut }) {
  return (
    <div className="mission-rules">
      {mission.rules.map((r) => (
        <article key={r.id} className="card">
          <h3>{r.name}</h3>
          <RulesText official={r.text} plain={r.plain} amended={r.amended} />
        </article>
      ))}
      <article className="card">
        <h3>Primary: {mission.primary.name}</h3>
        <RulesText official={mission.primary.text} plain={mission.primary.plain} amended={mission.primary.amended} />
      </article>
      {mission.unverified.map((u) => (
        <p key={u} className="note note--unconfirmed">Not confirmed: {u}</p>
      ))}
    </div>
  );
}

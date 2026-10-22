import { useEffect, useRef, useState } from 'react';
import { cpBonusPlan, type CpExtra, type CpGate, type MissionOut, type PlayerKey } from '@recruit/data/missions';
import type { EventBody, Pos } from './game';

type Question = { kind: 'gate'; gate: CpGate } | { kind: 'extra'; extra: CpExtra };

const ruleName = (mission: MissionOut, id: string) => mission.rules.find((r) => r.id === id.replace(/-extra$/, ''))?.name ?? 'Mission rule';

/**
 * The start-of-Command-phase CP for one player: the Battle-forged CP bonus and any mission rule that takes it away or
 * adds to it. Questions are asked one at a time; with none to ask it resolves by itself.
 */
export function CpPrompt({ mission, pos, player, active, name, roll, onResolve }: {
  mission: MissionOut; pos: Pos; player: PlayerKey; active: PlayerKey; name: string;
  roll: (sides: 3 | 6) => number; onResolve: (events: EventBody[]) => void;
}) {
  const plan = cpBonusPlan(mission.cp, { round: pos.round, player, active });
  const questions: Question[] = [
    ...plan.gates.filter((g) => g.question).map((gate) => ({ kind: 'gate' as const, gate })),
    ...plan.extras.filter((e) => e.question).map((extra) => ({ kind: 'extra' as const, extra })),
  ];
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [rolls, setRolls] = useState<{ gate: string; value: number }[]>([]);
  const done = useRef(false);

  const finish = (answered: boolean[], rolled: { gate: string; value: number }[]) => {
    if (done.current) return;
    done.current = true;
    const events: EventBody[] = rolled.map((r) => ({ t: 'roll', label: `${ruleName(mission, r.gate)} (${name})`, sides: 6, dice: [r.value] }));
    let lostBy: string | null = plan.base === 0 ? (mission.cp.gates.find((g) => !g.question && (!g.rounds || g.rounds.includes(pos.round)))?.id ?? 'mission') : null;
    questions.forEach((q, i) => {
      if (q.kind !== 'gate' || answered[i]) return;
      const r = rolled.find((x) => x.gate === q.gate.id);
      if (q.gate.onNo === 'lose' || (r && r.value <= 3)) lostBy ??= q.gate.id;
    });
    events.push({
      t: 'cp', player, delta: lostBy ? 0 : 1, reason: 'bonus',
      note: lostBy ? `No Battle-forged CP bonus (${ruleName(mission, lostBy)})` : 'Battle-forged CP bonus',
    });
    for (const e of plan.extras) {
      const i = questions.findIndex((q) => q.kind === 'extra' && q.extra.id === e.id);
      if (i === -1 || answered[i]) events.push({ t: 'cp', player, delta: e.cp, reason: 'mission', note: ruleName(mission, e.id) });
    }
    onResolve(events);
  };

  useEffect(() => {
    if (questions.length === 0) finish([], []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (questions.length === 0) return null;

  const i = answers.length;
  const q = questions[i];
  const answer = (yes: boolean) => {
    const next = [...answers, yes];
    let rolled = rolls;
    if (!yes && q.kind === 'gate' && q.gate.onNo === 'roll-1-3-lose') rolled = [...rolls, { gate: q.gate.id, value: roll(6) }];
    setAnswers(next);
    setRolls(rolled);
    if (next.length === questions.length) finish(next, rolled);
  };
  const lastRoll = rolls.at(-1);
  return (
    <section className="card prompt" aria-label={`Command phase CP: ${name}`}>
      <h2>Command phase CP: {name}</h2>
      {lastRoll && <p role="status">Rolled a {lastRoll.value}: {lastRoll.value <= 3 ? 'no Battle-forged CP bonus this phase.' : 'the bonus stands.'}</p>}
      {q && (
        <>
          <p className="muted">{q.kind === 'gate' ? ruleName(mission, q.gate.id) : ruleName(mission, q.extra.id)}</p>
          <p>{q.kind === 'gate' ? q.gate.question : q.extra.question}</p>
          {q.kind === 'gate' && q.gate.onNo === 'roll-1-3-lose' && <p className="muted">If not, the app rolls a D6: on a 1-3 there's no bonus this phase.</p>}
          <div className="prompt__actions">
            <button type="button" className="btn btn--primary" onClick={() => answer(true)}>Yes</button>
            <button type="button" className="btn" onClick={() => answer(false)}>No</button>
          </div>
        </>
      )}
    </section>
  );
}

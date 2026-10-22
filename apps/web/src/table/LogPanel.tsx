import { useState } from 'react';
import type { MissionsOut } from '@recruit/data/missions';
import { activePlayer, makeEvent, type TableEvent, type TableGameData, type TableSetup, type TablePhase } from './game';
import { PHASE_NAME, turnOf } from './Scoreboard';

const SHORT: Record<TablePhase, string> = {
  command: 'Command', movement: 'Movement', psychic: 'Psychic', shooting: 'Shooting', charge: 'Charge', fight: 'Fight', morale: 'Morale',
};
const END: Record<string, string> = { complete: 'all 5 battle rounds played', agreed: 'the players agreed to stop' };

/** One event in words, e.g. "Round 2 · You · Command: You +1 CP (Battle-forged CP bonus)". */
export function describeEvent(e: TableEvent, setup: TableSetup, missions: MissionsOut): string {
  const name = (p: 'A' | 'B') => setup.players[p].name;
  if (e.t === 'start') return 'Game started';
  if (e.t === 'advance') return `Round ${e.to.round} · ${turnOf(name(activePlayer(setup, e.to)))} · ${PHASE_NAME[e.to.phase]}`;
  const where = e.pos ? `Round ${e.pos.round} · ${name(activePlayer(setup, e.pos))} · ${SHORT[e.pos.phase]}: ` : '';
  const secondaryName = (id: string) =>
    missions.packs.flatMap((p) => p.secondaries).find((s) => s.id === id)?.name ??
    missions.missions.find((m) => m.missionSecondary?.id === id)?.missionSecondary?.name ??
    id;
  switch (e.t) {
    case 'cp':
      if (e.delta === 0) return `${where}${name(e.player)}: ${e.note ?? 'no CP'}`;
      return `${where}${name(e.player)} ${e.delta > 0 ? '+' : '−'}${Math.abs(e.delta)} CP (${e.note ?? e.reason})`;
    case 'vp': {
      const what = e.category === 'primary' ? 'primary' : secondaryName(e.sourceId);
      if (e.detail === 'skipped') return `${where}${name(e.player)} skipped ${e.category === 'primary' ? 'the primary' : what}`;
      const amount = e.vp < 0 ? `lost ${-e.vp} VP` : `scored ${e.vp} VP`;
      return `${where}${name(e.player)} ${amount}, ${what}${e.detail ? ` (${e.detail})` : ''}`;
    }
    case 'stratagem':
      return `${where}${name(e.player)} used ${e.name} (${e.cp} CP)`;
    case 'roll':
      return `${where}Rolled ${e.dice.length}D${e.sides}: ${e.dice.join(' ')} (${e.label})`;
    case 'note':
      return `${where}Note: ${e.text}`;
    case 'end':
      return `${where}Game ended: ${e.reason === 'concede' && e.concededBy ? `${name(e.concededBy)} conceded` : END[e.reason]}`;
  }
}

/** The game so far, newest first, and a place to jot a note. */
export function LogPanel({ data, missions, append }: { data: TableGameData; missions: MissionsOut; append: (events: TableEvent[]) => Promise<void> }) {
  const [note, setNote] = useState('');
  const last = [...data.events].reverse().find((e) => e.t === 'advance');
  const pos = last && last.t === 'advance' ? last.to : { round: 1, turn: 1 as const, phase: 'command' as const };
  const add = async () => {
    const text = note.trim();
    if (!text) return;
    await append([makeEvent({ t: 'note', text }, pos)]);
    setNote('');
  };
  return (
    <div className="log">
      <form className="log__note" onSubmit={(ev) => { ev.preventDefault(); void add(); }}>
        <input className="input" aria-label="Add a note" placeholder="Add a note" value={note} onChange={(ev) => setNote(ev.target.value)} />
        <button type="submit" className="btn">Add a note</button>
      </form>
      <ol className="log__list" aria-label="Game log" reversed>
        {[...data.events].reverse().map((e) => <li key={e.id}>{describeEvent(e, data.setup, missions)}</li>)}
      </ol>
    </div>
  );
}

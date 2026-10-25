import type { MissionOut, PackOut, PlayerKey, SecondaryOut } from '@recruit/data/missions';
import { InfoButton } from '../ui/InfoButton';
import { makeEvent, type EventBody, type TableEvent, type TableGameData, type TableState } from './game';
import { SECONDARY_TYPE, SecondaryText } from './SecondaryText';

/** Primary VP per battle round (raw events, before the 45 cap). */
export function primaryByRound(data: TableGameData, player: PlayerKey): number[] {
  const out = [0, 0, 0, 0, 0];
  for (const e of data.events) if (e.t === 'vp' && e.player === player && e.category === 'primary' && e.pos) out[e.pos.round - 1] += e.vp;
  return out;
}

/** Each player's primary and secondary VP so far, with steppers for secondaries and CP. */
export function ScoreSheet({ data, pack, mission, state, append }: {
  data: TableGameData; pack: PackOut; mission: MissionOut; state: TableState; append: (events: TableEvent[]) => Promise<void>;
}) {
  const pos = state.pos;
  const write = (b: EventBody) => append([makeEvent(b, pos)]);
  const secondary = (id: string): SecondaryOut | undefined =>
    pack.secondaries.find((s) => s.id === id) ?? (mission.missionSecondary?.id === id ? mission.missionSecondary : undefined);
  const manualGains = (p: PlayerKey) =>
    data.events.filter((e) => e.t === 'cp' && e.player === p && e.reason === 'manual' && e.delta > 0 && e.pos?.round === pos?.round).reduce((a, e) => a + (e.t === 'cp' ? e.delta : 0), 0);
  return (
    <div className="score-sheet">
      {(['A', 'B'] as const).map((p) => {
        const player = data.setup.players[p];
        const totals = state.players[p];
        const byRound = primaryByRound(data, p);
        return (
          <section key={p} className="card" aria-label={player.name}>
            <h2>{player.name} <span className="muted">· {totals.total} VP</span></h2>
            <h3>Primary: {mission.primary.name}</h3>
            <p className="score-sheet__total">{totals.primary} / {pack.caps.primary}</p>
            <p className="muted">{byRound.map((v, i) => (v ? `Round ${i + 1}: ${v}` : null)).filter(Boolean).join(' · ') || 'Nothing scored yet.'}</p>
            <h3>Secondaries</h3>
            {player.secondaries.map((id) => {
              const s = secondary(id);
              const shown = totals.secondary[id] ?? 0;
              const label = s?.name ?? id;
              return (
                <div key={id} className="score-sheet__secondary">
                  <div className="score-sheet__name">
                    <strong>{label}</strong>
                    {s && <span className="muted"> · {s.category} · {SECONDARY_TYPE[s.type]}</span>}
                  </div>
                  <div className="stepper score-sheet__controls">
                    <button type="button" className="btn btn--small" aria-label={`Fewer VP: ${label}`} disabled={shown <= 0} onClick={() => void write({ t: 'vp', player: p, category: 'secondary', sourceId: id, vp: -1, detail: 'adjusted' })}>−</button>
                    <strong>{shown} / {pack.caps.secondaryEach}</strong>
                    <button type="button" className="btn btn--small" aria-label={`More VP: ${label}`} disabled={shown >= pack.caps.secondaryEach} onClick={() => void write({ t: 'vp', player: p, category: 'secondary', sourceId: id, vp: 1, detail: 'adjusted' })}>+</button>
                    {s && <InfoButton label={`How ${label} scores`} title={label}><SecondaryText s={s} /></InfoButton>}
                  </div>
                </div>
              );
            })}
            <h3>Command points</h3>
            <div className="stepper">
              <span className="stepper__label">{totals.cp} CP</span>
              <button type="button" className="btn btn--small" aria-label={`Spend 1 CP: ${player.name}`} disabled={totals.cp <= 0} onClick={() => void write({ t: 'cp', player: p, delta: -1, reason: 'manual' })}>−</button>
              <button type="button" className="btn btn--small" aria-label={`Gain 1 CP: ${player.name}`} onClick={() => void write({ t: 'cp', player: p, delta: 1, reason: 'manual' })}>+</button>
            </div>
            {manualGains(p) > 1 && (
              <p className="note note--unconfirmed">
                Most rules can only give a player 1 CP per battle round (the Battle-forged CP bonus and mission CP don't count). Check the rule you're using.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

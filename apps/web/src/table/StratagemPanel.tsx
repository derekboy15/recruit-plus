import { useState } from 'react';
import type { StratagemOut } from '@recruit/data/model';
import type { PlayerKey } from '@recruit/data/missions';
import { getCatalogue, getCoreStratagems } from '../factions/dataClient';
import { factionDisplayName } from '../factions/names';
import { useAsync } from '../factions/useAsync';
import { RulesText } from '../rules/RulesText';
import { WordingToggle } from '../rules/wording';
import { defaultGroups } from './armyGroups';
import { makeEvent, other, type TableEvent, type TableGameData, type TableState } from './game';
import { CORE_GROUP, costOptions, phaseFilter, stratagemsFor } from './stratagemFilter';

/**
 * Stratagems for the current phase: the player whose turn it is, then the other player (reacting). Using one spends
 * its CP and logs it; a second use in the same phase asks first.
 */
export function StratagemPanel({ data, state, append }: { data: TableGameData; state: TableState; append: (events: TableEvent[]) => Promise<void> }) {
  const { setup } = data;
  const slugs = [setup.players.A.catalogueSlug, setup.players.B.catalogueSlug];
  const loaded = useAsync(() => Promise.all([getCatalogue(slugs[0]), getCatalogue(slugs[1]), getCoreStratagems()]), slugs.join('|'));
  if (!state.pos || !state.active) return null;
  if (loaded.status === 'loading') return <p className="muted">Loading stratagems…</p>;
  if (loaded.status === 'error') return <p role="alert">Couldn’t load the stratagems: {loaded.error.message}</p>;
  const [a, b, core] = loaded.data;
  const own: Record<PlayerKey, StratagemOut[]> = { A: a.stratagems, B: b.stratagems };
  const faction: Record<PlayerKey, string> = { A: factionDisplayName(a.name), B: factionDisplayName(b.name) };
  const pos = state.pos;
  const firstCommandOfRound = pos.turn === 1 && pos.phase === 'command';
  return (
    <div className="stratagems">
      <WordingToggle />
      <p className="muted">Shown by the phases they're listed for. Check each one's timing before you use it.</p>
      {([state.active, other(state.active)] as const).map((p) => (
        <PlayerStratagems
          key={p}
          name={setup.players[p].name}
          side={p === state.active ? 'active' : 'reacting'}
          cp={state.players[p].cp}
          all={[...own[p], ...core]}
          defaults={defaultGroups([...own[p], ...core], faction[p], setup.players[p].armyChoices)}
          filter={phaseFilter(pos.phase, p === state.active ? 'active' : 'reacting', { firstCommandOfRound })}
          usedThisPhase={state.stratagemsThisPhase.filter((u) => u.player === p).map((u) => u.name)}
          onUse={(s, cost) => append([
            makeEvent({ t: 'stratagem', player: p, stratagemId: s.id, name: s.name, cp: cost }, pos),
            makeEvent({ t: 'cp', player: p, delta: -cost, reason: 'stratagem', note: s.name }, pos),
          ])}
        />
      ))}
    </div>
  );
}

/** "a", "a and b", "a, b and c". */
const listWords = (words: string[]) => (words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`);

function PlayerStratagems({ name, side, cp, all, defaults, filter, usedThisPhase, onUse }: {
  name: string; side: 'active' | 'reacting'; cp: number; all: StratagemOut[]; defaults: Set<string>;
  filter: ReturnType<typeof phaseFilter>; usedThisPhase: string[]; onUse: (s: StratagemOut, cost: number) => Promise<void>;
}) {
  const [showAll, setShowAll] = useState(false);
  const [group, setGroup] = useState<string | undefined>(undefined);
  const groups = [...new Set(all.map((s) => s.group).filter((g) => g !== CORE_GROUP))].sort();
  const hidesSome = groups.some((g) => !defaults.has(g));
  const shown = !showAll ? defaults : group ? new Set([CORE_GROUP, group]) : undefined;
  const { main, reactions } = stratagemsFor(all, filter, shown);
  const label = `${name} (${side === 'active' ? 'your turn' : 'reacting'})`;
  return (
    <section className="card" aria-label={label}>
      <h2>{label}</h2>
      <p className="muted">{name === 'You' ? 'You have' : `${name} has`} {cp} CP.</p>
      <p className="muted">{shown ? `Showing ${listWords([...shown])} stratagems.` : 'Showing every stratagem.'}</p>
      {hidesSome && (
        <button
          type="button" className="chip" aria-pressed={showAll}
          onClick={() => {
            setShowAll(!showAll);
            setGroup(undefined);
          }}
        >
          Show all stratagems
        </button>
      )}
      {showAll && groups.length > 1 && (
        <div className="chips" aria-label="Show stratagems for">
          <button type="button" className="chip" aria-pressed={!group} onClick={() => setGroup(undefined)}>All</button>
          {groups.map((g) => <button key={g} type="button" className="chip" aria-pressed={group === g} onClick={() => setGroup(g)}>{g}</button>)}
        </div>
      )}
      {main.length === 0 && <p className="muted">Nothing listed for this phase.</p>}
      {main.map((s) => <Card key={s.id} s={s} cp={cp} used={usedThisPhase.includes(s.name)} onUse={onUse} />)}
      {reactions.length > 0 && (
        <details>
          <summary>When a unit is targeted or takes casualties ({reactions.length})</summary>
          {reactions.map((s) => <Card key={s.id} s={s} cp={cp} used={usedThisPhase.includes(s.name)} onUse={onUse} />)}
        </details>
      )}
    </section>
  );
}

function Card({ s, cp, used, onUse }: { s: StratagemOut; cp: number; used: boolean; onUse: (s: StratagemOut, cost: number) => Promise<void> }) {
  return (
    <article className="card stratagem">
      <h3 style={{ margin: 0 }}>{s.name}</h3>
      <p className="muted stratagem__meta">{[`${s.cp} CP`, s.group, s.phases.join(', ')].filter(Boolean).join(' · ')}</p>
      <RulesText official={s.text} plain={s.plain} amended={s.amended} />
      {used && <p className="hint">Already used this phase</p>}
      <div className="prompt__actions">
        {costOptions(s.cp).map((cost) => (
          <button key={cost} type="button" className="btn btn--small" disabled={cp < cost} onClick={() => void onUse(s, cost)}>
            {used ? `Use again anyway (${cost} CP)` : `Use (${cost} CP)`}
          </button>
        ))}
      </div>
    </article>
  );
}

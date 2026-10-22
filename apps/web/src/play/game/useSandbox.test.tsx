import 'fake-indexeddb/auto';
import type { Command, Problem } from '@recruit/engine';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { openDb, type RecruitDb } from '../../storage/db';
import { createRepository, type Repository } from '../../storage/repository';
import { StorageProvider } from '../../storage/StorageContext';
import { deployedGame } from '../__fixtures__/game';
import { summarise, type GameData, type GameMeta } from '../store/gameStore';
import { useSandbox, type Sandbox } from './useSandbox';

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  db = openDb(`sandbox-test-${++n}`);
  repo = createRepository(db);
});
afterEach(() => db.close());

const meta: GameMeta = { title: 'Necrons vs Ultramarines', createdAt: 1, hints: true, handOver: true, missionId: 'practice', layoutId: 'open', armies: [] };
async function seedGame(id = 'g1', record = deployedGame()) {
  await repo.saveDoc<GameData>({ id, kind: 'game', ownerId: 'u', data: { record, meta, summary: summarise(record) } });
}
const wrapper = ({ children }: { children: ReactNode }) => <StorageProvider db={db}>{children}</StorageProvider>;
type Ready = Extract<Sandbox, { status: 'ready' }>;
async function open(id = 'g1') {
  const hook = renderHook(() => useSandbox(id), { wrapper });
  await waitFor(() => expect(hook.result.current.status).not.toBe('loading'));
  return hook;
}
const ready = (s: Sandbox) => {
  if (s.status !== 'ready') throw new Error(`not ready: ${s.status}`);
  return s as Ready;
};
const cmd = (c: object) => c as Command;

test('loads a saved game and reports its current step', async () => {
  await seedGame();
  const { result } = await open();
  const sb = ready(result.current);
  expect(sb.state.phase).toBe('command');
  expect(sb.step.actingPlayer).toBe('A');
  expect(sb.doc.data.meta.title).toBe('Necrons vs Ultramarines');
  expect(sb.log[0].text).toMatch(/set up Intercessor Squad/);
});

test('an accepted command updates the state and is saved after the debounce', async () => {
  await seedGame();
  const { result } = await open();
  let problems: Problem[] | null = [];
  act(() => {
    problems = ready(result.current).act(cmd({ type: 'endPhase', by: 'A' }));
  });
  expect(problems).toBeNull();
  expect(ready(result.current).state.phase).toBe('movement');
  await waitFor(async () => expect((await repo.getDoc<GameData>('g1'))?.data.summary.phase).toBe('movement'), { timeout: 2000 });
});

test("a rejected command returns the engine's problems and changes nothing", async () => {
  await seedGame();
  const { result } = await open();
  const before = ready(result.current).record;
  let problems: Problem[] | null = null;
  act(() => {
    problems = ready(result.current).act(cmd({ type: 'endPhase', by: 'B' }));
  });
  expect(problems![0].message).toBe('Only the player whose turn it is can move the game on.');
  expect(ready(result.current).record).toBe(before);
});

test('check does not change the record', async () => {
  await seedGame();
  const { result } = await open();
  const before = ready(result.current).record;
  expect(ready(result.current).check(cmd({ type: 'endPhase', by: 'A' }))).toEqual([]);
  expect(ready(result.current).check(cmd({ type: 'endPhase', by: 'B' }))[0].code).toBe('not-your-turn');
  expect(ready(result.current).record).toBe(before);
});

test('undo takes back the last command and refuses past the phase start', async () => {
  await seedGame();
  const { result } = await open();
  act(() => void ready(result.current).act(cmd({ type: 'endPhase', by: 'A' })));
  let refused: Problem[] | null = null;
  act(() => {
    refused = ready(result.current).undo();
  });
  expect(refused![0].message).toBe("You can't undo past the start of this phase.");
  act(() => void ready(result.current).act(cmd({ type: 'remainStationary', by: 'A', unitId: 'A:war' })));
  expect(ready(result.current).state.units['A:war'].turn.moved).toBe('stationary');
  act(() => void ready(result.current).undo());
  expect(ready(result.current).state.units['A:war'].turn.moved).toBe('none');
});

test('two commands in a row build on each other', async () => {
  await seedGame();
  const { result } = await open();
  act(() => {
    ready(result.current).act(cmd({ type: 'endPhase', by: 'A' }));
    ready(result.current).act(cmd({ type: 'remainStationary', by: 'A', unitId: 'A:war' }));
  });
  expect(ready(result.current).state.units['A:war'].turn.moved).toBe('stationary');
});

test('flush saves at once', async () => {
  await seedGame();
  const { result } = await open();
  act(() => void ready(result.current).act(cmd({ type: 'endPhase', by: 'A' })));
  await act(() => ready(result.current).flush());
  expect((await repo.getDoc<GameData>('g1'))?.data.summary.phase).toBe('movement');
});

test('a missing game reports missing; a damaged one reports its reason', async () => {
  expect((await open('nope')).result.current.status).toBe('missing');
  await repo.saveDoc({ id: 'bad', kind: 'game', ownerId: 'u', data: { record: { schema: 2 }, meta, summary: summarise(deployedGame()) } });
  const bad = (await open('bad')).result.current;
  expect(bad).toMatchObject({ status: 'unreadable', message: 'This saved game was made by a newer version of the app.' });
});

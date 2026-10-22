import 'fake-indexeddb/auto';
import { saveGame } from '@recruit/engine';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { openDb, type RecruitDb } from '../../storage/db';
import { createRepository, type Repository } from '../../storage/repository';
import { deployedGame, sampleSetup } from '../__fixtures__/game';
import { createGame, openGameDoc, saveGameDoc, summarise, type GameData, type GameMeta } from './gameStore';

let db: RecruitDb;
let repo: Repository;
let n = 0;
beforeEach(() => {
  db = openDb(`game-store-test-${++n}`);
  repo = createRepository(db);
});
afterEach(() => db.close());

const meta: GameMeta = {
  title: 'Necrons vs Ultramarines',
  createdAt: 1,
  hints: true,
  handOver: true,
  missionId: 'practice',
  layoutId: 'open',
  armies: [],
};

test('createGame then openGameDoc returns the same record', async () => {
  const id = await createGame(repo, 'u', sampleSetup(), meta);
  const opened = await openGameDoc(repo, id);
  if (!opened.ok) throw new Error(opened.reason);
  expect(opened.doc.kind).toBe('game');
  expect(opened.doc.data.meta).toEqual(meta);
  expect(saveGame(opened.record)).toEqual(saveGame({ schema: 1, setup: sampleSetup(), batches: [] }));
  expect(opened.doc.data.summary).toEqual({ round: 0, phase: 'pre-battle', ended: false, winner: null, vp: { A: 0, B: 0 } });
});

test('summarise reads round, phase and VP', () => {
  expect(summarise(deployedGame())).toEqual({ round: 1, phase: 'command', ended: false, winner: null, vp: { A: 0, B: 0 } });
});

test('saveGameDoc stores the new record and its summary', async () => {
  const id = await createGame(repo, 'u', sampleSetup(), meta);
  const opened = await openGameDoc(repo, id);
  if (!opened.ok) throw new Error(opened.reason);
  await saveGameDoc(repo, opened.doc, deployedGame());
  const again = await openGameDoc(repo, id);
  if (!again.ok) throw new Error(again.reason);
  expect(again.doc.data.summary.phase).toBe('command');
  expect(again.record.batches.length).toBe(deployedGame().batches.length);
});

test("openGameDoc reports a record from a newer version as unreadable with the engine's message", async () => {
  const data = { record: { schema: 2, setup: {}, batches: [] }, meta, summary: summarise(deployedGame()) } as unknown as GameData;
  await repo.saveDoc({ id: 'g-new', kind: 'game', ownerId: 'u', data });
  expect(await openGameDoc(repo, 'g-new')).toEqual({ ok: false, reason: 'unreadable', message: 'This saved game was made by a newer version of the app.' });
});

test('openGameDoc reports a missing or deleted game as missing', async () => {
  expect(await openGameDoc(repo, 'nope')).toEqual({ ok: false, reason: 'missing' });
  const id = await createGame(repo, 'u', sampleSetup(), meta);
  await repo.deleteDoc(id);
  expect(await openGameDoc(repo, id)).toEqual({ ok: false, reason: 'missing' });
});

import { describe, expect, test } from 'vitest';
import { registerApplier } from '../../src/core/apply';
import { registerHandler } from '../../src/core/context';
import { dispatch, loadGame, newGame, saveGame, stateOf, undo, type GameRecord } from '../../src/core/record';
import type { Command, GameEvent } from '../../src/core/types';
import { testSetup } from '../helpers/game';

// Stub commands that exist only in this test: they exercise the core without any rules module.
type Notes = { testNotes?: string[] };
registerHandler('noteTest' as never, (ctx, cmd: { text: string }) => {
  if (!cmd.text) ctx.reject('empty-note', 'Write something.', '[R-19]');
  ctx.emit({ type: 'noteAdded', text: cmd.text } as unknown as GameEvent);
});
registerApplier('noteAdded' as never, (s, e: { text: string }) => {
  const st = s as unknown as Notes;
  st.testNotes = [...(st.testNotes ?? []), e.text];
});
registerHandler('rollTest' as never, (ctx) => {
  const r = ctx.roll(3, 6, 'other', 'A', { context: 'test' });
  ctx.emit({ type: 'noteAdded', text: r.dice.map((d) => d.value).join(',') } as unknown as GameEvent);
});
registerHandler('stepTest' as never, (ctx) => {
  ctx.emit({ type: 'stepSet', step: 'test-step' } as unknown as GameEvent);
});
registerApplier('stepSet' as never, (s, e: { step: string }) => {
  (s as unknown as { step: string }).step = e.step;
});

const cmd = (type: string, extra: object = {}) => ({ type, by: 'A', ...extra }) as unknown as Command;
const ok = (r: ReturnType<typeof dispatch>): GameRecord => {
  if (!r.ok) throw new Error(JSON.stringify(r.problems));
  return r.game;
};
const notes = (g: GameRecord) => (stateOf(g) as unknown as Notes).testNotes ?? [];

describe('event-sourced record', () => {
  test('dispatch then replay gives an equal state', () => {
    let g = newGame(testSetup());
    g = ok(dispatch(g, cmd('noteTest', { text: 'one' })));
    g = ok(dispatch(g, cmd('rollTest')));
    const live = stateOf(g);
    const replayed = stateOf({ ...g, batches: [...g.batches] });
    expect(replayed).toEqual(live);
    expect(notes(g)[0]).toBe('one');
    expect(g.batches.map((b) => b.seq)).toEqual([1, 2]);
  });

  test('a rejected command leaves the record unchanged', () => {
    const g = ok(dispatch(newGame(testSetup()), cmd('noteTest', { text: 'one' })));
    const r = dispatch(g, cmd('noteTest', { text: '' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0]).toMatchObject({ code: 'empty-note', message: 'Write something.' });
    expect(g.batches).toHaveLength(1);
    expect(notes(g)).toEqual(['one']);
  });

  test('an unknown command type is rejected, not thrown', () => {
    const r = dispatch(newGame(testSetup()), cmd('noSuchCommand'));
    expect(r.ok).toBe(false);
  });

  test('undo removes exactly the last batch', () => {
    let g = newGame(testSetup());
    g = ok(dispatch(g, cmd('noteTest', { text: 'one' })));
    g = ok(dispatch(g, cmd('noteTest', { text: 'two' })));
    const u = ok(undo(g));
    expect(u.batches).toHaveLength(1);
    expect(notes(u)).toEqual(['one']);
  });

  test('undo with nothing to undo is rejected', () => {
    const r = undo(newGame(testSetup()));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0].code).toBe('nothing-to-undo');
  });

  test('[R-19] undo can not reach back past the start of the current step', () => {
    let g = newGame(testSetup());
    g = ok(dispatch(g, cmd('noteTest', { text: 'one' })));
    g = ok(dispatch(g, cmd('stepTest')));
    const r = undo(g);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems[0].code).toBe('undo-phase-start');
  });

  test('undo restores the dice: repeating a command rolls the same values', () => {
    let g = newGame(testSetup());
    g = ok(dispatch(g, cmd('rollTest')));
    const first = notes(g)[0];
    g = ok(undo(g));
    g = ok(dispatch(g, cmd('rollTest')));
    expect(notes(g)[0]).toBe(first);
    g = ok(dispatch(g, cmd('rollTest')));
    expect(notes(g)[1]).not.toBe(undefined);
  });

  test('saveGame/loadGame round-trips', () => {
    let g = newGame(testSetup());
    g = ok(dispatch(g, cmd('noteTest', { text: 'one' })));
    g = ok(dispatch(g, cmd('rollTest')));
    const loaded = loadGame(saveGame(g));
    expect(loaded).toEqual(g);
    expect(stateOf(loaded)).toEqual(stateOf(g));
  });

  test('loadGame refuses schema 2', () => {
    const json = JSON.stringify({ ...newGame(testSetup()), schema: 2 });
    expect(() => loadGame(json)).toThrow('This saved game was made by a newer version of the app.');
  });

  test('everything in the record is plain JSON', () => {
    let g = newGame(testSetup());
    g = ok(dispatch(g, cmd('rollTest')));
    expect(JSON.parse(JSON.stringify(g))).toEqual(g);
    expect(JSON.parse(JSON.stringify(stateOf(g)))).toEqual(stateOf(g));
  });
});

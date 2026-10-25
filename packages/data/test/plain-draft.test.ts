import { describe, expect, test } from 'vitest';
import { firstSentenceLength, mergeDraft, type TodoItem } from '../src/plain/draft';
import type { PlainShard } from '../src/plain/store';

const MOVE = 'aaaaaaaaaaaa';
const HITS = 'bbbbbbbbbbbb';
const todo: TodoItem[] = [
  { key: MOVE, kind: 'ability', name: 'Swift', official: 'This unit can move an extra 6" when it Advances.', tier: 1 },
  { key: HITS, kind: 'rule', name: 'Hits', official: 'Add 1 to hit rolls made for this unit.', tier: 2 },
];
const existing = (): PlainShard => ({ zzzzzzzzzzzz: { name: 'Z', kind: 'rule', plain: 'Z.' } });

describe('mergeDraft', () => {
  test('merges a passing entry, with name and kind from the to-do, keys sorted', () => {
    const r = mergeDraft(existing(), todo, { [HITS]: { plain: 'This unit adds 1 to its hit rolls.' } });
    expect(r.merged).toEqual([HITS]);
    expect(r.failed).toEqual([]);
    expect(Object.keys(r.shard)).toEqual([HITS, 'zzzzzzzzzzzz']);
    expect(r.shard[HITS]).toEqual({ name: 'Hits', kind: 'rule', plain: 'This unit adds 1 to its hit rolls.' });
  });

  test('keeps a waiver with its reason', () => {
    const r = mergeDraft({}, todo, { [HITS]: { plain: 'This unit hits more easily.', waive: { '1': 'the bonus is described in words' } } });
    expect(r.shard[HITS]).toEqual({ name: 'Hits', kind: 'rule', plain: 'This unit hits more easily.', waive: { '1': 'the bonus is described in words' } });
  });

  test('refuses a key that is not in the to-do list', () => {
    const r = mergeDraft(existing(), todo, { cccccccccccc: { plain: 'Something.' } });
    expect(r.failed).toEqual([{ key: 'cccccccccccc', reason: 'not in the to-do list' }]);
    expect(r.shard).toEqual(existing());
  });

  test('keeps a failing entry out and says why', () => {
    const r = mergeDraft(existing(), todo, { [MOVE]: { plain: 'When this unit Advances, it can move 9" more.' } });
    expect(r.merged).toEqual([]);
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].key).toBe(MOVE);
    expect(r.failed[0].reason).toContain('missing [6"]');
    expect(r.failed[0].reason).toContain('extra [9"]');
    expect(r.shard[MOVE]).toBeUndefined();
  });

  test('warns when the first sentence is over 160 characters', () => {
    const first = `${'When this unit Advances, it can move 6" more'}${' quite far indeed'.repeat(10)}`.slice(0, 169) + '.';
    expect(first).toHaveLength(170);
    const r = mergeDraft({}, todo, { [MOVE]: { plain: `${first} Then it stops.` } });
    expect(r.merged).toEqual([MOVE]);
    expect(r.longSummaries).toEqual([{ key: MOVE, length: 170 }]);
  });
});

describe('firstSentenceLength', () => {
  test('stops at the first sentence outside quotes and ignores inch marks', () => {
    expect(firstSentenceLength('Move 6" more. Then …')).toBe(13);
    expect(firstSentenceLength('Say "Stop. Now." then go. Next.')).toBe(25);
  });

  test('reads the first line, run on while it ends with a colon, without list bullets', () => {
    expect(firstSentenceLength('Pick one:\n• Move 6".\n• Shoot.')).toBe(18);
  });
});

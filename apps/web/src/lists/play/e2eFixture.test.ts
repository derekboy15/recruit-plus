import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { resetDataCache } from '../../factions/dataClient';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { novokhIncursionData, stableIds } from './__fixtures__/playList';

const FIXTURE = join(__dirname, '..', '..', '..', 'e2e', 'data', 'novokh-incursion.json');

beforeEach(() => {
  stubGeneratedData();
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDataCache();
});

test('the e2e Play mode list matches the fixture builder (UPDATE_E2E_FIXTURES=1 rewrites it)', async () => {
  const fresh = stableIds(await novokhIncursionData());
  if (process.env.UPDATE_E2E_FIXTURES) writeFileSync(FIXTURE, JSON.stringify(fresh, null, 2) + '\n');
  expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(fresh);
});

test('stable ids: forces f0, f1… and selections s0, s1… in depth-first order', async () => {
  const out = stableIds(await novokhIncursionData({ secondDetachment: true }));
  expect(out.roster.forces.map((f) => f.id)).toEqual(['f0', 'f1']);
  const ids: string[] = [];
  const walk = (sels: { id: string; children?: unknown[] }[]) => sels.forEach((s) => (ids.push(s.id), walk((s.children ?? []) as never)));
  out.roster.forces.forEach((f) => walk(f.selections));
  expect(ids).toEqual(ids.map((_, i) => `s${i}`));
});

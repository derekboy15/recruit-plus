import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InfoFile } from '@recruit/data/model';
import { expect, test } from 'vitest';
import { summaryLine } from './entryInfo';

const INFO = join(__dirname, '..', '..', '..', '..', 'packages', 'data', 'generated', 'info');

// Plan F: the builder labels an option "Official wording" when its plain summary is the official one (lists/optionText.ts),
// so every option summary, however short ("Blessing."), must come from plain English that says it differently.
test('every option summary is in plain English, so no option is labelled Official wording', () => {
  if (!existsSync(INFO)) throw new Error(`${INFO} is missing: run npm run data:build`);
  const official: string[] = [];
  let summaries = 0;
  for (const f of readdirSync(INFO)) {
    const file: InfoFile = JSON.parse(readFileSync(join(INFO, f), 'utf8'));
    for (const [id, info] of Object.entries(file.entries)) {
      const summary = summaryLine(info, 'official');
      if (!summary) continue;
      summaries++;
      if (summaryLine(info, 'plain') === summary) official.push(`${file.slug} ${id}: ${summary}`);
    }
  }
  expect(summaries).toBeGreaterThan(2500);
  expect(official).toEqual([]);
});

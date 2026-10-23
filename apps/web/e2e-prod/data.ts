/** Saved documents captured from real app runs (see harness.spec.ts CAPTURE_LIST), for seeding the fake remote. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const load = (file: string): Record<string, unknown> => JSON.parse(readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), 'data', file), 'utf8'));

/** A Necrons Strike Force list (Arks of Omen Detachment, Szarekhan) as the list wizard saves it. */
export const necronsList = () => load('necrons-list.json');

/** The captured Necrons list under another name (the name lives in the roster). */
export function necronsListNamed(name: string): Record<string, unknown> {
  const list = necronsList() as { roster: Record<string, unknown> };
  return { ...list, roster: { ...list.roster, name } };
}

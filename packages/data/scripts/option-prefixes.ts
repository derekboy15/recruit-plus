/**
 * Survey of the prefixes ("Warlord Trait (Novokh): …", "Stratagem: …") and "(…)" qualifiers on BattleScribe option
 * names, for optionDisplay's rules. Reads every generated/roster/*.json (run `npm run data:build` first) and writes
 * test/fixtures/option-prefixes.json: each distinct prefix and qualifier with its count and three examples.
 *   npx tsx packages/data/scripts/option-prefixes.ts
 * Options are `upgrade` entries and links to them (a link's own name is what the builder shows).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RNode, RosterFile } from '../src/roster/types';

const root = join(import.meta.dirname, '..');
const dir = join(root, 'generated', 'roster');
const files: RosterFile[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json') && f !== 'policy.json')
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));

const byId = new Map<string, RNode>();
const visit = (n: RNode, fn: (n: RNode) => void) => {
  fn(n);
  n.children?.forEach((c) => visit(c, fn));
};
for (const f of files) for (const n of [...f.rootEntries, ...f.shared]) visit(n, (x) => !byId.has(x.id) && byId.set(x.id, x));

const isOption = (n: RNode): boolean => {
  if (n.kind === 'entry') return n.type === 'upgrade';
  if (n.kind === 'link') return n.targetKind === 'entry' && byId.get(n.targetId!)?.type === 'upgrade';
  return false;
};

const names: string[] = [];
for (const f of files) for (const n of [...f.rootEntries, ...f.shared]) visit(n, (x) => isOption(x) && names.push(x.name.trim()));

type Tally = Map<string, { count: number; examples: string[] }>;
const tally = (t: Tally, key: string, example: string) => {
  const e = t.get(key) ?? { count: 0, examples: [] };
  e.count++;
  if (e.examples.length < 3 && !e.examples.includes(example)) e.examples.push(example);
  t.set(key, e);
};
const prefixes: Tally = new Map();
const qualifiers: Tally = new Map();
for (const name of names) {
  const p = /^([^:]+):\s/.exec(name);
  if (p) tally(prefixes, p[1].trim(), name);
  for (const q of name.matchAll(/\(([^)]*)\)/g)) tally(qualifiers, q[1].trim(), name);
}
const sorted = (t: Tally) => [...t].map(([key, v]) => ({ key, ...v })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
const out = { options: names.length, prefixes: sorted(prefixes), qualifiers: sorted(qualifiers) };
writeFileSync(join(root, 'test', 'fixtures', 'option-prefixes.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`${names.length} option names, ${prefixes.size} prefixes, ${qualifiers.size} qualifiers`);

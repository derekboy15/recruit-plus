/**
 * Checks a draft file of plain-English entries against the official texts in a content to-do list, with the same
 * checker the build uses (src/plain/check.ts). For drafting outside the content files.
 *   npx tsx scripts/check-plain-file.ts <todo.json> <draft.json>
 * Prints one line per failing entry (missing or invented tokens, copied wording) and a count; exits 1 if any fail.
 */
import { readFileSync } from 'node:fs';
import { checkPlain } from '../src/plain/check';

const [todoFile, draftFile] = process.argv.slice(2);
if (!todoFile || !draftFile) throw new Error('Usage: check-plain-file.ts <todo.json> <draft.json>');
const todo: { key: string; name: string; official: string }[] = JSON.parse(readFileSync(todoFile, 'utf8'));
const draft: Record<string, { plain: string; waive?: Record<string, string> }> = JSON.parse(readFileSync(draftFile, 'utf8'));
const official = new Map(todo.map((t) => [t.key, t]));
let failed = 0;
for (const [key, e] of Object.entries(draft)) {
  const t = official.get(key);
  if (!t) {
    console.log(`${key}: not in the to-do list`);
    failed++;
    continue;
  }
  const v = checkPlain(t.official, e.plain, e.waive);
  if (!v.ok) {
    failed++;
    console.log(`${key} ${t.name}: missing [${v.missing.map((x) => x.value).join(', ')}] extra [${v.extra.map((x) => x.value).join(', ')}]${v.copy.copied ? ` copied (longest shared run ${v.copy.longestRun} words, ${Math.round(v.copy.shared4 * 100)}% shared 4-grams)` : ''}`);
  }
}
console.log(`${Object.keys(draft).length - failed} of ${Object.keys(draft).length} pass`);
process.exit(failed ? 1 : 0);

/**
 * Checks a draft of plain-English entries against a shard's to-do list and merges the passing ones into the shard, with
 * the same checker the build uses. For drafting outside the content files (Plan F's option texts, or any shard).
 *   npx tsx packages/data/scripts/merge-plain-draft.ts <shard> <draft.json>
 * The draft is { "<key>": { "plain": "…", "waive"?: { "<token>": "<reason>" } } }. Reads packages/content/todo/<shard>.json
 * (from `npm run content:todo -- <shard>`) and writes packages/content/plain/<shard>.json, keys sorted. Prints one line
 * per failing entry and per first sentence over 160 characters (merged, but the builder cuts it), then a count; exits 1
 * if any entry failed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeDraft, type DraftEntry, type TodoItem } from '../src/plain/draft';
import type { PlainShard } from '../src/plain/store';

const [shardName, draftFile] = process.argv.slice(2);
if (!shardName || !draftFile) throw new Error('Usage: merge-plain-draft.ts <shard> <draft.json>');
const contentDir = join(import.meta.dirname, '..', '..', 'content');
const todoFile = join(contentDir, 'todo', `${shardName}.json`);
if (!existsSync(todoFile)) throw new Error(`No ${todoFile}: run npm run content:todo -- ${shardName} first`);
const read = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;

const shardFile = join(contentDir, 'plain', `${shardName}.json`);
const shard = existsSync(shardFile) ? read<PlainShard>(shardFile) : {};
const result = mergeDraft(shard, read<TodoItem[]>(todoFile), read<Record<string, DraftEntry>>(draftFile));
if (result.merged.length) writeFileSync(shardFile, `${JSON.stringify(result.shard, null, 2)}\n`);
const names = new Map(read<TodoItem[]>(todoFile).map((t) => [t.key, t.name]));
for (const f of result.failed) console.log(`${f.key} ${names.get(f.key) ?? ''}: ${f.reason}`);
for (const l of result.longSummaries) console.log(`${l.key} ${names.get(l.key)}: first sentence is ${l.length} characters (the builder cuts it at 160)`);
console.log(`${result.merged.length} merged, ${result.failed.length} failed`);
process.exit(result.failed.length ? 1 : 0);

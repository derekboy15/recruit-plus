/** Downloads BSData wh40k-9e v9.8.0, verifies its sha256, and extracts .gst/.cat files into raw/bsdata. */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import AdmZip from 'adm-zip';

const URL = 'https://github.com/BSData/wh40k-9e/archive/refs/tags/v9.8.0.zip';
const SHA256 = 'a6b167074743ab910811fc76fe095ef9f43141905887bf328a0cf99ed16232a7';
const OUT = join(import.meta.dirname, '..', 'raw', 'bsdata');
const EXPECTED_CATALOGUES = 52;

async function main() {
  if (existsSync(OUT) && readdirSync(OUT).filter((f) => f.endsWith('.cat')).length === EXPECTED_CATALOGUES) {
    console.log('BSData already present, skipping download.');
    return;
  }
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const hash = createHash('sha256').update(buf).digest('hex');
  if (hash !== SHA256) {
    console.error(`Checksum mismatch: expected ${SHA256}, got ${hash}`);
    process.exit(1);
  }
  mkdirSync(OUT, { recursive: true });
  let count = 0;
  for (const entry of new AdmZip(buf).getEntries()) {
    const name = basename(entry.entryName);
    if (entry.isDirectory || !/\.(gst|cat)$/.test(name)) continue;
    writeFileSync(join(OUT, name), entry.getData());
    count++;
  }
  console.log(`Extracted ${count} files to ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

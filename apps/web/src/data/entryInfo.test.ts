import { afterEach, describe, expect, test, vi } from 'vitest';
import type { DataIndex, EntryInfo, InfoFile } from '@recruit/data/model';
import { buildScope, type RosterFile } from '@recruit/data/roster';
import { resetDataCache } from '../factions/dataClient';
import { entryInfo, loadEntryInfo, summaryLine } from './entryInfo';

const rosterFile = (slug: string, over: Partial<RosterFile> = {}): RosterFile => ({
  schema: 1, id: `${slug}-id`, name: slug, slug, library: false, links: [], rootEntries: [], shared: [], categories: [], forces: [], ...over,
});
// The faction's group holds a link to a relic defined in the library.
const faction = rosterFile('faction', {
  shared: [{ id: 'grp', kind: 'group', name: 'Relics', children: [{ id: 'lnk', kind: 'link', name: 'Relic: Blade', targetId: 'relic', targetKind: 'entry' }] }],
});
const library = rosterFile('library', { library: true, shared: [{ id: 'relic', kind: 'entry', type: 'upgrade', name: 'Relic: Blade' }] });
const system = rosterFile('system');
const scope = buildScope([faction, library, system]);

const infoFiles: Record<string, InfoFile> = {
  faction: { schema: 1, slug: 'faction', entries: { lnk: { rules: [{ name: 'Link note', text: 'Only for Lords.' }] } } },
  library: {
    schema: 1,
    slug: 'library',
    entries: { relic: { profiles: [{ name: 'Blade', type: 'Weapon', chars: { Range: 'Melee', S: '+1' } }], rules: [{ name: 'Blade', text: 'Wounds on a 2+.' }] } },
  },
  system: { schema: 1, slug: 'system', entries: { 'sys-opt': { rules: [{ name: 'Core', text: 'A core option.' }] } } },
};
const index: Pick<DataIndex, 'catalogues'> = {
  catalogues: [{ id: 'faction-id', slug: 'faction', name: 'Faction', group: 'Xenos', library: false, unitCount: 1, rosterScope: ['faction', 'library', 'system'], factions: [] }],
};

function stubFetch(missing: string[] = []) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/data/index.json') return new Response(JSON.stringify(index));
    const m = /^\/data\/info\/(.+)\.json$/.exec(url);
    if (m && infoFiles[m[1]] && !missing.includes(m[1])) return new Response(JSON.stringify(infoFiles[m[1]]));
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetDataCache();
});

describe('loadEntryInfo and entryInfo', () => {
  test("loads every file in the catalogues' roster scope once, the system included", async () => {
    const fetchMock = stubFetch();
    const idx = await loadEntryInfo(['faction', 'faction']);
    const urls = fetchMock.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/data/info/'));
    expect(urls.sort()).toEqual(['/data/info/faction.json', '/data/info/library.json', '/data/info/system.json']);
    expect(entryInfo(scope, idx, 'sys-opt')?.rules?.[0].name).toBe('Core');
  });

  test('entryInfo follows a link to its target and merges both, link first', async () => {
    stubFetch();
    const idx = await loadEntryInfo(['faction']);
    const info = entryInfo(scope, idx, 'lnk')!;
    expect(info.rules?.map((r) => r.name)).toEqual(['Link note', 'Blade']);
    expect(info.profiles?.map((p) => p.name)).toEqual(['Blade']);
    expect(entryInfo(scope, idx, 'relic')).toEqual(infoFiles.library.entries.relic);
  });

  test('an entry with no info, and a null index, give undefined', async () => {
    stubFetch();
    const idx = await loadEntryInfo(['faction']);
    expect(entryInfo(scope, idx, 'grp')).toBeUndefined();
    expect(entryInfo(scope, idx, 'nowhere')).toBeUndefined();
    expect(entryInfo(scope, null, 'lnk')).toBeUndefined();
  });

  test('a file that fails to load is skipped', async () => {
    stubFetch(['library']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const idx = await loadEntryInfo(['faction']);
    expect(warn).toHaveBeenCalled();
    expect(entryInfo(scope, idx, 'relic')).toBeUndefined();
    expect(entryInfo(scope, idx, 'lnk')?.rules?.map((r) => r.name)).toEqual(['Link note']);
  });

  test('an unknown catalogue or a missing index resolves with what loaded', async () => {
    stubFetch();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await loadEntryInfo(['nope'])).get('sys-opt')).toBeDefined();
    resetDataCache();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    await expect(loadEntryInfo(['faction'])).resolves.toEqual(new Map());
  });
});

describe('summaryLine', () => {
  test('summaryLine: first sentence of the first rule, plain when chosen and present', () => {
    const info = { rules: [{ name: 'Awakened by Murder', text: 'Add 1 to charge rolls. In a turn…', plain: '+1 to charge rolls. More.' }] };
    expect(summaryLine(info, 'plain')).toBe('+1 to charge rolls.');
    expect(summaryLine(info, 'official')).toBe('Add 1 to charge rolls.');
  });

  test('plain wording falls back to the official text when there is no plain English', () => {
    expect(summaryLine({ rules: [{ name: 'R', text: 'Re-roll hit rolls. Then more.' }] }, 'plain')).toBe('Re-roll hit rolls.');
  });

  test('summaryLine falls back to an Abilities/Description profile, then null', () => {
    const ability: EntryInfo = { profiles: [{ name: 'A', type: 'Abilities', chars: { Description: 'X. Y.' } }] };
    expect(summaryLine(ability, 'official')).toBe('X.');
    expect(summaryLine({ profiles: [{ name: 'A', type: 'Abilities', chars: { Description: 'X. Y.' }, plain: { Description: 'P. Q.' } }] }, 'plain')).toBe('P.');
    expect(summaryLine({ profiles: [{ name: 'Gun', type: 'Weapon', chars: { Range: '24"', S: '5', Abilities: 'Blast. Each time…' } }] }, 'official')).toBeNull();
    expect(summaryLine({}, 'official')).toBeNull();
  });

  test("an option's own ability text comes before a shared rule it links to", () => {
    const info: EntryInfo = {
      profiles: [{ name: 'Crescendo', type: 'Abilities', chars: { Description: 'The bearer can shoot twice. Only once per battle.' } }],
      rules: [{ name: 'Shuriken Weapons', text: 'Each time an attack is made with a shuriken weapon, an unmodified wound roll of 6 improves AP.' }],
    };
    expect(summaryLine(info, 'official')).toBe('The bearer can shoot twice.');
  });

  test('a sentence ends at a full stop that is followed by a space, not at an inch mark or inside a quotation', () => {
    expect(summaryLine({ rules: [{ name: 'R', text: 'Units within 6" get +1. Next.' }] }, 'official')).toBe('Units within 6" get +1.');
    expect(summaryLine({ rules: [{ name: 'R', text: 'It reads “Stand firm. Hold.” to all. Next.' }] }, 'official')).toBe('It reads “Stand firm. Hold.” to all.');
    expect(summaryLine({ rules: [{ name: 'R', text: 'Is it 6"? Yes! Then.' }] }, 'official')).toBe('Is it 6"?');
    expect(summaryLine({ rules: [{ name: 'R', text: 'One sentence with no stop' }] }, 'official')).toBe('One sentence with no stop');
  });

  test('a line break ends the line, a list bullet is dropped, and a line ending with ":" runs on into the next', () => {
    expect(summaryLine({ rules: [{ name: 'R', text: '-All DESTROYER CULT units gain X\n-This unit never gains Y' }] }, 'official')).toBe('All DESTROYER CULT units gain X');
    expect(summaryLine({ rules: [{ name: 'R', text: 'When chosen:\n• Add 1 to hit rolls. Then.\n• Other' }] }, 'official')).toBe('When chosen: Add 1 to hit rolls.');
    expect(summaryLine({ rules: [{ name: 'R', text: '\n\nFirst. Second.' }] }, 'official')).toBe('First.');
  });

  test('summaryLine caps at 160 characters with an ellipsis', () => {
    const long = `${'word '.repeat(60)}end. Next.`;
    const line = summaryLine({ rules: [{ name: 'R', text: long }] }, 'official')!;
    expect(line.endsWith('…')).toBe(true);
    expect(line.length).toBeLessThanOrEqual(160);
  });
});

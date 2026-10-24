import { childOptions, optionDisplay, type OptionNode } from '@recruit/data/roster';
import { test } from 'vitest';
import { getRosterScope } from '../factions/dataClient';
import { entryInfo, loadEntryInfo, summaryLine } from '../data/entryInfo';
import { weaponLine } from '../ui/datasheet';
import { addNamed, novokhPatrol } from './__fixtures__/patrolList';
import { stubGeneratedData } from './__fixtures__/generatedData';

const flat = (ns: OptionNode[]): OptionNode[] => ns.flatMap((n) => (n.kind === 'group' ? [n, ...flat(n.children)] : [n]));

test('probe', async () => {
  stubGeneratedData();
  const scope = await getRosterScope(['necrons']);
  const info = await loadEntryInfo(['necrons']);
  const r = novokhPatrol(scope);
  const ov = r.forces[0].selections.find((s) => s.entryId && scope.node(s.entryId)?.name === 'Overlord') ?? r.forces[0].selections.at(-3)!;
  for (const o of flat(childOptions(scope, r, ov.id))) {
    const i = entryInfo(scope, info, o.id);
    const d = optionDisplay(o.name);
    const weapons = i?.profiles?.filter((p) => p.type === 'Weapon').map((p) => `${p.name}: ${weaponLine(p)}`) ?? [];
    console.log(o.kind, '|', o.name, '|', d.name, '|', d.heading, '|', weapons.join(' ;; '), '|', i ? summaryLine(i, 'official')?.slice(0, 60) : '-');
  }
});

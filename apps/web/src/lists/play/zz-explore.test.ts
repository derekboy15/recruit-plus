import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { loadEntryInfo } from '../../data/entryInfo';
import { getCatalogue } from '../../factions/dataClient';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { novokhIncursionData, viewOf } from './__fixtures__/playList';
import { armyRules } from './armyRules';
import { playArmy } from './playArmy';
test('explore', async () => {
  stubGeneratedData();
  const data = await novokhIncursionData({ secondDetachment: true });
  const { view, scope, units, slugs } = await viewOf(data);
  const army = playArmy(view, scope, units);
  const rules = armyRules(army, scope, await loadEntryInfo(slugs), [await getCatalogue('necrons')]);
  const out = {
    choices: army.choices,
    units: army.units.map((u) => ({ ...u, unit: u.unit?.name })),
    rules: rules.map((r) => [r.from, r.name, r.text.slice(0, 80)]),
  };
  writeFileSync('C:/Users/derek/AppData/Local/Temp/claude/L--9th-Edition/ab705ae2-ae48-44aa-a518-c424597b38f8/scratchpad/explore.json', JSON.stringify(out, null, 1));
});

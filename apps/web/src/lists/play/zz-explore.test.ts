import { FORCE } from '@recruit/data/roster';
import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { getRosterScope } from '../../factions/dataClient';
import { stubGeneratedData } from '../__fixtures__/generatedData';
import { armyChoices, startingRoster } from '../newListSetup';
test('explore', async () => {
  stubGeneratedData();
  const scope = await getRosterScope(['necrons']);
  const r = startingRoster(scope, { name: 'x', catalogueId: '61c6-c8c5-a304-ff5f', sizeId: 'incursion', forceId: FORCE.arksOfOmen });
  const out = armyChoices(scope, r).map((c) => [c.title, c.min, c.max, c.options.map((o) => o.name)]);
  writeFileSync('C:/Users/derek/AppData/Local/Temp/claude/L--9th-Edition/ab705ae2-ae48-44aa-a518-c424597b38f8/scratchpad/explore.json', JSON.stringify(out, null, 1));
});

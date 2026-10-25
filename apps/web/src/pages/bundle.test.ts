/** Home is in the main bundle: it reads lists and games straight from the local database, never through the engines. */
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { heavyImports } from './__fixtures__/importGraph';

test('the home page loads without the engine, the roster engine or the board', () => {
  expect(heavyImports(join(__dirname, 'Home.tsx'), ['@recruit/engine', '@recruit/engine/data', '@recruit/data/roster', 'pixi.js'])).toEqual([]);
});

/**
 * The Learn pages load without the engine and the board: they come only with the drill screens and "Your first game"
 * (lazily). Walks the static (non-type) imports from the Learn routes and fails if they reach either.
 */
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { heavyImports } from '../pages/__fixtures__/importGraph';

test('the Learn home, lesson pages and first-game page load without the engine or the board', () => {
  expect(heavyImports(join(__dirname, 'LearnRoutes.tsx'), ['@recruit/engine', '@recruit/engine/data', 'pixi.js'])).toEqual([]);
});

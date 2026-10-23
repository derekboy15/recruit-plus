import { describe, expect, test } from 'vitest';
import { boardKey } from './boardKeys';

const key = (k: string, shiftKey = false) => ({ key: k, shiftKey });

describe('boardKey in browse mode', () => {
  test('ArrowUp pans 2 inches, Shift 8', () => {
    expect(boardKey(key('ArrowUp'), 'browse')).toEqual({ kind: 'pan', dx: 0, dy: 2 });
    expect(boardKey(key('ArrowUp', true), 'browse')).toEqual({ kind: 'pan', dx: 0, dy: 8 });
    expect(boardKey(key('ArrowLeft'), 'browse')).toEqual({ kind: 'pan', dx: -2, dy: 0 });
  });
  test('+ and = zoom in, - zooms out, 0 fits', () => {
    expect(boardKey(key('+'), 'browse')).toEqual({ kind: 'zoom', factor: 1.4 });
    expect(boardKey(key('='), 'browse')).toEqual({ kind: 'zoom', factor: 1.4 });
    expect(boardKey(key('-'), 'browse')).toEqual({ kind: 'zoom', factor: 1 / 1.4 });
    expect(boardKey(key('0'), 'browse')).toEqual({ kind: 'fit' });
  });
  test('] cycles forward and [ back', () => {
    expect(boardKey(key(']'), 'browse')).toEqual({ kind: 'cycle', step: 1 });
    expect(boardKey(key('['), 'browse')).toEqual({ kind: 'cycle', step: -1 });
  });
  test('Enter selects; space grabs only in browse', () => {
    expect(boardKey(key('Enter'), 'browse')).toEqual({ kind: 'select' });
    expect(boardKey(key(' '), 'browse')).toEqual({ kind: 'grab' });
    expect(boardKey(key(' '), 'grabbed')).toEqual({ kind: 'drop' });
  });
});

describe('boardKey while a model is grabbed', () => {
  test('grabbed ArrowLeft nudges -0.5', () => {
    expect(boardKey(key('ArrowLeft'), 'grabbed')).toEqual({ kind: 'nudge', dx: -0.5, dy: 0 });
    expect(boardKey(key('ArrowUp', true), 'grabbed')).toEqual({ kind: 'nudge', dx: 0, dy: 2 });
  });
  test('Enter drops and Escape cancels when grabbed', () => {
    expect(boardKey(key('Enter'), 'grabbed')).toEqual({ kind: 'drop' });
    expect(boardKey(key('Escape'), 'grabbed')).toEqual({ kind: 'cancel' });
    expect(boardKey(key('Escape'), 'browse')).toBeNull();
  });
  test('Tab is never captured', () => {
    expect(boardKey(key('Tab'), 'browse')).toBeNull();
    expect(boardKey(key('Tab'), 'grabbed')).toBeNull();
  });
});

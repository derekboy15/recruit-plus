import { expect, test } from 'vitest';
import { isUuid, newDocId } from './ids';

test('isUuid accepts v1-v5 UUIDs and rejects anything else', () => {
  expect(isUuid('2c1f3c5e-9a53-4e0b-8a7e-1b2f3c4d5e6f')).toBe(true);
  expect(isUuid('2C1F3C5E-9A53-4E0B-8A7E-1B2F3C4D5E6F')).toBe(true);
  expect(isUuid('dev-list-1')).toBe(false);
  expect(isUuid('')).toBe(false);
  expect(isUuid('2c1f3c5e-9a53-6e0b-8a7e-1b2f3c4d5e6f')).toBe(false);
  expect(isUuid('2c1f3c5e-9a53-4e0b-8a7e-1b2f3c4d5e6f-extra')).toBe(false);
});

test('newDocId makes a fresh v4 UUID each time', () => {
  const a = newDocId();
  expect(isUuid(a)).toBe(true);
  expect(a[14]).toBe('4');
  expect(newDocId()).not.toBe(a);
});

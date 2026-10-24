import { expect, test } from 'vitest';
import { relativeTime } from './relativeTime';

const now = Date.UTC(2026, 9, 24, 12);

test('recent times read as minutes and hours', () => {
  expect(relativeTime(now - 20_000, now)).toBe('just now');
  expect(relativeTime(now - 60_000, now)).toBe('1 minute ago');
  expect(relativeTime(now - 5 * 60_000, now)).toBe('5 minutes ago');
  expect(relativeTime(now - 60 * 60_000, now)).toBe('1 hour ago');
  expect(relativeTime(now - 2 * 3600_000, now)).toBe('2 hours ago');
});

test('older times read as days and weeks', () => {
  expect(relativeTime(now - 30 * 3600_000, now)).toBe('yesterday');
  expect(relativeTime(now - 3 * 86400_000, now)).toBe('3 days ago');
  expect(relativeTime(now - 7 * 86400_000, now)).toBe('1 week ago');
  expect(relativeTime(now - 15 * 86400_000, now)).toBe('2 weeks ago');
});

test('beyond 30 days it is a date', () => {
  // Midday, so the date is the same in every time zone the test might run in.
  expect(relativeTime(Date.UTC(2026, 2, 12, 12), now)).toBe('12 Mar 2026');
});

test('a time a little in the future (a clock out of step) is just now', () => {
  expect(relativeTime(now + 30_000, now)).toBe('just now');
});

test('now defaults to the current time', () => {
  expect(relativeTime(Date.now() - 2 * 3600_000)).toBe('2 hours ago');
});

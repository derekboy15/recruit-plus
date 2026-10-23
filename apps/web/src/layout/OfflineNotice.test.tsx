import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { isOfflineError, LoadError, OFFLINE_NOTICE } from './OfflineNotice';

describe('isOfflineError', () => {
  test('true when the browser says it is offline', () => {
    expect(isOfflineError(new Error('anything'), { onLine: false })).toBe(true);
  });
  test('true for a failed fetch', () => {
    expect(isOfflineError(new TypeError('Failed to fetch'), { onLine: true })).toBe(true);
  });
  test('false for a TypeError that is a bug, not the network', () => {
    expect(isOfflineError(new TypeError("Cannot read properties of undefined (reading 'find')"), { onLine: true })).toBe(false);
  });
  test('false for an HTTP error while online', () => {
    expect(isOfflineError(new Error('Could not load /data/x.json (HTTP 404)'), { onLine: true })).toBe(false);
  });
});

describe('LoadError', () => {
  test('offline shows the offline notice as a status', () => {
    render(<LoadError error={new TypeError('Failed to fetch')} what="this faction" nav={{ onLine: false }} />);
    expect(screen.getByRole('status')).toHaveTextContent(OFFLINE_NOTICE);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  test('other failures keep the could-not-load alert', () => {
    render(<LoadError error={new Error('HTTP 500')} what="this faction" nav={{ onLine: true }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load this faction: HTTP 500');
  });
});

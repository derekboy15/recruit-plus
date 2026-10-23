import { describe, expect, test, vi } from 'vitest';
import { registerAfterLoad } from './pwa';

function fakeWindow(readyState: DocumentReadyState) {
  const target = new EventTarget();
  return Object.assign(target, { document: { readyState } }) as unknown as Window;
}

describe('registerAfterLoad', () => {
  test('registers only after load', () => {
    const win = fakeWindow('loading');
    const register = vi.fn();
    registerAfterLoad(register, win);
    expect(register).not.toHaveBeenCalled();
    win.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledTimes(1);
  });

  test('registers at once when already loaded', () => {
    const register = vi.fn();
    registerAfterLoad(register, fakeWindow('complete'));
    expect(register).toHaveBeenCalledTimes(1);
  });
});

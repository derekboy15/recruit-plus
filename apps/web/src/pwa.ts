/**
 * The service worker downloads the whole app (about 1.6 MB) when it installs. Registering it after the page has
 * loaded keeps that download from competing with the first page on a slow phone connection.
 */
export function registerAfterLoad(register: () => void, win: Window = window): void {
  if (win.document.readyState === 'complete') register();
  else win.addEventListener('load', () => register(), { once: true });
}

/** What a page shows when its data can't be fetched: an offline notice when that's the reason, else the error. */
export const OFFLINE_NOTICE =
  "You're offline, and this hasn't been saved on this device yet. Open it once while online and it will work offline after that.";

/**
 * A fetch that failed for lack of a connection: the browser says it is offline, or fetch itself rejected. Browsers
 * reject with a TypeError worded "Failed to fetch" (Chrome), "NetworkError when attempting to fetch resource"
 * (Firefox) or "Load failed" (Safari); other TypeErrors are bugs, not the network.
 */
export function isOfflineError(e: unknown, nav: { onLine: boolean } = navigator): boolean {
  return nav.onLine === false || (e instanceof TypeError && /fetch|network|load failed/i.test(e.message));
}

export function OfflineNotice() {
  return (
    <p role="status" className="card">
      {OFFLINE_NOTICE}
    </p>
  );
}

/** `what` completes "Couldn’t load …", e.g. "this faction". */
export function LoadError({ error, what, nav }: { error: Error; what: string; nav?: { onLine: boolean } }) {
  if (isOfflineError(error, nav)) return <OfflineNotice />;
  return <p role="alert">{`Couldn’t load ${what}: ${error.message}`}</p>;
}

/// <reference lib="webworker" />
/**
 * The service worker. After one online visit:
 * - the app's code, the page shell and the shell data (rules, lessons, missions, core stratagems, faction index) are
 *   precached, so every route opens offline;
 * - faction data (catalogues, unit lists, rosters, guides, option info) is kept as it is used, so the factions you have opened work
 *   offline;
 * - a page request that can't be answered at all gets /offline.html, kept in its own cache.
 */
import { clientsClaim } from 'workbox-core';
import { ExpirationPlugin } from 'workbox-expiration';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

const OFFLINE_CACHE = 'recruit-offline';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then((c) => c.add(new Request(OFFLINE_URL, { cache: 'reload' }))));
});

void self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/data\//, /^\/offline\.html$/] }));

registerRoute(
  ({ url }) => url.origin === self.location.origin && /^\/data\/(catalogues|units|roster|guides|info)\//.test(url.pathname),
  new StaleWhileRevalidate({ cacheName: 'recruit-faction-data', plugins: [new ExpirationPlugin({ maxEntries: 200 })] }),
);
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/data/'),
  new StaleWhileRevalidate({ cacheName: 'recruit-data' }),
);

setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') return (await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE })) ?? Response.error();
  return Response.error();
});

# Recruit+ (Warhammer 40,000 9th Edition)

A learn-to-play army builder and game companion for 40k 9th Edition. Unofficial fan-made tool, not affiliated with Games Workshop.

- Design: `docs/superpowers/specs/2026-10-20-recruit-plus-design.md`
- Packages: `packages/data` (data pipeline), `apps/web` (PWA)

```bash
npm install
npm run data:fetch   # downloads BSData wh40k-9e v9.8.0 (sha256-verified)
npm run data:build   # writes packages/data/generated/
npm test
npm run dev
```

More checks: `npm run typecheck`, `npm run build` then `npm run budgets -w apps/web` (size budgets, `docs/perf.md`), and `npm run e2e` (the dev-server flows, then the production build with its service worker: offline, accessibility, phone performance, installability).

To publish the site (Supabase, GitHub, Vercel), follow `DEPLOY.md`.

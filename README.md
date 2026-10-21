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

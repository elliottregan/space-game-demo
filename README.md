# Space Game Demo

A deck-building roguelike strategy game. Vue 3 + TypeScript + Vite + Bun.

Play a civilization across branching "Epochs." Each run, build a tableau of Lands, play Roles and Keystones onto improved slots, and assemble a winning hand (poker pattern + project keystone) to complete a Mega-Structure. Monuments, Legacy Cards, and ideology terrain carry across the campaign.

Design spec: [`docs/specs/DECK-BUILDING-REDESIGN.md`](docs/specs/DECK-BUILDING-REDESIGN.md).

## Run

```bash
bun install
bun run dev           # http://localhost:5174
bun run build
bun test
bun run typecheck
```

## Structure

- `src/core/` — pure TypeScript game logic (no Vue)
- `src/facade/` — `GameAPI` + `localStorage` persistence
- `src/renderer/` — Vue 3 components + reactive `GameService`
- `scripts/analyze-paths.ts` — headless simulation for balance analysis
- `tests/` — Bun unit + smoke tests

See [`CLAUDE.md`](CLAUDE.md) for architecture notes.

# Deck-Building Demo

Throwaway prototype of the deck-building redesign (see `../docs/specs/DECK-BUILDING-REDESIGN.md`).

**Status:** mechanics-first test harness. Not polished. Expected to reveal design refinements.

## Run

```bash
cd demo
bun install
bun run dev     # http://localhost:5174
bun run test    # unit tests on core modules
bun run typecheck
```

## Structure

- `src/core/` — pure TS game logic, no Vue
- `src/facade/` — GameAPI entry points
- `src/renderer/` — Vue 3 components + GameService bridge

Mirrors the `core / facade / renderer` split of the parent project. Does not import from `../src/`.

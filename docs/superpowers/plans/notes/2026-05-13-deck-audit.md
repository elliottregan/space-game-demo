# Deck audit for row-hand stacking (2026-05-13)

Confirmed via `ALL_CARDS`: lands provide 4 per rank (one per ideology) and roles provide 4 per role-type (one per ideology), with ranks 2–9 for lands and 10–14 for roles. Charters are rank 15.

## Homeworld
- **Ideologies:** heritage, solidarity, sovereignty, transformation (plus wild charters)
- **Land ranks present:** 2–9 (4 lands per rank)
- **Role types present:** agitator, scholar, preacher, engineer, architect (4 cards per role)
- **Reachable patterns:** all 10. Land row supports up to four-of-a-kind (4 same-rank lands) and full-house (3+2 same-row, e.g. 3 rank-4 + 2 rank-7) because per-rank cap is 4. Role row supports the same, since per-role-type cap is also 4. Straight (lands) reachable via 5 consecutive ranks. Straight (roles) reachable via 5 different role-types. Cross-row pair/two-pair/full-house combinations all work. Flush reachable via mono-ideology column. Straight-flush via mono-ideology land straight. Royal-flush via mono-ideology role straight (one of each role-type, all same ideology — possible since each role-type has all 4 ideologies).
- **Locked out:** none.

## Generation Ship
- **Ideologies:** sovereignty, transformation (plus wild charters; no heritage, no solidarity)
- **Land ranks present:** 2–9 (2 lands per rank — one per ideology)
- **Role types present:** agitator, scholar, preacher, engineer, architect (2 cards per role-type — one per ideology)
- **Reachable patterns:** high-card, pair (lands or roles), two-pair (lands or roles), straight (lands), straight (roles), flush, straight-flush, royal-flush.
- **Locked out:**
  - **three-of-a-kind** — only 2 of each rank/role-type in the deck.
  - **four-of-a-kind** — same reason.
  - **full-house** — needs 3 of one rank + 2 of another in a single row, or three-of-a-kind in one row + pair in the other. Both forms require 3 of one rank/role-type, which the deck doesn't supply.
- **Notes:** intentional design constraint — Generation Ship is a deliberately tight Setting where the highest-tier patterns are unlock walls. Two-pair and straight remain achievable, and flush/straight-flush/royal-flush are gated by the same ideology mono-color requirement that lives elsewhere in the game.

## Ruined Homeworld
- **Ideologies:** heritage, solidarity, sovereignty, transformation (plus wild charters)
- **Land ranks present:** 2–9 (4 lands per rank)
- **Role types present:** all 5 role types (4 per role-type)
- **Reachable patterns:** all 10 (deck composition matches Homeworld).
- **Locked out:** none from deck composition.
- **Notes:** any Setting-specific scarcity (e.g. a curated startingDeck filter) was not present in the current code; if a future filter narrows the deck, this audit will need a refresh.

---

## Summary for keystone authoring

- **Homeworld and Ruined Homeworld** can in principle unlock any of the 10 patterns. Author keystones for all 10 patterns in each Setting.
- **Generation Ship** has three structurally unreachable patterns (three-of-a-kind, four-of-a-kind, full-house). Per the plan, still author keystones for these (the data must be complete for typecheck and Crisis resolution); players just won't trigger them.
- "Full-house in a single row" requires a 5-card row (3+2). The pattern set allows row sizes up to 5 — there is no separate cap. Confirmed by `validateRowHand` in `src/core/engine/rowHands.ts`.

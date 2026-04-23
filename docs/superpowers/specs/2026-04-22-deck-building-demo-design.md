# Deck-Building Demo — Build Design

Companion to `docs/specs/DECK-BUILDING-REDESIGN.md`. This design covers the **demo build** only — a self-contained prototype to validate the core mechanics of the spec before committing to a full redesign.

## Goal

Build an interactive demo that exercises the spec's three design pillars enough to reveal refinements:

1. **Jack-of-diamonds cards** — every card usable for play or slot
2. **Ideology on the table** — card-derived 2-axis vector, visible and countable
3. **Planet-as-memoir** — one campaign transition to test Legacy / Monument / terrain flow

Treated as throwaway: if the demo works, the real implementation may be a port or a rewrite.

## Location & Tech

- **Directory:** `demo/` (sibling to `src/`)
- Self-contained: own `package.json`, `vite.config.ts`, `tsconfig.json`
- No imports from the existing `src/`
- Stack: Vue 3 + TypeScript + Vite + Bun
- README at `demo/README.md` marking throwaway status

## Architecture

Mirrors the spec's P8 recommendation and the existing project's core/facade/renderer split.

```
demo/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── README.md
└── src/
    ├── main.ts
    ├── core/
    │   ├── types.ts           — Card, Ideology, Role, Rank, EffectSpec, etc.
    │   ├── cards.ts           — the 54-card pool definitions
    │   ├── homeworld.ts       — Homeworld Setting data (§16)
    │   ├── generationShip.ts  — stub Generation Ship Setting
    │   ├── ideology.ts        — vector derivation, alignment, gate checks
    │   ├── patterns.ts        — pattern matcher (four-of-a-kind, flush, etc.)
    │   ├── dissent.ts         — Dissent variants + generation + purge
    │   ├── market.ts          — river, refresh, acquire
    │   ├── tableau.ts         — stack ops, slotting
    │   ├── effects.ts         — EffectSpec resolver (immediate + end-of-turn)
    │   ├── epoch.ts           — Epoch state + turn state machine
    │   ├── campaign.ts        — Campaign state, Legacy, Monuments, terrain
    │   └── legacy.ts          — minting + upgrade-path application
    ├── facade/
    │   └── GameAPI.ts         — executeCommand, checkAffordability, snapshots
    └── renderer/
        ├── App.vue
        ├── GameService.ts     — reactive bridge
        ├── styles.css
        └── components/
            ├── TurnBar.vue
            ├── HandPanel.vue
            ├── TableauPanel.vue
            ├── MarketPanel.vue
            ├── ProjectZonesPanel.vue
            ├── IdeologyDisplay.vue
            ├── LegacySidebar.vue
            ├── Card.vue
            ├── ProjectZone.vue
            └── EndOfEpochScreen.vue
```

## Data model highlights

- `Card` as in spec §17 — `kind`, `rank`, `ideology`, `role?`, `influenceCost`, `effect`, `slotPassive?`, `marketCost`, `tags`
- `Epoch` holds `hand`, `draw`, `discard`, `tableauStacks` (array of stacks of Lands), `projectSlots` (keyed by project id), `market`, `influence`, `materials`, `taskProgress`, `endOfTurnQueue`
- `Campaign` holds `currentSettingId`, `legacyCards`, `monuments`, `terrain`, `epochHistory`
- Ideology vector derived per-tick from `tableauStacks ∪ projectSlots ∪ terrain` — never stored
- Effects split into immediate vs end-of-turn per spec §5

## Turn state machine

Per spec §5: Draw → Main → Upkeep → Acquire → End → Refresh. Commands valid only in the appropriate phase.

GameAPI commands (flat list):

- `drawPhase()` — auto on turn start
- `playCard(cardId)` — pays Influence, applies immediate effects, lands go to tableau
- `slotCard(cardId, projectId)` — commits card to project, generates Dissent if opposed
- `acquireCard(riverIndex | 'keystone')` — pays Materials, adds to discard
- `unslot(cardId, projectId)` — 2 Influence + 1 Quiet Dissent
- `endTurn()` — runs upkeep, end-of-turn effects, checks win/loss, advances
- `advanceEpoch(legacyChoices)` — at end-of-epoch screen, applies upgrades, transitions

## Scope trim for Homeworld + 1 transition

**Included (faithful to spec):**
- All 54 cards enumerated with at least stub effects
- Full Homeworld starter deck, tableau, 3 Mega-Projects, Keystones
- Market river of 5 + Keystone slot
- Ideology vector + alignment cost modifiers + active-axis threshold
- All 3 Dissent variants + generation from opposed slotting + card-specific + scarred terrain
- Loss triggers: Populace Turned (>50% Dissent), Starved Out (soft turn limit)
- Short-term tasks from Homeworld pool (4 revealed per Epoch)
- Completion tier scoring
- Legacy minting (Mega-Project Legacy + 1-3 played-card Legacies OR 1-2 consolation Legacies)
- Upgrade-path picker (Potency / Pliability / Persistence)
- Monument (with tier + terrain delta)
- Terrain offset applied at Epoch 2 start
- Generation Ship Setting (stubbed: smaller hand/tableau per spec, small market pool, 1 Mega-Project)

**Skipped for this demo:**
- Banish timer (3-turn idle cards removed) — cards stay until bought or turn end
- Exclusive card pools unlocked at axis thresholds
- Pact reveals on `|axis| >= 6`
- Purge market slot (Heritage cards are the only purge path)
- Evolving faction platforms (not in spec)
- Monte Carlo / simulation harness (explicitly abandoned by spec)
- Save/load persistence (state lives in-memory per session)

## Visual style

- Flat CSS, no images. Suit colors as CSS variables.
- Card: rank badge top-left, suit chip top-right, name center, effect text bottom, border color = suit. Influence cost as a corner pill. Market cost shown when card is in the market.
- Tableau slot: shows stack from bottom to top, top card is the "active" one.
- Project zone: title, pattern requirements (checklist), slots as gray boxes that fill with slotted cards, progress bar for score.
- Ideology: two horizontal bars, signed (-N ... +N) with center zero and threshold marks at ±3 / ±6 / ±8. Demonym chip when a side is dominant.
- Legacy sidebar: three stacked blocks — Ideology, Monuments, Legacy Cards. Terrain shown as a pre-loaded marker on the ideology bars.

## Testing

- **Unit tests** (Bun test runner) on pure core modules:
  - `ideology.ts` — derivation from synthetic board states
  - `patterns.ts` — pattern matcher against card sets
  - `dissent.ts` — Dissent generation rules
  - `legacy.ts` — minting per outcome + upgrade application
  - `effects.ts` — immediate vs end-of-turn ordering
- **Manual UI playtest** — hand-driven walkthrough of one Epoch
- Skip: full-epoch integration tests, simulated AI

## Build order

1. Scaffold `demo/` directory with Vite/Vue/TS/Bun
2. Core types + the 54-card pool (stub effects where necessary)
3. Homeworld Setting data + Generation Ship stub
4. Ideology derivation + pattern matcher + tests
5. Epoch state + turn state machine + effect resolver
6. Dissent system + loss triggers
7. Market + acquire flow
8. Legacy + Monument + terrain + campaign transition
9. GameAPI facade
10. GameService bridge + reactive state
11. Vue components + styles
12. Manual playtest + refinement

## Out of scope

- Polishing beyond "state is legible"
- Animations, sound, art direction
- Multiplayer, AI opponents
- Deleting any code in existing `src/`
- CLAUDE.md updates
- Any Git push / PR (commits within the branch are fine)

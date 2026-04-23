# Deck-Building Redesign — Design Spec

## 1. Status & Relationship to Existing Specs

This document **supersedes** the existing simulation-based game design captured in `00-PROJECT-OVERVIEW.md` through `14-IDEOLOGY-DISTANCE-GATING.md`. The older specs remain in-tree as **historical reference** only — no mechanics from them carry forward.

**What persists from the old game (themes only):**
- Four-ideology framing (Solidarity, Sovereignty, Transformation) plus a new fourth: **Heritage**
- Ideology demonyms (The Collective, The Dominion, The Ascendancy, The Keepers) as narrative flavor
- Mega-projects (Ark, Commune, Reactor, Cathedral) as late-game objectives
- Mars-to-generation-ship narrative arc

**What is fully abandoned:**
- Tick-based resource simulation (food, oxygen, power, materials, water as continuous flows)
- Building construction queues and worker assignment
- Morale, crises, events-as-modal-popups
- Technology tree research
- District grants / ideology spread through social networks
- Monte Carlo simulation harness and `HeuristicStrategy` AI
- The `GameState.tick()` system-execution order

The new game is a **deck-building roguelike strategy game** with a persistent branching campaign.

---

## 2. Vision

**Pitch.** You lead a civilization on a hostile world. Each Epoch is one run (~20 min) where you play cards to build a society, commit to an ideological direction, and race to complete one of several Mega-Projects. Every card has two lives: *play it* for an immediate effect, or *slot it* into a Mega-Project where it contributes to completion by its role and ideology. The planet remembers — your victories leave Monuments, your failures leave scars, and both shape the next Epoch's starting conditions.

**Position.** Card-play rhythm is closer to Dominion/Ascension than combat-focused deck-builders. The slotting mechanic takes from the *patterns as objectives* lineage (Ascension constructs, Wingspan bonuses). Meta-progression is Hades-like: every run authors the next. The dual-classification cards (Role × Ideology, like rank × suit) are the distinctive core — a card is a jack of diamonds, usable in a four-of-a-kind or a flush.

**Three design pillars:**

1. **Jack-of-diamonds cards.** No dead cards. Every card has two tags (Role/Rank + Ideology) and contributes to multiple patterns. The strategic question is never "is this card good" but "where is it best spent right now."
2. **Ideology on the table, not behind it.** Your ideology is a rank-sum differential of cards currently in tableau + slotted in projects — always visible, always countable, no hidden drift values. Cards cost less when aligned, more when opposed. Deckbuilding is shaping the board's ideological center of mass.
3. **Planet-as-memoir.** Each Epoch leaves lasting traces — Monuments, Legacy Cards, ideology terrain. Reading a save file means reading the planet's history. Failure seeds a next Epoch as richly as success.

---

## 3. Glossary

| Term | Definition |
|---|---|
| **Campaign** | One planet's history. A tree of Settings traversed across many Epochs until a terminal state is reached. |
| **Setting** | A configured scenario (Homeworld, Generation Ship, Ruined Homeworld, etc.). Defines rules, starting deck, market pool, Mega-Projects, and transitions. |
| **Epoch** | One run within a Setting. ~20 minutes, 12–18 turns. Ends in a win (Mega-Project completed) or loss (Dissent overflow / turn limit). |
| **Turn** | One player cycle: draw → play → upkeep → acquire → end. Thematically a "Sol" (kept from old game flavor). |
| **Ideology** | A suit. Four exist: Solidarity, Sovereignty, Transformation, Heritage. They form two opposing-pair axes: Solidarity↔Sovereignty and Heritage↔Transformation. |
| **Suit** | Ideology, when referring to cards. |
| **Axis** | One of the two ideology axes (organization or time). An integer value equal to the rank-sum differential between opposing suits. |
| **Ideology Vector** | The 2D state `(axis1, axis2)` derived from cards currently on the board (tableau + slotted). Always computable, never hidden. |
| **Active Axis** | An axis where \|value\| ≥ 3. Only active axes confer alignment or opposition. |
| **Demonym** | Flavor label for a dominant ideology state (The Collective = Solidarity-dominant; The Dominion = Sovereignty; The Ascendancy = Transformation; The Keepers = Heritage). Narrative only; no entity state. |
| **Terrain** | The persistent cross-Epoch offset applied to axis values at Epoch start. Positive = settled for dominant side; negative = scarred. |
| **Role** | A card's face-card identity: Agitator (10), Scholar (J), Preacher (Q), Engineer (K), Architect (A). |
| **Rank** | A card's numeric value, 2–9 for Lands, 10–A for Roles, 15 for Keystones (Jokers). |
| **Land** | A numbered card (2–9). Generates Materials when in tableau. Contributes a suit pip when slotted. |
| **Keystone** | A Joker. Wild-suit, wild-role. Materials-only purchase. Rare and potent. |
| **Tableau** | The persistent board of Lands and Structures. Fixed slot count per Setting. |
| **Slot** | A position in a Mega-Project's build track where a card can be committed permanently. |
| **Market** | A shared river of 5 cards, refreshed each turn. Players buy with Materials. |
| **Influence** | Turn-local currency. 2 baseline + card-granted. Spent to play cards. |
| **Materials** | Persistent Epoch currency. Earned from Lands and tasks. Spent at market. |
| **Dissent** | Dead cards that clog the deck. Three variants. Generated by opposed slotting and specific card effects. |
| **Legacy Card** | A card minted at Epoch end, carrying forward into future Epochs. Upgraded along one of three paths. |
| **Monument** | The residue of a completed Mega-Project. Applies a terrain offset across Epochs. |

---

## 4. Design Principles

1. **No dead cards.** Every card is always contributable somewhere. Even weak starter Lands have a suit and a rank, so they can fill a flush or a low-value slot. The "play or save" decision replaces the "is this card useful" question.
2. **Failure is authorship.** A lost Epoch shunts to a themed loss-branch Setting *and* mints 1–2 consolation Legacy Cards flavored by *how* you failed. The campaign narrative is as rich in loss as in win.
3. **Dual-use tension.** Every turn asks: spend this card for its effect now, or save it to slot into a Mega-Project later? Influence scarcity and limited hand size make this a real question every turn, not just at the end.
4. **Snowball brakes via terrain.** Same-ideology win streaks push terrain hard in one direction, pre-loading the starting axis value. This means future Epochs start already near threshold — so further same-axis plays are less impactful, and the market becomes choked with opposed-suit Backlash. The game nudges toward divergence.
5. **Math lives on the board.** Ideology, alignment, Mega-Project progress, and task progress are all derivable by counting cards visible in play. No hidden timers or accumulated drift values.
6. **Configurable Settings.** All scenario variation lives in data. A Setting is a config object, not a hardcoded path. New Settings can be authored without engine changes.
7. **Abstract world UI.** No map. The planet's state fits in a sidebar: Monuments, ideology state, Terrain, Legacy Cards.

---

## 5. Core Loop — One Epoch

### Turn structure (6 steps)

1. **Draw** up to hand size (default 5).
2. **Main phase.** Play cards by paying Influence. Apply immediate effects. Optionally slot cards into Mega-Project zones.
3. **Tableau upkeep.** Each Land produces Materials. Structures trigger ongoing effects. Slotted-card passives resolve.
4. **Acquire.** Spend Materials at the market river to add 1 card to discard pile.
5. **End phase.** Resolve queued end-of-turn effects (see below). Discard hand. Check win/loss.
6. **Refresh.** Market refills. Influence resets.

### Effect timing

Card effects split into two classes:

- **Immediate** (resolve on play): `gainInfluence`, `gainMaterials`, `draw`, `discardSelection`. You can spend gained Influence on further plays this turn; drawn cards are playable this turn.
- **End-of-turn** (queue during main phase, resolve all at once at step 5 in play order): ideology board-state updates (re-compute vector from cards currently placed), Dissent generation, Monument/terrain updates, axis-threshold unlock checks.

Rationale: splits "does this combo work *now*?" from "what happens because of this turn's plays?" and avoids order-of-operations edge cases during the main phase. The board recomputes its ideology vector at end phase, so mid-turn alignment costs use the *start-of-turn* vector — predictable and countable.

### Epoch flow

```
Setting config loaded
  │
  ▼
Setup:
  - Inherit Legacy state (cards, terrain, Monuments)
  - Build starting deck (Setting's starterDeck + Legacy Cards)
  - Place starting tableau
  - Reveal 3 Mega-Projects, 3–5 short-term tasks, initial market
  │
  ▼
Turn loop (12–18 turns typically)
  │
  ▼
End condition hit:
  - Win:  one Mega-Project completed
  - Loss: Dissent >50% OR soft turn limit reached
  │
  ▼
Legacy minting:
  - Win: 1 Mega-Project Legacy + 1–3 played-card Legacies (3 upgrade choices each)
  - Loss: 1–2 consolation Legacies themed by failure mode
  │
  ▼
Monument + terrain update on Campaign
  │
  ▼
Transition:
  - Win: follow the completed Mega-Project's onWin branch
  - Loss: follow the Setting's onLoss branch (or campaign-end)
  │
  ▼
Next Epoch begins (or campaign ends at terminal Setting)
```

---

## 6. Card System

### Card anatomy

Every card has these fields:

| Field | Values |
|---|---|
| `id` | Unique string, e.g. `preacher-solidarity` |
| `name` | Flavor name, e.g. *"The Mediator"* |
| `role` or `land` | One of 5 Roles (10/J/Q/K/A) OR a Land tier (2–9). Keystones are `keystone`. |
| `rank` | 2–9 for Lands, 10–14 for Roles, 15 for Keystones |
| `ideology` | One of `solidarity` / `sovereignty` / `transformation` / `heritage`; Keystones are `wild` |
| `influenceCost` | Integer, typically 0–4 |
| `effect` | Text + machine-readable effect description |
| `slotPassive` | Optional small ongoing effect while slotted in a Mega-Project zone |
| `marketCost` | Materials to acquire from market; scales with rank |
| `tags` | Optional: `dissent`, `keystone`, `legacy`, etc. |

### The 54-card pool

**Standard-deck shape:** 4 suits × 13 ranks + 2 Jokers.

- **20 Role cards** = 5 Roles × 4 Ideologies
- **32 Land cards** = 8 ranks (2–9) × 4 Ideologies
- **2 Keystones** (Jokers, wild suit)

### Role identities

| Rank | Role | Archetype | Representative effects |
|---|---|---|---|
| 10 | **Agitator** | Disruptor | +Influence, shift ideology, add Dissent of opposed suits |
| J | **Scholar** | Draw/research | Draw cards, peek market, reduce next acquire cost |
| Q | **Preacher** | Ideology shifter | Add rank contribution to an axis when slotted; convert Dissent; unlock exclusive cards |
| K | **Engineer** | Economy multiplier | +Materials, discount Structure costs, duplicate Land output |
| A | **Architect** | Tableau power | Duplicate a tableau trigger, slot a card at reduced cost, mint bonus Legacy |

Each Role has 4 ideology variants with flavored names:

| Role | Solidarity | Sovereignty | Transformation | Heritage |
|---|---|---|---|---|
| Agitator (10) | The Organizer | The Demagogue | The Rebel | The Elder |
| Scholar (J) | The Teacher | The Archivist | The Researcher | The Historian |
| Preacher (Q) | The Mediator | The Orator | The Prophet | The Chronicler |
| Engineer (K) | The Builder | The Industrialist | The Inventor | The Restorer |
| Architect (A) | The Founder | The Sovereign | The Visionary | The Patriarch |

### Land identities

Lands are economy engines. Rank = economy tier. Each suit has flavored names at each rank:

| Rank | Solidarity | Sovereignty | Transformation | Heritage |
|---|---|---|---|---|
| 2 | Commons | Outpost | Lab | Shrine |
| 3 | Hearth | Watchtower | Workshop | Chapel |
| 4 | Plaza | Barracks | Foundry | Archive |
| 5 | Assembly | Vault | Forge | Reliquary |
| 6 | Forum | Armory | Synthesizer | Sanctum |
| 7 | Amphitheatre | Fortress | Spire | Memorial |
| 8 | Quarter | Citadel | Gateway | Mausoleum |
| 9 | Capital | Palace | Nexus | Monument |

**Economy tier effects (template):**

- **2–3 (low):** +1 Material/turn. 1 suit pip when slotted.
- **4–5 (mid-low):** +1 Material/turn + minor aligned-suit discount. 1 pip slot.
- **6–7 (mid-high):** +2 Materials/turn + minor recurring effect (e.g., draw +1 on turn X). 1 pip slot.
- **8–9 (high):** +3 Materials/turn + strong passive (e.g., all aligned cards cost −1 Influence). 1 pip slot.

### Land stacking

A tableau slot holds a **stack** of up to **3 Lands**:

- Each Land in the stack produces its own Materials per turn (additive economy).
- Only the **top Land's passive effect** is active. Lower Lands provide economy only.
- Playing a Land from hand when the target slot is occupied pushes the new Land on top of the stack.
- The stack contributes to ideology (all Lands in the stack count toward their suit's rank-sum).
- **Slotting into a Mega-Project demolishes the entire stack of one slot**, contributing every Land in the stack simultaneously. This is the primary path for Lands to enter project zones, and it rewards focused stack-building.
- If all 4 slots are full with 3-card stacks (12 Lands total), further Lands played from hand must either replace the top of an existing stack (the displaced Land goes to discard) or be held in hand until a slot is available.

### Keystones (Jokers)

Two unique wild cards per Setting. Examples for Homeworld:

- **The Pioneer** — wild role, wild suit. Influence cost 3. On play: draw 2. When slotted: counts as any Role and any Ideology for one slot.
- **The Apostle** — wild role, wild suit. Influence cost 2. On play: shift ideology +2 toward dominant suit. When slotted: counts as any Role and any Ideology. Adds 1 Unrest to deck.

Keystones are **Materials-only purchases** from a dedicated Keystone market slot (separate from the card river), typically gated by an ideology threshold or a short-term task completion. This deliberately blocks early-game rush strategies on Mega-Projects.

### Card-count summary

| Category | Count | Notes |
|---|---|---|
| Role cards | 20 | 5 Roles × 4 Ideologies |
| Land cards | 32 | 8 ranks × 4 Ideologies |
| Keystones | 2 | Setting-specific, Jokers |
| **Base pool** | **54** | Standard deck shape |
| Dissent cards | 3 variants | Generated in-game, not purchased |
| Legacy Cards | variable | Minted across campaign |

---

## 7. Economy

Two currencies with different time scales.

### Influence (turn-local)

- **Baseline:** 2 per turn, reset at end phase.
- **Card-granted:** some cards produce Influence on play (e.g., Agitator cards typically yield +1 Influence; low-rank Lands played from hand give +0 but their tableau presence reduces costs).
- **Spent on:** paying a card's `influenceCost` to play it.
- **Alignment modifier:** evaluated against the **start-of-turn ideology vector** (board-derived, see §8).
  - Card suit matches the dominant side of any active axis → **aligned**, cost −1 Influence (min 0)
  - Card suit matches the inferior side of any active axis → **opposed**, cost +1 Influence
  - Otherwise → neutral, cost unchanged

### Materials (persistent within an Epoch)

- **Earned from:** Lands in tableau (per-turn passive) and task rewards.
- **Spent on:** purchasing cards from the market river, purchasing Keystones, purging Dissent at specialized market slots.
- **Carry:** resets at Epoch start. Does not persist across Epochs.

### Market

- **River of 5 cards**, filtered by Setting's `marketPool`.
- **1 acquisition per turn** (free slot; does not cost Influence, costs Materials per card's `marketCost`).
- **Refresh:** at turn end, empty slots refill from a shuffled pool (removed cards are not replaced mid-turn, creating the "if I don't buy it someone else / the reshuffle will take it" tension).
- **Banish:** a card sitting 3 turns unpurchased is banished (removed from the pool permanently for this Epoch), making the market feel alive.

### Card purchase costs

| Tier | marketCost (Materials) |
|---|---|
| Land 2–3 | 2 |
| Land 4–5 | 4 |
| Land 6–7 | 7 |
| Land 8–9 | 10 |
| Role 10 (Agitator) | 3 |
| Role J (Scholar) | 4 |
| Role Q (Preacher) | 6 |
| Role K (Engineer) | 8 |
| Role A (Architect) | 10 |
| Keystone | 12 (gated) |

These numbers are **starting anchors**, to be tuned in prototyping.

### Dedicated market slots (optional)

A Setting may include special market slots beyond the river:

- **Keystone slot** — shows the Setting's 2 Keystones, unlocked by ideology threshold or task.
- **Purge slot** — sells a specialized Dissent-purge card for 5 Materials.
- **Exclusive slot** — revealed when you cross an axis alignment threshold (e.g., `|axis1| >= 6`); offers an axis-exclusive card for Materials.

---

## 8. Ideology System

### The four ideologies as two axes

Ideology is a 2D space with two opposing-pair axes:

- **Axis 1 (organization):** Solidarity ↔ Sovereignty (communal vs. hierarchical)
- **Axis 2 (time):** Heritage ↔ Transformation (ancestral vs. progressive)

```
                Transformation (+y)
                       |
                       |
   Solidarity (-x) ----+---- Sovereignty (+x)
                       |
                       |
                  Heritage (-y)
```

Each suit sits at a cardinal position. Every card belongs to exactly one suit.

| Suit | Axis position | Temperament | Example concerns |
|---|---|---|---|
| **Solidarity** | (-1, 0) | Communal, egalitarian | Housing, shared resources, civic life |
| **Sovereignty** | (+1, 0) | Hierarchical, ordered | Authority, defense, infrastructure |
| **Transformation** | (0, +1) | Progressive, scientific | Research, escape, change |
| **Heritage** | (0, -1) | Ancestral, preserving | Memory, lineage, restoration |

### Ideology vector — card-counted, not drifted

The ideology vector is **derived** from cards currently on the board, never stored as an accumulating float:

```
board = tableau (all stacked Lands) ∪ slotted cards (all Mega-Project zones)

axis1 = rankSum(Sovereignty cards on board) - rankSum(Solidarity cards on board)
axis2 = rankSum(Transformation cards on board) - rankSum(Heritage cards on board)
```

Both are **integers**, computed from what's visible in play. `axis1` positive = tilted Sovereignty; negative = Solidarity. Same for axis2 (Transformation vs. Heritage). Hand cards do not count; discard does not count; only the board.

Starting axis values are seeded by **terrain** (see §13) — a persistent cross-Epoch offset — so an Epoch on a world scarred against Solidarity begins with axis1 pre-loaded toward Sovereignty.

**Example.** Tableau slot A holds a stack `[Land·Solidarity·2, Land·Solidarity·3]`; slot B holds `Land·Transformation·5`. No cards slotted. Terrain offset = 0.
- `axis1 = 0 - (2+3) = -5` (Solidarity tilt)
- `axis2 = 5 - 0 = +5` (Transformation tilt)

### Active axis and alignment

An axis is **active** when `|axis| >= 3`. Only active axes confer alignment or opposition.

Alignment check for a played card:
- If card's suit matches the **dominant side** of any active axis → **aligned** (-1 Influence)
- If card's suit matches the **inferior side** of any active axis → **opposed** (+1 Influence)
- Otherwise → neutral

If both axes are active and give conflicting verdicts for different axes, alignment wins by the larger absolute axis magnitude.

Alignment is checked against the **start-of-turn vector** (see §5). Plays mid-turn don't re-cost each other.

### Threshold gates

Cards, Keystones, and Mega-Projects can require a rank-differential threshold:

- `gate: { side: 'solidarity', min: 8 }` → `axis1 <= -8` (8+ more Solidarity rank than Sovereignty rank)
- Mega-Project Keystones typically gate at `8–12` on the project's primary suit
- Exclusive flavor cards unlock at `6+` on their suit

Players can count the gate by eye: "I have 4 Solidarity Lands on board, ranks 2+3+4+5=14. One Sovereignty Land, rank 3. axis1 = 3 - 14 = -11. I'm past the Solidarity-8 threshold."

### Heritage as Commons

Heritage's axis often runs lower because Heritage cards tend to preserve rather than actively push. Heritage's distinctive role:

- **Preserver** — Heritage cards disproportionately interact with Legacy. Slotting Heritage cards contributes to Monument strength; several Heritage cards nominate slotted cards as Legacy candidates; Heritage plays are the main way to purge Dissent.
- **Keepers unlock** — if `axis2 <= -8` (Heritage-dominant) at Epoch end, a **Keepers-themed card pool** unlocks in the next Setting's market (a small set of exclusive Heritage cards). This replaces the old faction-emergence mechanic with a purely ideology-driven flavor unlock.

---

## 9. Ideology States & Demonyms

There are no faction entities. What would have been "factions" is derived from the ideology vector plus terrain, and given narrative labels for flavor only.

### The four demonyms

| Dominant axis state | Demonym | Era flavor |
|---|---|---|
| `axis1 <= -6` (Solidarity strong) | **The Collective** | Era of shared labor and public space |
| `axis1 >= +6` (Sovereignty strong) | **The Dominion** | Era of authority and ordered hierarchy |
| `axis2 >= +6` (Transformation strong) | **The Ascendancy** | Era of escape and transformation |
| `axis2 <= -6` (Heritage strong) | **The Keepers** | Era of memory and preservation |

These labels render in the sidebar and flavor text. They have **no mechanical state** — they are pure views of the ideology vector.

### What was "factions" becomes

| Old concept | New mechanic |
|---|---|
| Faction Active | Your axis leans their way |
| Pact offered | Axis reaches gate threshold → exclusive cards unlocked |
| Ascended faction | Completing a Mega-Project of their suit → terrain offset tilts their way, harder to unseat |
| Revanchist | The opposite axis's terrain is **scarred** (negative offset pushing against you) → generates Backlash Dissent at Epoch start and may block market slots of the scarred suit |
| Extinct | Terrain is so scarred against a suit across multiple Epochs that its market pool is temporarily excluded in the current Setting |
| Emergence | Crossing a high axis threshold unlocks the Keepers (or other emergent) card pool in the next Setting |

All derivable from two integers + a terrain record. No separate state machine.

### Scarred-terrain consequences (Revanchist equivalent)

At Epoch start, for each suit whose terrain offset is **scarred** (see §13 — a negative value pushing against the dominant direction):

- Add 1 **Ideological Backlash · [scarred suit]** Dissent card per 2 points of scarring (min 1, max 3 per suit).
- Market slot filtering: scarred-suit cards still appear in the river, but have a 50% chance of being **blocked** (visible, unpurchasable) each turn they sit — simulating popular resistance.

No named entity does this. The planet's history *is* the opposition.

### Pact equivalents

"Pacts" are now just threshold-gated card unlocks. Reaching `|axis| >= 6` on an axis for the first time this Epoch reveals a small set of **exclusive cards** in the market (defined per Setting). Reaching `|axis| >= 10` reveals a Keystone variant in the Keystone slot. No agreement ceremony, no exclusivity between factions — though ideology opposition naturally prevents you from unlocking both sides of the same axis.

---

## 10. Mega-Projects

Each Setting defines **3 Mega-Projects**. Completing any one wins the Epoch and transitions to the project's onWin Setting.

### Slot requirements (poker patterns)

| Pattern | Requirement |
|---|---|
| **Four-of-a-kind** | 4 cards of the same Role/Rank (any suits) |
| **Flush** | 5 cards of the same Ideology (any rank) |
| **Straight** | 3–5 cards of consecutive Roles (e.g., J + Q + K), any suits |
| **Straight Flush** | 3–5 consecutive Roles, all the same Ideology |
| **Unique Keystone** | The project's designated Keystone card must be slotted |
| **Mixed** | Custom: e.g., "3 Engineers + 2 Lands · Sovereignty" |

Mega-Projects typically combine a pattern requirement with a **Keystone** requirement — the Keystone is the anti-rush gate.

### Rank scoring

Each slotted card contributes points by rank on completion:

| Card | Points |
|---|---|
| Land 2–9 | Face value (2–9) |
| Role 10 (Agitator) | 10 |
| Role J (Scholar) | 11 |
| Role Q (Preacher) | 12 |
| Role K (Engineer) | 13 |
| Role A (Architect) | 14 |
| Keystone | 15 |

**Completion tier thresholds:**

| Total score | Tier | Legacy reward |
|---|---|---|
| ≤ 40 | Bronze | 1 Legacy candidate |
| 41–70 | Silver | 2 Legacy candidates |
| 71–100 | Gold | 3 Legacy candidates, +1 upgrade option per card |
| > 100 | Platinum | 3 Legacy candidates, +1 bonus Monument modifier |

### Slotted-card passives

A slotted card isn't inert — it whispers a small ongoing effect. Examples:

- Slotted **Preacher · Solidarity** → all Solidarity cards played cost −1 Influence
- Slotted **Engineer · any** → Lands produce +1 Material when played
- Slotted **Land · Heritage · 6+** → at end phase, remove 1 Dissent card from discard
- Slotted **Architect · [suit]** → one other slotted card in the same project counts as +1 rank for scoring

Since ideology is board-state-derived, slotted cards also **add their rank to their suit's axis count** — slotting a Heritage Q pushes axis2 toward Heritage by 12. This means Mega-Project construction itself reshapes ideology.

This makes a half-built project feel like a growing engine.

### Pattern matching

- A slotted card contributes to **every pattern in its project** simultaneously. A Preacher · Solidarity in The Commune counts toward the Solidarity flush AND any Preacher-based short-term task AND any `axis1 <= −X` gate.
- A slotted card is **locked to its project** — it does not count toward any *other* project's patterns.
- **Short-term tasks (§11) span projects**: a pair slotted across two different projects counts for the "First Pair" task.

### Commitment rules

- A slotted card is **locked to that project**. It cannot be used elsewhere.
- If the project is abandoned (Epoch ends without completion), slotted cards are **lost** (not returned).
- **Unslot cost:** pay 2 Influence *and* shuffle 1 Quiet Dissent into deck. Reserved as a rare escape hatch for strategic pivots.

### Keystone acquisition

Keystones are gated to prevent rushing:

- Materials-only purchase (typically 12 Materials).
- May require an ideology-axis gate matching the project's primary suit (e.g., `axis1 <= −8` for a Solidarity-keyed Keystone).
- May require a short-term task to be completed first (e.g., "First Pair" unlocks the Keystone market slot).

---

## 11. Short-Term Tasks

Tasks are the mid-layer between "play a card" and "complete a Mega-Project." They give turn-by-turn direction.

### Task structure

- Revealed **at Epoch start** (so they are plannable).
- **3–5 per Epoch**, drawn from the Setting's `shortTermTasks` pool.
- **Optional**, one-shot. Each task is completable at most once per Epoch.
- Reward is claimed immediately on completion.

### Canonical task catalog

| Task | Trigger | Base reward |
|---|---|---|
| **First Pair** | Slot 2 cards of the same Role/Rank (any project) | +3 Materials |
| **Three of a Kind** | Slot 3 cards of the same Role/Rank | Free acquisition from market |
| **Two Pair** | Slot two separate Pairs | +1 baseline Influence for rest of Epoch |
| **Flush-in-Progress** | Slot 4 cards of the same Ideology (across projects) | Next Keystone costs 50% less |
| **Safekeeping** | Slot 5 cards total (across projects) | Unlock a bonus Legacy Card slot at Epoch end |
| **Commission** | Acquire a rank-8+ Land | +2 Materials/turn permanently |
| **Recruitment** | Acquire 2 Role cards from market | Draw +1 next turn |
| **Purification** | Purge 2 Dissent cards | Gain 1 Heritage threshold boost (+0.1 vector) |
| **Manifesto** | Reach `\|axis\| >= 6` on any non-Heritage axis | Reveal an exclusive card in the market |

### Rank-scaled bonuses

High-rank slotted cards in task-completing patterns yield bonuses:

- Pair with A+A → reward doubled
- Three of a Kind with K+K+K → reward doubled + free Keystone appearance in market
- Flush using Heritage suit → +1 Heritage axis boost

---

## 12. Dissent System

Dissent is the pressure mechanic. It clogs the deck and can end an Epoch.

### Three variants

| Card | Influence cost | Effect | Slot value |
|---|---|---|---|
| **Quiet Dissent** | unplayable | Occupies hand slot. No effect. | None |
| **Ideological Backlash · [Suit]** | unplayable | Occupies hand slot. While in hand at end of turn, adds +1 rank to the opposing suit's axis count (pushing ideology against the player). | None |
| **Unrest** | unplayable | When drawn, shuffle 1 Quiet Dissent into deck. | None |

Dissent cards cannot be played, slotted, or banished by normal means.

### Generation sources

1. **Opposed slotting.** Slotting a card into a Mega-Project generates 1 **Ideological Backlash · [opposite of slotted card's suit]** if, at the moment of slotting, the card's suit is on the *inferior* side of an active axis. The rule is countable: if axis1 = +7 (Sovereignty dominant, active) and you slot a Solidarity card, it generates 1 Backlash · Sovereignty.
2. **Card-specific effects.** Some powerful cards trade raw power for Dissent:
   - *The Zealot* (variant of Preacher · Transformation): +1 extra rank contribution to axis2 when played, adds 1 Quiet Dissent to deck.
   - *The Demagogue* (Agitator · Sovereignty): +2 Influence on play, adds 1 Ideological Backlash · Solidarity.
   - *The Apostle* (Keystone): see §6.
3. **Scarred-terrain retaliation.** At Epoch start, each scarred suit (terrain offset pushing against its side) adds 1 Ideological Backlash · [scarred suit] per 2 points of scarring (min 1, max 3). See §9.
4. **Unslot cost.** Per §10, unslotting a card adds 1 Quiet Dissent.

### Purging

- **Heritage cards.** Several Heritage cards (e.g., *The Chronicler* Q, *The Reliquary* Land 5) explicitly remove Dissent on play or as a tableau passive.
- **Purge market slot.** Costs 5 Materials, removes 1 Dissent card of player's choice.
- **Task rewards.** *Purification* task (§11) removes 2 Dissent.

### Loss trigger

When Dissent cards make up **more than 50% of the current deck** (hand + draw + discard), the Epoch ends immediately in loss. The loss mode is reported as *"The Populace Turned"* for flavor.

---

## 13. Legacy System

Legacy is the meta-progression layer. Every Epoch ends with the player minting Legacy Cards, updating Monuments, and reshaping the planet's ideology terrain.

### Legacy Card minting

**On win:**
- **1 Mega-Project Legacy** (guaranteed) — minted from a template tied to the completed project's theme. Example: completing the Ark → *The Navigator's Logbook* Legacy candidate.
- **1–3 Played-Card Legacies** — the engine picks candidates from your most-played cards (or most-impactful, by simple metric: plays + slots + effect weight). Tier count scales with completion score (§10 Mega-Project table).

**On loss:**
- **1–2 Consolation Legacies** — candidates are pulled from a pool themed by your loss mode:
  - *Populace Turned* (Dissent overflow) → Heretic/Iconoclast-themed cards
  - *Starved Out* (soft turn limit, no completion) → Scarcity/Rationing-themed cards

### Upgrade paths

For **each** minted Legacy Card, the player chooses **1 of 3 upgrade paths** before the next Epoch begins:

| Path | Effect |
|---|---|
| **Potency** | The card's primary effect is strengthened (e.g., draw +1 → draw +2; +1 Influence → +2 Influence). |
| **Pliability** | Influence cost reduced by 1, OR the card gains a **wild pip** that counts as any suit when slotted. |
| **Persistence** | Adds a passive effect active while in hand or in the starting tableau (e.g., "+1 Material/turn while this is in your opening hand"). |

Legacy Cards enter the starter deck of the next Epoch.

### Monuments

A completed Mega-Project leaves a **Monument** on the Campaign. Monuments:

- Display in the Legacy sidebar as icons with their Mega-Project name and completion tier.
- **Apply ideology terrain modifiers** (see below).
- **Cap at 3–4 active** per Campaign. Oldest is evicted (FIFO) when full, but an Echo is preserved for narrative.
- Can **gate or unlock** Mega-Projects in future Settings (e.g., Monument of The Ark → Generation Ship Mega-Projects reference it).

### Ideology terrain

A 2-axis data structure (`terrain: { axis1, axis2 }`) persisted on the Campaign, each an integer. Matches the shape of the ideology vector itself.

- **Terrain is a pre-load**: next Epoch's starting `axis1` and `axis2` begin at the terrain values (before any cards are placed). A terrain of `{ axis1: -5, axis2: 0 }` means Solidarity is already halfway to its gate threshold at start.
- **Settled vs. scarred** is defined per side:
  - A terrain pushing an axis toward a *preferred* side is **settled** for that side. Cards of that side cost −1 Material in market (historically dominant ideology is cheap).
  - A terrain pushing against a side is **scarred** for that side. Scarred-side cards may cost +1 Material, and at Epoch start scarred-terrain generates Backlash Dissent (see §9 and §12).
- **Monuments apply offsets**: a Gold-tier Monument of primary suit `X` adds a signed offset of ±5 to the appropriate axis (magnitude scales with completion tier). A Solidarity Gold Monument → axis1 terrain += −5 (pushing Solidarity further).
- **Losses apply offsets**: *Populace Turned* during Solidarity dominance adds +3 to axis1 terrain (scarred for Solidarity — the commoners are wounded).
- **Eviction**: when Monuments exceed the cap (3–4 per Campaign), the oldest is evicted but its terrain offset persists (permanent scar).

This is the **snowball brake**: repeated same-side wins accumulate terrain in that direction, meaning future Epochs start with that axis already near gate threshold. The market choking on opposed Backlash and the scarcity of opposed suits make continued same-side play **less interesting**, incentivizing divergence to experience new flavor.

### Legacy sidebar (UI)

Layout sketch:

```
┌───────────────────────────────┐
│  IDEOLOGY (this Epoch)        │
│   axis1: −7  (The Collective) │
│   axis2: +3  (drifting Asc.)  │
├───────────────────────────────┤
│  MONUMENTS (3/4)              │
│  ─ The Ark (Gold) · Ep 3      │
│  ─ The Commune (Silver) · Ep5 │
│  ─ The Cathedral (Bronze) · 8 │
├───────────────────────────────┤
│  TERRAIN (offset at Epoch st) │
│   axis1: −5  (Sol. settled)   │
│   axis2: +2                   │
├───────────────────────────────┤
│  LEGACY CARDS (7)             │
│  ─ Navigator's Logbook (Ep3)  │
│  ─ The Mediator+ (Ep5)        │
│  ─ ...                        │
└───────────────────────────────┘
```

Abstract; no map required. Fits in a right-panel sidebar during play and expands to a full page between Epochs.

---

## 14. Setting System

### Setting config schema

A Setting is a data object. Static for now; procedural generation is a stretch goal.

```ts
interface Setting {
  id: string;
  name: string;
  description: string;
  flavorText: string;

  rules: {
    handSize: number;                 // typical: 5 (Homeworld), 4 (Ship)
    tableauSlots: number;             // typical: 4 (Homeworld), 2 (Ship)
    influenceBaseline: number;        // default 2
    materialsPerLandBase: number;     // default 1
    deckStartMinSize: number;         // default 10
    softTurnLimit: number;            // default 18
    dissentLossThreshold: number;     // default 0.5
    landAcquisitionAllowed: boolean;  // false on Ship
  };

  startingDeck: CardRef[];            // 10–12 cards
  startingTableau: CardRef[];         // Lands pre-placed on field
  marketPool: CardRef[];              // which cards from the 54 are available this Setting
  keystones: [KeystoneRef, KeystoneRef];  // the 2 jokers

  megaProjects: MegaProject[];        // exactly 3
  shortTermTasks: TaskDef[];          // pool of 5–8, 3–5 selected per Epoch
  exclusiveCardPools?: {              // unlocked by axis threshold
    [thresholdKey: string]: CardRef[];
    // key format: "axis1<=-6", "axis2>=+10", etc.
  };

  transitions: {
    onWin: { [megaProjectId: string]: SettingRef | 'campaign-end' };
    onLoss: SettingRef | 'campaign-end';
  };
}
```

### Homeworld as the balancing anchor

Homeworld's values are the reference point. Every other Setting is defined as a deviation:

| Setting | Changes from Homeworld |
|---|---|
| **Generation Ship** | `handSize: 4, tableauSlots: 2, landAcquisitionAllowed: false, softTurnLimit: 14` |
| **Ruined Homeworld** (loss branch) | `dissentLossThreshold: 0.4, startingTableau: [ruined lands + 1 Dissent], softTurnLimit: 15` |
| **Flourishing Commune** (win branch) | `tableauSlots: 5, exclusiveCardPools: { 'axis1<=-6': [Keepers cards], 'axis2<=-6': [Keepers cards] }, softTurnLimit: 20` |
| **Industrial Dominion** (win branch) | `influenceBaseline: 3, terrain preload forces axis1 start at +3` |

### Market filtering

Each Setting's `marketPool` filters the 54-card pool. Examples:

- **Generation Ship** excludes all Land 8–9 (no room for grand structures in transit).
- **Ruined Homeworld** excludes Architect (A) role cards (the visionaries are gone), includes extra Dissent-purge cards.
- **Flourishing Commune** includes a bonus Commune-exclusive Land tier (Capital variants with +1 Material).

### Transitions

Each Mega-Project's `onWin` links to a specific next Setting. A Setting's `onLoss` links to a single next Setting (or campaign end). Transitions are specified in `Setting.transitions`, allowing the same Setting definition to be reused at multiple points in a campaign tree.

---

## 15. Campaign Structure

A Campaign is a directed graph of Settings traversed by Epochs.

### Example Homeworld campaign tree

```
                              Homeworld
                        ┌─────────┼─────────┐
                 (Ark)  │  (Commune)│ (Reactor)    (loss)│
                        ▼          ▼          ▼          ▼
              Generation Ship  Flourish.   Industrial  Ruined
                   │            Commune    Dominion   Homeworld
              ┌────┼────┐        │          │           │
            (Nav)(Mut)(Bre)     ...        ...        ...
              │   │    │
              ▼   ▼    ▼
           Arrival  Dere.  Lost-in-Void
            (term   (term  (term loss)
             win)   loss)
```

- **Convergent nodes** are allowed: e.g., a path from Industrial Dominion's *Commune Revolt* loss could converge onto *Second Homeworld*, which is also reachable from Ruined Homeworld's *Reclaimed* win.
- **Terminal Settings** end the Campaign. Terminal win Settings are celebratory capstones; terminal loss Settings are defined dead-ends.
- **Depth:** typical campaigns are 3–5 Settings deep (5–15 Epochs over the campaign), though trees can be configured longer.

### Campaign state persisted

Between Epochs, the Campaign holds:
- Current Setting reference
- Legacy Cards collection
- Monuments list (with FIFO eviction and Echoes)
- Terrain offsets (axis1, axis2)
- Ideology terrain
- Epoch history (for audit trail / narrative retrospective)
- Seed (for deterministic replays)

### Campaign configuration

Campaigns are authored as a collection of Setting definitions plus a root Setting. No additional "campaign tree" object is needed — the tree is implicit via `Setting.transitions`.

Future procedural generation would produce `Setting[]` and a root choice, but that's deferred.

---

## 16. Homeworld Epoch 1 — Full Specification

This is the reference Setting. It is fully specified so we can prototype against it.

### Rules

```
handSize: 5
tableauSlots: 4
influenceBaseline: 2
materialsPerLandBase: 1
deckStartMinSize: 10
softTurnLimit: 18
dissentLossThreshold: 0.5
landAcquisitionAllowed: true
```

### Starter deck (10 cards)

| # | Card | InfCost | Effect |
|---|---|---|---|
| 1 | Land · Solidarity · 2 (Commons) | 0 | Tableau: +1 Material/turn. Hand: unplayable; slot only. |
| 2 | Land · Sovereignty · 2 (Outpost) | 0 | Tableau: +1 Material/turn. |
| 3 | Land · Transformation · 2 (Lab) | 0 | Tableau: +1 Material/turn. |
| 4 | Land · Heritage · 2 (Shrine) | 0 | Tableau: +1 Material/turn; remove 1 Dissent every 4 turns. |
| 5 | Land · Solidarity · 3 (Hearth) | 0 | Tableau: +1 Material/turn. Plays into Solidarity stack. |
| 6 | Land · Sovereignty · 3 (Watchtower) | 0 | Tableau: +1 Material/turn; first Dissent added per turn is suppressed. |
| 7 | Land · Transformation · 3 (Workshop) | 0 | Tableau: +1 Material/turn; Engineer cards cost -1 Influence. |
| 8 | Land · Heritage · 3 (Chapel) | 0 | Tableau: +1 Material/turn; Heritage cards cost -1 Influence. |
| 9 | Agitator · Solidarity · 10 (The Organizer) | 1 | +1 Influence on play. |
| 10 | Agitator · Sovereignty · 10 (The Demagogue) | 1 | +2 Influence on play; adds 1 Ideological Backlash · Solidarity. |

Lands played from hand go onto a tableau stack (new stack if a slot is free; else top of an existing stack, max 3 per stack — see §6). Ideology drift happens automatically as Lands settle on the board — no per-card drift value needed.

### Starter tableau (2 Lands pre-placed)

| Card | Effect |
|---|---|
| **Founding Stone · Heritage · 4** (Archive) | +1 Material/turn. Heritage cards cost −1 Influence. Thematic anchor. |
| **The Commons · Solidarity · 4** (Plaza) | +1 Material/turn. On slotting a Solidarity card, +1 Influence this turn. |

**2 tableau slots remain open.**

### Ideology at Epoch start

No terrain inheritance for a fresh Campaign: `axis1 = 0, axis2 = 0` before cards are placed. After placing the starter tableau (Founding Stone · Heritage · 4 + The Commons · Solidarity · 4), the starting vector is:
- `axis1 = 0 − 4 = −4` (Solidarity leaning; active)
- `axis2 = 0 − 4 = −4` (Heritage leaning; active)

Demonym display: dual-active, leaning **The Collective** + **The Keepers** at start. Early plays will push it further one way or the other.

### Mega-Projects (3)

#### The Ark (Transformation straight-flush + Keystone)

- **Slot pattern:** Scholar + Engineer + Architect, all Transformation + 2 Lands · Transformation (any rank) + **The Navigator's Compass** (Keystone).
- **Keystone gate:** `axis2 >= +8`, 12 Materials.
- **Monument effect:** terrain `axis2 += +5` (Gold = +7); unlocks Generation Ship Setting.
- **Transition:** `onWin → generation-ship`.

#### The Commune (Solidarity flush + Keystone)

- **Slot pattern:** 5 Solidarity cards (any role/rank mix, including Lands) + **The Founding Charter** (Keystone).
- **Keystone gate:** `axis1 <= −8`, 12 Materials.
- **Monument effect:** terrain `axis1 += −5` (Gold = −7); unlocks Flourishing Commune Setting.
- **Transition:** `onWin → flourishing-commune`.

#### The Reactor (Sovereignty mixed + Keystone)

- **Slot pattern:** 3 Engineers (any suit, at least 2 Sovereignty) + 2 Lands · Sovereignty (rank 5+) + **Critical Mass** (Keystone).
- **Keystone gate:** `axis1 >= +8`, 12 Materials.
- **Monument effect:** terrain `axis1 += +5` (scarring Solidarity); unlocks Industrial Dominion Setting.
- **Transition:** `onWin → industrial-dominion`.

### Keystones (2, available via the Keystone market slot)

- **The Pioneer** — wild role, wild suit. InfCost 3. On play: draw 2. On slot: counts as any role + any suit (no ideology rank contribution — it's a wild). No Dissent.
- **The Apostle** — wild role, wild suit. InfCost 2. On play: +2 Influence. On slot: counts as any role + any suit AND adds +3 rank to whichever side's axis is currently dominant. Adds 1 Unrest to deck.

Neither is a Mega-Project-specific Keystone (those are separate cards above). These two live in the general Keystone market slot.

### Short-term tasks (pool of 7, 4 revealed per Epoch)

- First Pair, Three of a Kind, Two Pair, Flush-in-Progress, Safekeeping, Commission, Recruitment (per §11).

### Market pool

All 54 cards are available in Homeworld's market pool (full-deck), with the exception that **The Navigator's Compass**, **The Founding Charter**, and **Critical Mass** appear only in the Keystone market slot after their gates are met.

### Transitions

```
onWin:
  the-ark       → generation-ship
  the-commune   → flourishing-commune
  the-reactor   → industrial-dominion
onLoss:
  → ruined-homeworld
```

---

## 17. Data Schemas

TypeScript shapes. Non-executable reference; actual implementation refines these during prototype.

```ts
// --- Core taxonomy ---

type Ideology = 'solidarity' | 'sovereignty' | 'transformation' | 'heritage';

type Role = 'agitator' | 'scholar' | 'preacher' | 'engineer' | 'architect';

type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
// 2–9: Lands. 10: Agitator. 11: Scholar. 12: Preacher. 13: Engineer. 14: Architect. 15: Keystone.

type CardKind = 'land' | 'role' | 'keystone' | 'dissent' | 'legacy';

interface Card {
  id: string;
  name: string;
  kind: CardKind;
  rank: Rank;
  ideology: Ideology | 'wild';       // wild = keystone
  role?: Role;                        // present on role cards
  influenceCost: number;
  effect: EffectSpec;                 // machine-readable effect
  slotPassive?: EffectSpec;           // while slotted in a Mega-Project
  marketCost: number;
  tags: CardTag[];
}

type CardTag = 'dissent' | 'keystone' | 'legacy' | 'exclusive' | 'purge';

// --- Ideology vector (derived, not stored) ---

interface IdeologyVector {
  axis1: number;   // integer: positive = Sovereignty, negative = Solidarity
  axis2: number;   // integer: positive = Transformation, negative = Heritage
}

interface IdeologyTerrain {
  axis1: number;   // integer offset pre-loaded at Epoch start
  axis2: number;
}

// Derivation helper:
//   axis1 = rankSum(Sovereignty on board) - rankSum(Solidarity on board) + terrain.axis1
//   axis2 = rankSum(Transformation on board) - rankSum(Heritage on board) + terrain.axis2
// `board` = all Lands in tableau stacks + all slotted cards across projects.

// --- Mega-Projects ---

type SlotPattern =
  | { type: 'four-of-a-kind'; role: Role; count: 4 }
  | { type: 'flush'; ideology: Ideology; count: number }
  | { type: 'straight'; roles: Role[] }                   // ordered
  | { type: 'straight-flush'; roles: Role[]; ideology: Ideology }
  | { type: 'mixed'; requirements: SlotRequirement[] }
  | { type: 'unique-keystone'; keystoneId: string };

interface SlotRequirement {
  description: string;
  predicate: SerializablePredicate;
  count: number;
}

type SerializablePredicate =
  | { kind: 'suit'; ideology: Ideology }
  | { kind: 'role'; role: Role }
  | { kind: 'rank'; min?: number; max?: number }
  | { kind: 'land' }
  | { kind: 'and'; predicates: SerializablePredicate[] }
  | { kind: 'or'; predicates: SerializablePredicate[] };

type KeystoneGate =
  | { axis: 'axis1' | 'axis2'; direction: 'positive' | 'negative'; min: number }   // |axis| >= min in direction
  | { task: string };                                                                // short-term task completed

interface MegaProject {
  id: string;
  name: string;
  description: string;
  primaryAxis: 'axis1' | 'axis2';
  primaryDirection: 'positive' | 'negative';
  patterns: SlotPattern[];              // ALL must be satisfied to complete
  keystoneId?: string;                  // optional Keystone requirement
  keystoneGates?: KeystoneGate[];       // AND'd together
  monumentEffect: { terrainDelta: Partial<IdeologyTerrain> };
  slottedPassives: EffectSpec[];        // applied per slotted card matching tag
}

// --- Short-term tasks ---

type TaskPredicate =
  | { kind: 'slot-pair' }                           // 2 same-rank
  | { kind: 'slot-three-of-a-kind' }
  | { kind: 'slot-two-pair' }
  | { kind: 'slot-flush'; ideology?: Ideology; count: number }
  | { kind: 'slot-total'; count: number }
  | { kind: 'acquire-rank'; min: number }
  | { kind: 'acquire-role'; count: number }
  | { kind: 'axis-reach'; axis: 'axis1' | 'axis2'; min: number }
  | { kind: 'purge-dissent'; count: number };

interface TaskDef {
  id: string;
  name: string;
  description: string;
  predicate: TaskPredicate;
  reward: EffectSpec;
  rankScaling?: 'doubled' | 'bonusOnHigh';
}

// --- Settings ---

interface Setting {
  id: string;
  name: string;
  description: string;
  flavorText: string;

  rules: SettingRules;
  startingDeck: CardRef[];
  startingTableau: CardRef[];
  marketPool: CardRef[];
  keystones: [CardRef, CardRef];

  megaProjects: MegaProject[];
  shortTermTasks: TaskDef[];
  exclusiveCardPools?: Array<{
    gate: KeystoneGate;
    cards: CardRef[];
  }>;

  transitions: {
    onWin: Record<string, SettingRef | 'campaign-end'>;
    onLoss: SettingRef | 'campaign-end';
  };
}

interface SettingRules {
  handSize: number;
  tableauSlots: number;
  influenceBaseline: number;
  materialsPerLandBase: number;
  deckStartMinSize: number;
  softTurnLimit: number;
  dissentLossThreshold: number;
  landAcquisitionAllowed: boolean;
}

// --- Runtime state ---

interface Epoch {
  settingId: string;
  turn: number;
  hand: Card[];
  draw: Card[];
  discard: Card[];
  tableauStacks: Card[][];                       // array of stacks; length = tableauSlots, each up to 3 Lands
  projectSlots: Record<string, SlottedCard[]>;   // by megaProjectId
  market: MarketState;
  influence: number;
  materials: number;
  // ideologyVector is DERIVED per tick from tableauStacks + projectSlots + campaign.terrain
  // not stored on Epoch
  taskProgress: Record<string, TaskProgressState>;
  endOfTurnQueue: EffectSpec[];                  // effects deferred to end phase
}

interface SlottedCard {
  card: Card;
  slottedAtTurn: number;
}

interface MarketState {
  river: (Card | null)[];               // length = 5
  keystoneSlot: Card | null;
  purgeSlot: Card | null;
  bannedThisEpoch: string[];
}

// --- Campaign (persistent) ---

interface Campaign {
  id: string;
  seed: number;
  currentSettingId: string;
  legacyCards: LegacyCard[];
  monuments: Monument[];                // max 3–4 active, plus Echoes
  terrain: IdeologyTerrain;             // axis1, axis2 integer offsets
  epochHistory: EpochResult[];
}

interface Monument {
  id: string;
  megaProjectId: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  mintedOnEpoch: number;
  terrainDelta: Partial<IdeologyTerrain>;
  active: boolean;                      // false = Echo
}

interface LegacyCard extends Card {
  baseCardId: string;                   // source card from original pool
  upgradePath: 'potency' | 'pliability' | 'persistence';
  mintedOnEpoch: number;
  mintedFrom: 'mega-project' | 'played' | 'consolation';
}

interface EpochResult {
  epochNumber: number;
  settingId: string;
  outcome: 'win' | 'loss';
  completedProjectId?: string;
  completionTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  lossMode?: 'populace-turned' | 'starved-out';
  mintedLegacyIds: string[];
  finalIdeology: IdeologyVector;
}

// --- Effects (serializable DSL) ---
// Timing is fixed per effect kind: immediate (resolve on play) vs. end-of-turn (queue, resolve at step 5).

type EffectSpec =
  | { kind: 'gainInfluence'; amount: number; timing: 'immediate' }
  | { kind: 'gainMaterials'; amount: number; timing: 'immediate' }
  | { kind: 'draw'; count: number; timing: 'immediate' }
  | { kind: 'addDissent'; variant: 'quiet' | 'backlash' | 'unrest'; ideology?: Ideology; amount: number; timing: 'end-of-turn' }
  | { kind: 'removeDissent'; amount: number; timing: 'immediate' }
  | { kind: 'slotAnyInto'; projectId: string; costReduction?: number; timing: 'immediate' }
  | { kind: 'discount'; predicate: SerializablePredicate; amount: number; timing: 'end-of-turn' }
  | { kind: 'compound'; effects: EffectSpec[] };
```

Helper refs:

```ts
type CardRef = string;         // Card.id
type SettingRef = string;      // Setting.id
type KeystoneRef = CardRef;
```

---

## 18. Win & Loss Conditions

### Epoch win

- **Trigger:** A Mega-Project's slot patterns and Keystone requirements are all satisfied.
- **Resolution:** Monument minted. Completion tier calculated. Legacy Cards minted. Transition to `onWin[completedProjectId]`.

### Epoch loss

Two loss modes, checked at each end phase:

1. **Populace Turned** — Dissent cards exceed `dissentLossThreshold` (default 0.5) of total deck. Loss mode tagged for consolation Legacy theming.
2. **Starved Out** — `softTurnLimit` reached without any Mega-Project completion. Not a hard game-over: player may optionally play 2 more turns at a penalty (+1 Dissent per turn) before being force-ended.

### Campaign end

- **Terminal Win Setting reached:** Campaign marked as won. Planet narrative concludes. Player can start a new planet.
- **Terminal Loss Setting reached:** Campaign marked as lost. Option to restart from last stable Setting with reduced Legacy (reservation of a permadeath mode as a toggle).
- **All Mega-Project paths exhausted without progress:** fallback terminal loss (edge case, should not occur with well-formed Setting trees).

---

## 19. Open Questions / Deferred

The spec codifies design. The following are explicitly deferred to prototyping or later design rounds.

### Deferred to prototyping

- **Specific balance numbers** — most costs, axis thresholds, and Monument terrain offsets are starting anchors. Real values emerge from playtesting.
- **Full effect text for all 54 cards** — representative effects are specified; full enumeration is a data task post-P1.
- **Market shuffle variance** — how much is too much? (may need caps on rare-card frequency)
- **AI behavior** — we're abandoning the Monte Carlo harness. Playtesting is human-driven; a much simpler deterministic scripted runner may aid balance but is not a core system.

### Deferred to later design

- **Full Setting catalog** — only Homeworld is fully specified. Generation Ship, Ruined Homeworld, Flourishing Commune, and Industrial Dominion are stubbed and need equivalent detail.
- **Named emergent pools** — beyond Keepers, other axis-threshold-triggered exclusive card pools (e.g., a "Zealots" pool at extreme Transformation) are possible but not yet defined.
- **Procedural Setting generation** — configurable schema supports static only; generator is a stretch goal.
- **Multiplayer / asymmetric AI opponents** — single-player only. Potentially reconsider once solo loop is validated.
- **Card upgrade outside of Legacy** — no mid-Epoch upgrades yet. Deferred.
- **Narrative copy and event text** — flavor strings are placeholder; a narrative pass comes post-prototype.

### UX/UI open

- Sidebar layout is sketched (§13) but not wireframed.
- Tableau visualization, project zone layout, hand rendering, market river — all deferred to UI phase (P7).
- Animations, card-reveal beats, sound design — post-MVP.

### Flavor references

Name candidates can draw from the abandoned mechanics' data files (read-only):

- `src/core/data/factionNames.ts` — ideology-based faction naming
- `src/core/data/projects.ts` — project names and flavor
- `src/core/data/buildings.ts` — Land naming
- `src/core/data/events.ts` — event/task flavor

These provide thematic grounding without importing mechanics.

---

## 20. Implementation Phases

Post-spec roadmap. All phases are on the current branch or follow-up branches; no simulation harness carries over.

### P1 — Core types + Homeworld data (no UI)

Goal: a typed, inspectable representation of a Homeworld Epoch.

- TypeScript types from §17 in `src/core/models/`
- Hardcoded Homeworld Setting data in `src/core/data/` (new file, replacing old content)
- Card pool definitions for all 54 cards (effects may be stubs)
- Unit tests for card identity, slot-pattern matching

### P2 — Turn loop (headless)

- Epoch state machine: draw → main → upkeep → acquire → end
- Card play with Influence spend and ideology modifiers
- Slotting mechanics with commitment, passives, unslot
- Market river with refresh + banish
- Tests via headless API calls (no UI)

### P3 — Mega-Projects + win

- Pattern matchers (four-of-a-kind, flush, straight, straight-flush, mixed, unique-keystone)
- Completion tier scoring
- Win trigger and clean-state reset

### P4 — Dissent + loss

- All three Dissent variants as deck-clog cards
- Generation sources (opposed slotting, card-specific effects, Revanchist retaliation)
- Purge mechanisms (Heritage, purge slot, task)
- Loss condition: >50% Dissent

### P5 — Short-term tasks + axis exclusives + terrain

- Task definitions, predicates, reward resolution
- Axis threshold unlocks for exclusive market cards and Keystone variants
- Terrain offset application at Epoch start (Backlash Dissent generation, market blocking for scarred suits)

### P6 — Settings + single-branch transition

- Setting config loader
- One Setting transition wired: Homeworld → Generation Ship via The Ark
- Generation Ship's config (stub → full)

### P7 — Legacy + campaign tree

- Legacy Card minting (Mega-Project + played + consolation)
- Upgrade path selection UI data model
- Monument lifecycle (FIFO eviction, Echoes)
- Ideology terrain application
- Full campaign tree with all Homeworld branches (win + loss)
- Persistence: save/load Campaign state

### P8 — Vue UI

- Retain the existing `core / renderer / facade` separation principle (it fits this game too)
- Components: Hand, Tableau, Market, Project Zones, Legacy Sidebar, Epoch Transition screen
- GameService-style bridge between core Epoch/Campaign state and reactive Vue state
- Accessibility: keyboard-driven play; color-blind-safe suit markers

### P9 — Playtesting and balance

- No Monte Carlo. Human playtesting.
- A simple scripted runner (pseudo-AI) may aid smoke-testing Setting configs for obvious dead-ends.
- Balance adjustments land as data changes, not code.

### Architecture notes

- The old project's `core / renderer / facade` split is worth preserving: keep game logic in pure TS, have the facade expose `executeCommand` / `checkAffordability`-style entry points, and let Vue consume a reactive snapshot. The underlying systems are entirely new, but the boundary is sound.
- Delete the old `src/core/systems/`, `src/core/balance/`, most of `src/core/data/`, `src/simulation/`, and `src/renderer/components/` during P1–P2. Keep only the shells of `GameState` / `GameService` naming if convenient.

---

## End of spec

This document captures the design as of the latest design pass. Revisions welcome on any section. Once signed off, proceed to P1.




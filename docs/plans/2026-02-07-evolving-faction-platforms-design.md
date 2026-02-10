# Evolving Faction Platforms

## Overview

Replace the static three-faction political system with fluid ideological factions that evolve along continuous axes based on colony conditions. Factions drift in response to crises, milestones, and resource dynamics — becoming barely recognizable by late game. The player influences politics indirectly through colony management, with a few high-cost levers for deliberate nudges.

## Core Design

### Three Ideology Axes

Each faction (and each colonist) holds a position on three independent axes, ranging from -1.0 to +1.0:

| Axis | -1.0 | +1.0 |
|------|------|------|
| **Solidarity** | Individualist (private ownership, competition, meritocracy) | Collectivist (shared resources, mutual aid, equality) |
| **Sovereignty** | Earth-tied (dependence, tradition, loyalty to origin) | Mars-sovereign (self-reliance, independence, new identity) |
| **Transformation** | Preservationist (protect traditions, cautious, conserve) | Revolutionary (remake society, push boundaries, evolve) |

#### Starting Positions

| Faction | Solidarity | Sovereignty | Transformation |
|---------|-----------|-------------|----------------|
| Earth Loyalists | 0.0 | -0.7 | -0.3 |
| Mars Independence | +0.3 | +0.7 | +0.3 |
| Corporate Interests | -0.6 | 0.0 | +0.5 |

#### Emergent Faction Combinations

The axis system creates rich political identities through combination:

- **Mars-sovereign + Preservationist** = Mars nationalism ("we built Mars civilization, now protect it forever")
- **Mars-sovereign + Revolutionary** = Transhumanism ("Mars is where we become something post-human")
- **Earth-tied + Preservationist** = Cultural conservatism ("maintain Earth culture and traditions on Mars")
- **Earth-tied + Revolutionary** = Reform movement ("bring Earth's radical movements here, fix what Earth got wrong")
- **Individualist + Revolutionary** = Frontier libertarianism ("push boundaries, take risks, keep the profits")
- **Collectivist + Preservationist** = Communal heritage ("protect what we've built together")

### Replaces Current Affinity Model

The three axes **replace** the current per-colonist faction affinities (`earthLoyalist`, `marsIndependence`, `corporateInterests`). Instead of "how much do I like each faction," each colonist holds axis positions representing "where do I stand on these issues." Faction membership becomes "which faction's current axis position am I closest to." Conviction remains unchanged.

## Drift Mechanics

### Pressure Accumulation

Each axis tracks a `pressure` value (-1.0 to +1.0) separate from the faction's actual `position`. Colony conditions add to pressure each sol. When pressure and position diverge, the position drifts toward the pressure — slowly, dampened by conviction.

```
pressure += condition_effects_this_sol        (clamped to [-1, 1])
drift = (pressure - position) * DRIFT_RATE * (1 - faction_avg_conviction * 0.6)
position += drift
```

Properties:
- A single event doesn't jerk factions around — pressure has to build
- High-conviction factions resist drift (true believers dig in)
- Sustained conditions create real movement over 50-100 sols
- Removing the pressure lets factions stabilize, not snap back

### Faction-Specific Sensitivity

Not every faction responds equally to the same condition. Each faction has a `sensitivity` modifier per axis per trigger category. Corporate Interests might be more sensitive to resource conditions on the Solidarity axis, while Earth Loyalists react more to communication/supply events on Sovereignty.

### Drift Triggers

#### Solidarity Axis

**Collectivist pressure (+):**
- Resource scarcity (people demand sharing when there isn't enough)
- Housing crises
- High inequality (uneven building access)

**Individualist pressure (-):**
- Resource abundance (people want to keep what they earned)
- Housing surplus
- Successful private-sector projects

#### Sovereignty Axis

**Mars-sovereign pressure (+):**
- Failed Earth supply events (Earth can't be relied on)
- Colony self-sufficiency milestones
- Mars-born generational turnover

**Earth-tied pressure (-):**
- Successful Earth trade/immigration (the relationship works)
- Colony crises (we need help) — unless Earth caused the crisis
- Cultural heritage events

#### Transformation Axis

**Revolutionary pressure (+):**
- Major technological breakthroughs (we can remake ourselves)
- Generational turnover (Mars-born adults taking power)
- Successful radical policy changes
- Failed traditional institutions
- Discovery events (new resources, contact scenarios)

**Preservationist pressure (-):**
- System failures after changes (the new thing broke)
- High mortality/crisis (protect what keeps us alive)
- Long periods of stability (don't fix what isn't broken)
- Loss of Earth contact (preserve what we remember)
- Cultural heritage events (first Mars-born generation asking about Earth)

### Inter-Faction Pressure

If two factions converge on a position, the third faces social pressure toward it. Dominant consensus on an axis pulls outliers.

## Dynamic Project Pool

Instead of 12 hardcoded faction projects, a larger pool of ~25-30 projects exists. Each project has **axis requirements** — minimum or maximum positions a faction must hold to propose it. Any faction that drifts into the right political space can champion that project.

### Example Projects

| Project | Solidarity | Sovereignty | Transformation | Effect |
|---------|-----------|-------------|----------------|--------|
| Universal Housing | >= +0.3 | any | any | Housing complex, morale boost |
| Private Mining Contracts | <= -0.3 | any | any | Materials bonus, inequality |
| Earth Relief Compact | any | <= -0.3 | any | Space Elevator unlock |
| Declaration of Sovereignty | any | >= +0.5 | any | United Mars Station unlock |
| Genetic Adaptation Program | any | any | >= +0.5 | Workforce efficiency, controversy |
| Heritage Archive | any | any | <= -0.3 | Morale stability, conviction boost |
| Transhuman Research Initiative | any | >= +0.3 | >= +0.5 | Tech unlock, faction split risk |
| Mars Nationalism Charter | any | >= +0.5 | <= -0.3 | Immigration restrictions, morale |

### Project Access Rules

- Projects requiring extreme positions (>= +/-0.5) are powerful but rare
- Some projects need two axes aligned — dramatic and uncommon
- A faction can **lose access** to a project if it drifts away from the required region
- Multiple factions can qualify for the same project, creating competition over who champions it

## Player Levers

Three indirect mechanisms. Everything works through the pressure system — no direct axis manipulation.

### 1. Policy Declarations

Spend political capital (materials + colony morale risk) to issue a colony-wide policy that creates sustained pressure on one axis for 30 sols.

Examples:
- "Rationing Protocol" — pushes Solidarity toward Collectivist
- "Open Research Mandate" — pushes Transformation toward Revolutionary

Constraints:
- Only one active policy at a time
- Factions opposed to the policy's direction lose morale and gain conviction (backlash effect)

### 2. Institutional Buildings

Certain buildings passively apply axis pressure while operational:

- **Broadcasting Station** — pulls Sovereignty toward whichever direction the player configures (Earth broadcasts vs Mars identity programming)
- **Academy** — slow Revolutionary pressure (education drives change)
- **Heritage Museum** — slow Preservationist pressure

Indirect — you build infrastructure that shapes the political environment over time.

### 3. Event Choices

When political events fire (crises, milestones, faction disputes), the player's choice determines which direction pressure is applied. A food shortage event might offer:
- "Implement rationing" (Collectivist pressure)
- "Let the market sort it out" (Individualist pressure)

The player doesn't move the axis directly — they choose which pressure the colony experiences.

## Victory Conditions

Capstone megastructures are **axis-gated, not faction-gated**. Any faction can unlock any megastructure if it has drifted to the right ideological position.

| Megastructure | Required Position | Fantasy |
|---------------|-------------------|---------|
| Space Elevator | Sovereignty <= -0.6, any other axis >= +/-0.5 | Deep Earth connection with strong conviction |
| United Mars Station | Sovereignty >= +0.6, any other axis >= +/-0.5 | Independent Mars with a clear social vision |
| Asteroid Mining Platform | Solidarity <= -0.5, Transformation >= +0.5 | Individualist risk-takers pushing boundaries |
| Genesis Vault | Transformation <= -0.6, Solidarity >= +0.5 | Collective preservation of everything that matters |

### Victory Challenge

Holding an extreme position on two axes simultaneously is hard. Colony conditions constantly apply pressure, and crises can knock factions off course. Victory requires:

1. A faction reaching the required extreme positions
2. That faction holding majority council support
3. Proposing and passing the capstone project
4. Building the megastructure

**Late-game tension:** The closer a faction gets to an extreme, the more pressure events try to pull it back toward center. Stability resists revolution. Revolution destabilizes. Maintaining ideological position *is* the final challenge.

## Dynamic Faction Naming

Faction names update when a faction crosses significant axis thresholds. A name table keyed by axis quadrants maps each combination of high/low positions to a faction name.

### Example Name Table

| Starting Faction | Evolved Position | New Name |
|-----------------|-----------------|----------|
| Earth Loyalists | Earth-tied + Collectivist + Preservationist | Terran Heritage Compact |
| Earth Loyalists | Earth-tied + Individualist + Revolutionary | New Earth Vanguard |
| Earth Loyalists | Mars-sovereign + Preservationist | Founders' Covenant |
| Mars Independence | Mars-sovereign + Revolutionary | Ares Ascendancy |
| Mars Independence | Mars-sovereign + Collectivist + Preservationist | Mars People's Front |
| Mars Independence | Individualist + Revolutionary | Red Frontier |
| Corporate Interests | Individualist + Revolutionary | Frontier Syndicate |
| Corporate Interests | Collectivist | Common Futures Initiative |
| Corporate Interests | Preservationist + Individualist | Old Guard Consortium |

When a faction's name changes, a colony event fires: *"Earth Loyalists have reorganized as the Terran Heritage Compact, reflecting their growing commitment to collective preservation."*

With three axes and two thresholds each (moderate at +/-0.3 and extreme at +/-0.6), approximately 20-30 names total across three factions.

## Faction Defection & Convergence

### Colonist Defection

Each colonist's personal axis position is compared to all three factions. If another faction's position is significantly closer (distance difference > 0.3), defection pressure builds. High-conviction colonists defect slower but more dramatically — they bring social network connections with them, potentially flipping a whole cluster of neighbors.

### Faction Convergence

If two factions' axis positions come within ~0.2 on all three axes, they trigger a **merger event**: the smaller faction is absorbed into the larger one, their council seats combine, and a new faction splinters off from unaligned colonists to fill the political vacuum.

### Faction Collapse & Rebirth

If a faction drops below 15% of the population, it collapses. A new faction coalesces from unaligned colonists at whatever axis position has the least representation. The political spectrum naturally fills gaps.

The colony always has three factions, but which three can change entirely.

## Colonist Ideology Integration

### Per-Colonist Axis Positions

Each colonist holds personal positions on all three axes. These are influenced by:

- **Faction membership** — slow drift toward faction's current position
- **Social network** — ideology spreads through relationships (existing mechanic, now on three axes instead of three affinities)
- **Conviction** — high conviction resists drift from both faction and network pressure
- **Imprinting** — new colonists absorb neighbors' axis positions (existing mechanic adapted)

### Faction Membership

A colonist belongs to whichever faction's axis position they are closest to (Euclidean distance in 3D axis space). This is recalculated periodically, making faction membership emergent rather than assigned.

### Council Selection

Unchanged: council seats filled by colonists with highest political influence (centrality x conviction). But council composition now reflects the evolved ideological landscape — a council might be dominated by a faction that looks nothing like it did at game start.

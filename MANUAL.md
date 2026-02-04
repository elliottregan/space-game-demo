# Red Horizon: Mars Colony Survival Guide

Welcome to Mars. You are the administrator of humanity's first permanent settlement on the Red Planet. Your mission: transform a fragile outpost into a thriving, self-sustaining colony. Every decision matters. Every sol counts.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Resources](#resources)
3. [Buildings](#buildings)
4. [Base Grid](#base-grid)
5. [Colony Management](#colony-management)
6. [Workforce & Colonists](#workforce--colonists)
7. [Technology](#technology)
8. [Operations](#operations)
9. [Politics](#politics)
10. [Events](#events)
11. [Victory & Defeat](#victory--defeat)
12. [Strategy Guide](#strategy-guide)

---

## Getting Started

### Your Starting Situation

You begin with:
- **10 colonists** ready to work
- **500 materials** for construction
- **300 food**, **400 oxygen**, **120 water**, **500 power**
- Basic infrastructure to keep your colony alive

Your colonists consume resources every sol (Martian day):
- 0.5 food per colonist
- 0.3 oxygen per colonist
- 0.2 water per colonist

With 10 colonists, you need **5 food, 3 oxygen, and 2 water per sol** just to survive. Your first priority is establishing production to meet these needs.

### First Steps

1. **Build a Basic Farm** (45 materials) - Assign 2 workers to produce 10 food/sol
2. **Build a Water Extractor** (35 materials) on a water deposit - Produces 4 water/sol
3. **Build a Science Station** (60 materials) - Enables research progress (essential!)
4. **Build Solar Panels** (30 materials) as needed for power
5. **Build Habitat Modules** (50 materials) when population grows

---

## Resources

Five resources sustain your colony:

| Resource | Purpose | Starting Amount |
|----------|---------|-----------------|
| **Food** | Colonist survival | 300 |
| **Oxygen** | Colonist survival | 400 |
| **Water** | Colonist survival, farming | 120 |
| **Power** | Building operations | 500 |
| **Materials** | Construction, maintenance, trading | 500 |

### Resource Warnings

- **Low Alert**: Triggers when a resource falls below 20 units
- **Critical**: When food or oxygen reaches 0, your colony faces defeat

Monitor your resource panel constantly. A surplus today can become a crisis tomorrow.

---

## Buildings

Buildings are the backbone of your colony. Each building has:

- **Cost**: One-time materials to construct
- **Construction Time**: Sols to complete
- **Production**: Resources generated per sol
- **Consumption**: Resources used per sol
- **Workers**: Some buildings require assigned colonists

### Building Categories

#### Basic Buildings (No Technology Required)

| Building | Cost | Effect |
|----------|------|--------|
| **Habitat Module** | 50 | Houses 4 colonists, produces oxygen |
| **Solar Panel Array** | 30 | Produces 10 power |
| **Water Extractor** | 35 | Produces 4 water (requires water deposit) |
| **Storage Depot** | 40 | Increases storage capacity |
| **Basic Farm** | 45 | Produces 10 food (requires 2 workers) |
| **Science Station** | 60 | Enables research, 1.0 research/sol (requires 2 workers) |

#### Advanced Buildings (Require Technology)

| Building | Cost | Requires | Effect |
|----------|------|----------|--------|
| **Greenhouse** | 100 | Hydroponics | Produces 25 food |
| **Water Reclaimer** | 60 | Water Recycling | Produces 8 water |
| **Research Lab** | 150 | Habitat Fabrication | 3.0 research/sol (3 workers) |
| **Advanced Habitat** | 120 | Advanced Materials | Houses 8 colonists |
| **Automated Factory** | 200 | Robotics | Produces 15 materials |
| **Mining Station** | 300 | Asteroid Mining | Produces 30 materials (requires deposit) |
| **Nuclear Reactor** | 250 | Nuclear Fission | Produces 100 power |
| **Biolab** | 180 | Genetics | Genetic research |
| **Medical Center** | 200 | Advanced Medicine | Healthcare services |
| **Cryogenic Facility** | 220 | Cryosleep | Colonist preservation |

#### Recreation Buildings (Boost Morale)

| Building | Cost | Morale Boost |
|----------|------|--------------|
| **Common Room** | 60 | +5 per sol |
| **Gymnasium** | 80 | +6 per sol |
| **Hydroponic Garden** | 70 | +4 per sol, produces oxygen |
| **Observatory Dome** | 150 | +8 per sol |

### Building Modes

Toggle building operation modes to balance efficiency and resources:

| Mode | Production | Consumption | Notes |
|------|------------|-------------|-------|
| **Conservation** | 50% | 40% | Use during shortages |
| **Normal** | 100% | 100% | Standard operation |
| **Overdrive** | 150% | 200% | -0.5 morale/sol, 2% breakdown risk |

### Building Maintenance

Buildings degrade over time:
- **Condition decay** begins after Sol 100
- Loses 1% condition every 5 sols
- Below 50% condition: 25% efficiency penalty
- **Maintenance** costs 10% of original build cost
- **Repairs** take 3 sols and cost 25% of build cost

### Recycling

Dismantle buildings you no longer need:
- **Standard recovery**: 40% of materials
- **Depleted building**: 25% of materials
- **Active building**: 50% of materials
- **Damaged building**: 15% of materials

---

## Base Grid

The Base tab displays your colony's physical layout on a 10x10 isometric grid. Here you can see building positions, power connections, and resource deposits.

The header shows a power summary: how many buildings are **powered**, **on battery**, or **unpowered**. Use this to quickly identify power problems.

### The Power Grid

Power distribution is spatial - buildings must be within range of a power source to receive electricity.

**Power Sources:**
- **Solar Panel Array**: 10 power, range of 2 cells
- **Nuclear Reactor**: 100 power, range of 4 cells (requires technology)

Power range is calculated using Manhattan distance (horizontal + vertical cells). A Solar Panel at position (5,5) can power buildings at (5,3), (7,5), (3,5), etc.

### Building Placement

Click an empty cell to see available buildings. The context menu shows:
- **Power status**: Whether the cell has power coverage
- **Deposits**: Water or mineral deposits at that location
- **Recommended buildings**: Highlighted with a star based on context

Buildings that produce power (like Solar Panels) are recommended when placing in unpowered areas. Resource extractors are recommended when placing on deposits.

### Power States

Buildings can be in four power states:

| State | Icon | Meaning |
|-------|------|---------|
| **Powered** | Green | Connected to power source, operating normally |
| **On Battery** | Yellow | Disconnected, running on backup power |
| **Low Battery** | Red | Battery below 33%, shutdown imminent |
| **Unpowered** | Gray | No power, building completely offline |

**Important:** Unpowered buildings produce and consume nothing. Power is binary - a building either has power and operates normally, or has no power and is completely offline. There is no partial efficiency penalty.

### Battery Backup

Every building has a built-in battery that provides backup power when disconnected from a power source:

- **Full charge**: 3 sols of operation
- **Drain rate**: ~33% per sol when disconnected
- **Low battery warning**: Triggers at 33% remaining
- **Recharging**: Instant when reconnected to power

**Critical:** When battery depletes completely, the building becomes **Unpowered** and shuts down entirely - no production, no consumption. This can cascade into resource crises if food or oxygen production goes offline. Always monitor buildings on battery and restore power before they shut down.

### Transit Connections

Colonists can only work at buildings they can physically reach. Transit connections determine which workplaces are accessible from each housing cluster.

#### How Connections Work

Buildings form **clusters** based on adjacency:
- **Habitats are roots**: Each cluster starts from a Habitat Module or Advanced Habitat
- **4-way adjacency**: Buildings connect along grid edges (up, down, left, right)
- **Diagonal doesn't count**: Buildings touching only at corners are not connected

A colonist living in a habitat can work at any building within the same cluster. If a building is not connected to their housing, they cannot be assigned there.

#### Viewing Connections

The Base Grid displays transit connections visually:
- **Connected buildings** show a solid border when selected
- **Disconnected buildings** appear dimmed
- Hover over a habitat to highlight all buildings in its cluster

#### Rover Depot

The **Rover Depot** building extends connectivity beyond simple adjacency:

| Property | Value |
|----------|-------|
| **Cost** | 80 materials |
| **Range** | 3 cells |
| **Effect** | Bridges separate clusters within range |

Place a Rover Depot between distant building groups to connect them. The depot itself does not need to be adjacent to either cluster - it connects all buildings within its range to each other.

#### Disconnection Effects

When a building loses its transit connection (due to demolition or reconfiguration):
- **Workers are immediately unassigned** from that building
- The building continues to operate if it has power
- Automated buildings (no worker requirement) are unaffected

Plan carefully before demolishing buildings that serve as bridges between clusters.

#### Layout Planning Tips

**Keep clusters compact:**
- Build habitats near workplaces to minimize connection chains
- Long chains of buildings are fragile - one demolition breaks the connection

**Use Rover Depots strategically:**
- A single depot can connect multiple isolated clusters
- Place depots centrally to maximize coverage
- Depots are especially valuable for distant Mining Stations

**Plan for growth:**
- Leave space for future connections between clusters
- Consider where new habitats will go before placing production buildings

**Avoid island buildings:**
- An isolated building without transit access is useless for staffing
- Always verify connections before assigning workers

### Strategic Tips

**Power Planning:**
- Place Solar Panels centrally to maximize coverage
- Don't cluster all buildings - spread them to stay within power range
- Build redundant power sources for critical areas
- Prioritize power for life support (Habitats, Farms, Oxygen Generators)
- Watch the header for "on battery" warnings - you have 3 sols to fix it

**Deposit Utilization:**
- Water deposits appear as blue indicators on the grid
- Mineral deposits appear as orange indicators
- Place extractors directly on deposits for production bonuses

**Expansion Strategy:**
- Expand power grid before expanding buildings
- Keep a buffer of power capacity for emergencies
- Consider Nuclear Reactors for large-scale expansion (requires research)

---

## Colony Management

### Population

Your colony starts with 10 colonists. Growth requires:
- Population of at least 20
- Health above 80%
- Morale above 60%

When conditions are met, there's a 2% chance per sol for population growth. Immigration events also bring new colonists (5-8 per event).

**Defeat occurs if population drops below 5.**

### Health

Health represents your colony's physical wellbeing:
- Starts at 100%
- **Food shortage**: -1% per sol
- **Oxygen shortage**: -3% per sol
- **Good morale**: +0.2% per sol
- Below 20% health: 5% death chance per colonist per sol

### Morale

Morale reflects colonist happiness:
- Starts at 80%
- **Natural decay**: -0.3% per sol
- **Base recovery**: +0.5% per sol
- **Recreation buildings**: +4 to +8 per sol
- **Relaxed work policy**: +1 per sol
- **Crunch work policy**: -1 per sol
- **Overdrive buildings**: -0.5 per sol each

Keep morale above 60% to enable population growth.

---

## Workforce & Colonists

### Roles

Colonists can be assigned to five roles:

| Role | Buildings | Description |
|------|-----------|-------------|
| **Unassigned** | None | Consumes resources, no production |
| **Farmer** | Basic Farm, Greenhouse | Food production |
| **Researcher** | Research Lab, Biolab | Technology progress |
| **Engineer** | Mining Station, Nuclear Reactor | Technical operations |
| **Civil Scientist** | Medical Center | Healthcare and admin |

### Training

Switching roles requires training:
- Base training time: 5 sols
- Training time varies by role affinity (3-10 sols)
- Experience resets to 0 when training completes

### Experience & Mastery

Workers gain experience while working (0.5 per sol):

| Mastery Level | Experience | Efficiency |
|---------------|------------|------------|
| **Novice** | 0-24 | 70% |
| **Skilled** | 25-49 | 100% |
| **Expert** | 50-74 | 130% |
| **Master** | 75+ | 160% |

Master-level colonists have a 1% chance per sol to trigger breakthrough events.

### Skills

Colonists spawn with 1-2 random skills:

| Skill | Bonus | Applies To |
|-------|-------|------------|
| **Jury-Rigger** | +15% | Engineering |
| **Green Thumb** | +15% | Farming |
| **Lab Rat** | +15% | Research |
| **People Person** | +15% | Civil Science |
| **Quick Learner** | +5% | All roles |
| **Night Owl** | +5% | All roles |
| **Calm Under Pressure** | +10% | Engineering, Research |
| **Homebody** | +10% | Farming, Civil Science |

### Social Networks

Colonists form social bonds through shared experiences. These relationships affect morale, information flow, and colony cohesion.

#### Relationship Types

| Relationship | How Formed | Bonding Rate |
|--------------|------------|--------------|
| **Coworkers** | Same workplace | Base rate |
| **Housemates** | Same housing | Base rate |
| **Guild Members** | Same guild | +25% faster |
| **Cohort** | Arrived within 10 sols | +50% faster |

Relationships strengthen over time through interaction. Colonists who work together or live together develop bonds that boost morale and productivity.

#### Cohort Effect

Colonists who arrive at the colony within the same 10-sol window form a **cohort**. Cohort members:
- Bond 50% faster with each other
- Start with a 5% initial relationship bonus
- Tend to form tight-knit social groups

Immigration events bring colonists who share this cohort bond, making integration easier.

#### Preferential Attachment

Popular colonists attract more connections. This "rich get richer" dynamic means:
- Colonists with many connections are more likely to form new ones
- Social hubs emerge naturally in your colony
- New colonists are drawn to well-connected individuals

This creates natural social leaders who can influence colony morale.

#### Weak Ties & Bridge Colonists

Not all relationships are equally strong. **Weak ties** (relationships below 30% strength) serve a special purpose:

- Weak ties connect otherwise separate social groups
- **Bridge colonists** span different cliques, spreading information
- Bridge colonists receive small morale bonuses for their social role

Granovetter's "strength of weak ties" theory: weak connections often provide more novel information than strong ones, as they connect you to different social circles.

#### Guilds

Colonists can join formal groups called **guilds**:

| Guild Type | Purpose |
|------------|---------|
| **Professional** | Work-related expertise sharing |
| **Social** | Recreation and friendship |
| **Research** | Scientific collaboration |
| **Civic** | Colony governance and policy |

Guild mechanics:
- Maximum 3 guild memberships per colonist
- Guilds require 2-8 members
- Guild members bond 25% faster
- Shared guild membership provides 8% initial relationship bonus

Guilds create cross-workplace connections, helping information and morale spread across your colony.

#### Viewing Social Networks

The **Colony View** includes a social network graph showing:
- **Nodes**: Colonists (colored by role)
- **Links**: Relationships (colored by type)
- **Badges**: Guild membership count
- **Rings**: Bridge colonist indicator (dashed purple)
- **Line styles**: Solid = strong, dotted = weak tie

Use this visualization to identify social hubs, isolated colonists, and bridge individuals who connect different groups.

---

## Technology

Research unlocks advanced buildings and bonuses. Queue technologies to progress - but **you need research buildings to make progress**.

### Research Buildings

Research progress depends on active, staffed research buildings:

| Building | Research Output | Workers | Requirements |
|----------|-----------------|---------|--------------|
| **Science Station** | 1.0/sol | 2 | None (basic) |
| **Research Lab** | 3.0/sol | 3 | Habitat Fabrication |

**No research buildings = no research progress.** Build a Science Station early to start researching.

Research output is affected by:
- **Staffing**: Understaffed buildings produce less
- **Worker efficiency**: Mastery level and skills affect output
- **Power**: Unpowered buildings produce nothing

Multiple research buildings stack additively. Two fully-staffed Science Stations produce 2.0 research/sol.

### Technology Tree

#### Early Tier (Sol 30-90)

| Technology | Research Time | Unlocks |
|------------|---------------|---------|
| **Hydroponics** | 60 sols | Greenhouse |
| **Water Recycling** | 45 sols | Water Reclaimer, +50% water production |
| **Advanced Materials** | 75 sols | Research Lab, Advanced Habitat |

#### Mid Tier (Sol 90-200)

| Technology | Research Time | Requirements | Unlocks |
|------------|---------------|--------------|---------|
| **Robotics** | 120 sols | Advanced Materials | Automated Factory, 1.2x construction speed |
| **Asteroid Mining** | 150 sols | Advanced Materials, Robotics | Mining Station |
| **Nuclear Fission** | 180 sols | Advanced Materials | Nuclear Reactor |

#### Late Tier (Sol 200-400)

| Technology | Research Time | Requirements | Unlocks |
|------------|---------------|--------------|---------|
| **Genetic Engineering** | 200 sols | Hydroponics | Biolab |
| **Advanced Medicine** | 250 sols | Genetics | Medical Center |
| **Life Extension** | 300 sols | Genetics, Advanced Medicine | Extended colonist lifespan |
| **Cryogenic Sleep** | 250 sols | Advanced Medicine | Cryogenic Facility |

#### Endgame Tier (Sol 400+)

| Technology | Research Time | Requirements | Victory Path |
|------------|---------------|--------------|--------------|
| **Fusion Drive** | 400 sols | Nuclear Fission, Advanced Materials | Generation Ship |
| **Closed Ecosystem** | 350 sols | Hydroponics, Water Recycling, Genetics | Generation Ship |
| **Generation Ship** | 500 sols + 1000 materials | All endgame techs | **VICTORY** |

### Research Tips

- **Build a Science Station immediately** - Without one, research progress is zero
- Assign experienced Researchers for maximum efficiency (Master = 160% output)
- Queue multiple technologies to maintain continuous progress
- Upgrade to Research Labs (3.0/sol) once you unlock Habitat Fabrication
- Multiple research buildings stack - two Science Stations = 2x research speed

---

## Operations

### Colony Policies

Adjust policies to adapt to your colony's situation. Policies can only be changed every 10 sols.

#### Work Intensity

| Policy | Production | Morale | Health |
|--------|------------|--------|--------|
| **Relaxed** | 80% | +1/sol | Normal |
| **Standard** | 100% | Normal | Normal |
| **Crunch** | 120% | -1/sol | -0.5/sol |

#### Resource Priority

| Policy | Production | Effect |
|--------|------------|--------|
| **Stockpile** | 90% | Conservative resource use |
| **Balanced** | 100% | Normal operation |
| **Burn** | 115% | 5% resource decay per sol |

#### Exploration Stance

| Policy | Expedition Cost | Success Modifier |
|--------|-----------------|------------------|
| **Cautious** | 150% | +20% success |
| **Standard** | 100% | Normal |
| **Aggressive** | 75% | -15% success |

### Expeditions

Send crews to explore Mars. Maximum 2 concurrent expeditions.

| Type | Crew | Cost | Duration | Base Success |
|------|------|------|----------|--------------|
| **Survey** | 2 | 20 | 10 sols | 70% |
| **Salvage** | 3 | 30 | 15 sols | 65% |
| **Science** | 2 | 50 | 25 sols | 60% |
| **Deep** | 4 | 100 | 40 sols | 50% |

**Rewards**: Materials, new deposit sites, research bonuses, discoveries
**Risks**: Crew loss, materials lost on failure

### Prospecting & Deposits

Deposits provide resources for extraction buildings:

| Quality | Reserves | Extraction Rate | Bonus |
|---------|----------|-----------------|-------|
| **Poor** | 200-400 | 50% | +10% |
| **Moderate** | 400-800 | 100% | +25% |
| **Rich** | 800-1500 | 150% | +50% |

- **Reveal cost**: 30 materials, 5 sols
- **Development cost**: 50-200 materials (by quality)
- **Maximum**: 3 revealed sites, 5 developed sites
- Deposits deplete over time - monitor warnings at 25% and 10% remaining

---

## Politics

Three factions vie for influence over your colony's future.

### Factions

| Faction | Priority | Key NPCs |
|---------|----------|----------|
| **Earth Loyalists** | Maintain Earth connection, stability | Dr. Chen Wei, Nova Silva, Alex Okonkwo |
| **Mars Independence** | Self-governance, Mars-first policies | Maria Santos, James Liu, Aisha Patel, Marcus Reed |
| **Corporate Interests** | Profit, efficiency, corporate involvement | Elena Volkov, David Morrison, Sarah Chen |

### NPC Support

Each NPC has a support level from -1 (oppose) to +1 (support). NPCs influence each other through faction relationships.

### Projects

Factions propose projects that:
- Cost materials to propose
- Take 10 sols before vote
- Require 40% NPC support to pass
- Unlock buildings, technologies, or resources when approved

### Councils

Form councils to strengthen NPC relationships:
- Cost: 50 materials
- Effect: +0.2 relationship boost between council members
- Permanent benefit

### Lobbying

Spend materials to influence NPCs:
- Cost: 10 materials per 0.1 support boost
- Target specific NPCs for direct influence

### Faction Demands

Factions periodically demand their projects be proposed. Ignoring demands causes support decay.

---

## Events

Random events occur throughout your colony's history, forcing difficult decisions.

### Event Timing

- 30-90 sols minimum between events
- Probability increases over time:
  - Sol 0-50: 2% per sol
  - Sol 50-200: 5% per sol
  - Sol 200-500: 8% per sol
  - Sol 500+: 12% per sol

### Event Types

#### Immigration Events
Bring new colonists to your colony:
- **First Wave Settlers**: 8 colonists
- **Family Reunification**: 3-5 colonists
- **Corporate Workforce Initiative**: 4-8 colonists (political cost)
- **Independence Volunteers**: 3-5 colonists (political benefits)

#### Crisis Events
Test your colony's resilience:
- **Dust Storm Warning**: Power disruption
- **Meteor Strike**: Risk vs. reward decision
- **Disease Outbreak**: Population loss or resource cost
- **Equipment Failure**: Repair costs
- **Colonist Dispute**: Faction politics

#### Resource Events
Windfalls for your colony:
- **Abandoned Supply Cache**: Materials, food, water
- **Earth Supply Ship**: Resources plus political impact
- **Scientific Discovery**: Faction support and resources

---

## Victory & Defeat

### Victory Conditions

#### Colony Charter Victory (Recommended First Victory)
**Timeline**: ~500-800 sols

Requirements:
- Population of at least 30
- Morale above 60%
- Research completed: Hydroponics, Water Recycling, Advanced Materials
- **Maintain all conditions for 200 consecutive sols**

This represents official self-sustaining colony status.

#### Population Victory
Reach 100 colonists. Mars is thriving.

#### Generation Ship Victory (Ultimate Challenge)
**Timeline**: ~2900 sols

Requirements:
- Complete entire endgame technology tier
- Research: Fusion Drive + Cryogenic Sleep + Closed Ecosystem
- Research and build the Generation Ship

This represents humanity's expansion to the stars.

### Defeat Conditions

Your colony falls if:
- **Population drops below 5** - Colony collapse
- **Food reaches 0** - Starvation
- **Oxygen reaches 0** - Suffocation

---

## Strategy Guide

### Early Game (Sol 0-50)

**Priority 1: Food Security**
- Build 2 Basic Farms immediately (90 materials)
- Assign 4 colonists as Farmers
- Production: 20 food/sol, Consumption: 5 food/sol = +15 surplus

**Priority 2: Water & Power**
- Build Water Extractor on a water deposit (35 materials)
- Build Solar Panels as needed (30 materials each)

**Priority 3: Research Infrastructure**
- Build a Science Station (60 materials) - **critical for any research**
- Assign 2 colonists as Researchers
- Without this, technology progress is zero

**Priority 4: Prepare for Growth**
- Build additional Habitat Modules before immigration events
- First immigration typically arrives around Sol 20

### Mid Game (Sol 50-200)

**Research Path**
1. Water Recycling (45 sols) - Efficient water production
2. Hydroponics (60 sols) - Unlock Greenhouses
3. Advanced Materials (75 sols) - Unlock Research Labs

**Colony Growth**
- Target population: 20-30
- Build Recreation buildings to maintain morale
- Establish multiple Research Labs to accelerate tech progress

**Resource Stability**
- Build redundant production (multiple farms, extractors)
- Maintain resource buffers of 100+ units

### Late Game (Sol 200+)

**For Colony Charter Victory:**
- Focus on maintaining stability for 200 sols
- Keep morale above 60%, population above 30
- Ensure required technologies are researched
- Build recreation buildings generously

**For Generation Ship Victory:**
- Expand to 50+ colonists for workforce
- Build Mining Stations for massive material production
- Focus research on endgame technologies
- Plan for 1000+ material cost of Generation Ship

### General Tips

1. **Never let resources hit zero** - Oxygen and food depletion means defeat
2. **Balance growth with stability** - More colonists means more consumption
3. **Build a Science Station early** - No research buildings = no tech progress
4. **Monitor building condition** - Maintenance is cheaper than repairs
5. **Use Overdrive sparingly** - The morale penalty compounds
6. **Keep some colonists unassigned** - Flexibility for emergencies
7. **Watch deposit reserves** - Plan replacements before depletion
8. **Satisfy faction demands** - Political support enables projects
9. **Never ignore power warnings** - Buildings on battery shut down in 3 sols

---

## Quick Reference

### Colonist Consumption (per sol)
- Food: 0.5
- Oxygen: 0.3
- Water: 0.2

### Key Thresholds
- Population growth: Pop ≥ 20, Health > 80%, Morale > 60%
- Colony Charter: Pop ≥ 30, Morale > 60%, 200 sol sustain
- Population defeat: Pop < 5
- Health critical: < 20%
- Morale low: < 30%

### Mastery Efficiency
- Novice: 70%
- Skilled: 100%
- Expert: 130%
- Master: 160%

### Building Mode Efficiency
- Conservation: 50% production / 40% consumption
- Normal: 100% / 100%
- Overdrive: 150% / 200%

---

*Good luck, Administrator. The future of humanity on Mars rests in your hands.*

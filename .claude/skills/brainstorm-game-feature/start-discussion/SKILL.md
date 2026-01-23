---
name: brainstorm-game-feature:start-discussion
description: Use when brainstorming feature ideas for the game and creating GitHub discussions from them
---

# Start Discussion

## Overview

Generate feature ideas by analyzing existing game systems, then create well-structured GitHub discussions for community input.

**Announce at start:** "I'm using start-discussion to explore the codebase, generate ideas, and create discussions."

## When to Use

- User asks to brainstorm game features/improvements
- User wants to create GitHub discussions from ideas
- User wants community input on potential features

## Process

```dot
digraph brainstorm_flow {
  "Understand game systems" -> "Brainstorm by category";
  "Brainstorm by category" -> "Get discussion category ID";
  "Get discussion category ID" -> "Create discussions via GraphQL";
  "Create discussions via GraphQL" -> "Add labels to discussions";
  "Add labels to discussions" -> "Report URLs";
}
```

## Step 1: Understand the Game

Read these files to understand existing systems:

| File | What You Learn |
|------|----------------|
| `src/core/GameState.ts` | All game systems and tick order |
| `src/core/data/buildings.ts` | Building types, costs, production |
| `src/core/data/technologies.ts` | Tech tree structure |
| `src/core/data/events.ts` | Random event types |
| `src/core/data/factions.ts` | Political factions |
| `src/core/data/npcs.ts` | NPC characters and projects |
| `src/core/systems/VictoryManager.ts` | Win/lose conditions |
| `src/core/systems/ColonyManager.ts` | Population, health, morale |
| `src/core/systems/OperationsManager.ts` | Expeditions, prospecting |

## Step 2: Brainstorm by Category

Generate ideas across these game areas:

| Category | Think About |
|----------|-------------|
| **Environment** | Weather, seasons, terrain, hazards |
| **Colonists** | Personalities, relationships, skills, stories |
| **Politics** | Elections, negotiations, crises, factions |
| **Resources** | New types, trading, supply chains |
| **Buildings** | Upgrades, maintenance, new types |
| **Technology** | New branches, research mechanics |
| **Events** | Event chains, disasters, opportunities |
| **Victory** | Alternative win conditions, endgame content |

**Quality over quantity**: 3-5 well-developed themes beat 10 shallow ideas.

## Step 3: Get Repository and Category IDs

GitHub discussions require IDs from GraphQL. Run this query:

```bash
gh api graphql -f query='
{
  repository(owner: "elliottregan", name: "space-game-demo") {
    id
    discussionCategories(first: 10) {
      nodes {
        id
        name
      }
    }
  }
}'
```

Use the **Ideas** category for feature brainstorming (ID: `DIC_kwDOQ-Dazc4C1UcX`).

## Step 4: Create Discussions via GraphQL

The `gh` CLI doesn't have a built-in `discussion` command. Use the GraphQL mutation:

```bash
gh api graphql -f query='
mutation {
  createDiscussion(input: {
    repositoryId: "R_kgDOQ-DazQ"
    categoryId: "DIC_kwDOQ-Dazc4C1UcX"
    title: "Feature Title Here"
    body: "Discussion body in markdown..."
  }) {
    discussion {
      url
      number
    }
  }
}'
```

**Create discussions in parallel** for efficiency.

## Step 5: Add Labels to Discussions

Label discussions for better organization. First, get label IDs:

```bash
gh api graphql -f query='
{
  repository(owner: "elliottregan", name: "space-game-demo") {
    labels(first: 20) {
      nodes { id name }
    }
  }
}'
```

Then add labels using the discussion ID from step 4:

```bash
gh api graphql -f query='
mutation {
  addLabelsToLabelable(input: {
    labelableId: "D_kwDOQ-Dazc4AjyG-"
    labelIds: ["LA_kwDOQ-Dazc8AAAACVxYBAw", "LA_kwDOQ-Dazc8AAAACVhRc3g"]
  }) {
    labelable { ... on Discussion { number title } }
  }
}'
```

**Label multiple discussions in parallel** by including multiple mutations:

```bash
gh api graphql -f query='
mutation {
  d1: addLabelsToLabelable(input: { labelableId: "DISCUSSION_ID_1", labelIds: ["LABEL_ID"] }) { ... }
  d2: addLabelsToLabelable(input: { labelableId: "DISCUSSION_ID_2", labelIds: ["LABEL_ID"] }) { ... }
}'
```

### Common Labels

| Label | ID | Use For |
|-------|-----|---------|
| `enhancement` | `LA_kwDOQ-Dazc8AAAACVhRc3g` | New feature proposals |
| `balance` | `LA_kwDOQ-Dazc8AAAACVxcCJg` | Game balance and tuning |
| `resources` | `LA_kwDOQ-Dazc8AAAACVxYBAw` | Resource system features |
| `politics` | `LA_kwDOQ-Dazc8AAAACVvUqpQ` | Political/faction features |
| `environment` | `LA_kwDOQ-Dazc8AAAACVxbZcQ` | Weather, terrain, hazards |
| `colonists` | `LA_kwDOQ-Dazc8AAAACVxbaTQ` | Personalities, skills, stories |
| `buildings` | `LA_kwDOQ-Dazc8AAAACVxbbCQ` | Construction, upgrades, maintenance |
| `technology` | `LA_kwDOQ-Dazc8AAAACVxbbmQ` | Tech tree, research mechanics |
| `events` | `LA_kwDOQ-Dazc8AAAACVxbcVQ` | Random events, disasters |
| `operations` | `LA_kwDOQ-Dazc8AAAACVxcBbA` | Expeditions, prospecting, missions |
| `victory` | `LA_kwDOQ-Dazc8AAAACVxbc8Q` | Win conditions, endgame |
| `ready-for-ticket` | `LA_kwDOQ-Dazc8AAAACVxsOKg` | Dev evaluation complete, ready to convert to issue |

## Discussion Content Template

Use this structure for each discussion:

```markdown
## Overview

[2-3 sentences describing the feature theme]

## Proposed Features

### 1. Feature Name
- Bullet points describing the feature
- How it affects gameplay
- Example scenarios

### 2. Feature Name
[Continue pattern...]

## Implementation Considerations

- Technical complexity notes
- How it fits existing architecture
- Potential opt-in/difficulty settings

## Questions for Discussion

- Open question 1?
- Open question 2?
- Open question 3?
```

## Quick Reference

| Task | Command/Tool |
|------|--------------|
| List categories | `gh api graphql` with `discussionCategories` query |
| Create discussion | `gh api graphql` with `createDiscussion` mutation |
| Get repo ID | `gh api graphql` with `repository(owner, name) { id }` |
| List labels | `gh label list` or `gh api graphql` with `labels` query |
| Add labels | `gh api graphql` with `addLabelsToLabelable` mutation |
| Remove labels | `gh api graphql` with `removeLabelsFromLabelable` mutation |
| Create label | `gh label create NAME --color HEX --description "..."` |

**Repository ID**: `R_kgDOQ-DazQ`
**Ideas Category ID**: `DIC_kwDOQ-Dazc4C1UcX`

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `gh discussion create` | Command doesn't exist; use GraphQL API |
| Missing category ID | Query `discussionCategories` first |
| Creating sequentially | Run mutations in parallel for speed |
| Shallow ideas | Read codebase thoroughly before brainstorming |
| No questions section | Always include 2-3 discussion prompts |
| Forgetting to label | Always add relevant labels after creating discussions |
| Using label name instead of ID | GraphQL requires node IDs, not label names |

## Example Output

After running, report:

```
Created 4 discussions:

| # | Title | Labels | Link |
|---|-------|--------|------|
| 19 | Dynamic Mars Environment | `enhancement` | https://github.com/.../discussions/19 |
| 20 | Colonist Stories | `enhancement` | https://github.com/.../discussions/20 |
| 21 | Resource Balancing | `resources`, `enhancement` | https://github.com/.../discussions/21 |
...
```

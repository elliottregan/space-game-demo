---
name: playtest-panel
description: Use when a game mechanic or system in this deck-builder needs multi-perspective design critique — it feels clunky, has a dominant or degenerate strategy, is hard to read, players gravitate to one boring line, or you're weighing a redesign and want reviewer lenses before committing.
---

# Playtest Panel

## Overview

Run a **local panel of five fixed reviewer personas** over one game mechanic, then synthesize their critiques into a single ranked report. No GitHub, no network — grounding, personas, and synthesis all happen in-session.

**Core principle:** independent lenses surface problems a single viewpoint misses. The value is *consistency* — the same five lenses and the same rubric every time, so reviews are comparable and the most relevant critics (the Optimizer, the Scope Guardian) are never accidentally dropped.

**Announce at start:** "Using playtest-panel to review [mechanic]."

## When to Use

- A mechanic feels clunky, noisy, or incoherent
- Players default to one line / a local optimum makes other play pointless
- Something is hard to read or onboard
- You're weighing a redesign and want perspectives before committing

**When NOT to use:** implementing a chosen design (just build it), pure balance-number tuning (use `run-simulation`), or bug fixing (use systematic-debugging). This skill stops at *review + synthesis* — it does not evaluate effort, write a plan, or implement.

## The Panel (fixed roster — always run all five)

| Persona | Lens | Asks |
|---------|------|------|
| **New Player** | first-session legibility | Can I tell what to do, why something happened, what a good move is? What's hidden or unreadable? |
| **The Optimizer (Spike)** | degenerate / dominant lines | What's the most efficient line? Is there a local-optimum trap that makes other play pointless? Is it "solved"? |
| **Game-Feel Designer** | tactility & fantasy | Does the interaction feel good and read coherently? Does it deliver the intended fantasy moment-to-moment? |
| **Systems / Balance Designer** | scaling & knock-ons | How does this interact with the rest (Crisis, policies, legacy, deck economy)? What breaks if numbers move? |
| **Scope Guardian** | effort vs. payoff | Is the complexity earning its keep? What's the cheapest change capturing most of the value? Any half-built-system risk? |

Do not swap, drop, or add personas. The fixed roster is the point. (Scope Guardian intentionally echoes the project's standing "don't reintroduce half-built systems" principle.)

## Process

### 1. Identify the target
Take the mechanic from the invocation args. If unclear, ask one question: which mechanic/system to review.

### 2. Ground dynamically — NEVER from a hardcoded file map
Locate the relevant files **by searching**, not from a remembered list (a hardcoded map is exactly what rotted the previous skill):
- Glob/grep `src/core/` and `src/renderer/` for the mechanic's concepts (e.g. the verb names, type names, component names).
- Read the matched files + `CLAUDE.md`.
- Write a short **shared brief** (≤200 words): what the mechanic is, what it intends, the key files. Every persona reacts to this same brief.

### 3. Run the panel — five parallel subagents
Dispatch all five personas concurrently (one `Agent` call each, in a single message). Subagents share **none** of this session's context, so **paste the full brief text and the step-2 file list into each persona's prompt** — don't just reference them. Also give each its charter + the rubric below. Personas read the cited code themselves so evidence is real, not guessed.

Each persona returns:
- **Findings** — each with: title, severity (`high`/`med`/`low`), why it matters, and concrete evidence (`file:line`).
- **One change** — "if I could change one thing…"
- **One keep** — what's genuinely good and must survive any rework.

### 4. Synthesize
- **Verify evidence first.** For each finding, open the cited `file:line` and confirm it says what the persona claims. Drop findings whose evidence doesn't resolve; mark `[unverified]` any judgment call with no checkable citation. Fabricated citations must not enter the ranking — concrete evidence is the whole premise.
- Cluster the surviving findings across personas into themes.
- Rank each theme by **consensus × severity**: consensus = how many of the five personas raised it (1–5); severity weight `high`=3, `med`=2, `low`=1. Score = consensus × highest severity weight in the theme; break ties by summed severity. Show `consensus N/5` and the severity in the report.
- Flag **conflicts** (personas disagree) as open design questions, not as resolved findings.

### 5. Report
Write `docs/design-reviews/YYYY-MM-DD-<topic>.md` (create the directory if missing; use the current date from context for `YYYY-MM-DD`):

```markdown
# Playtest Panel: <mechanic> — <date>

## Brief
<the shared brief>

## Ranked findings
1. **<theme>** — consensus N/5, severity <high/med/low>. <summary + evidence>
...

## Open questions (persona conflicts)
- <where lenses disagreed and why it's a design decision>

## Keep (don't break these)
- <consensus strengths>

## Per-persona notes
### New Player
...
```

Then give a tight inline summary: top 3 ranked findings + the sharpest open question.

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Hardcoding a file map in the skill or guessing files from memory | Discover files by glob/grep each run — code moves |
| Dropping the Optimizer or Scope Guardian "because they seem less relevant" | Always run all five; the dropped one is usually the one that catches the real problem |
| Personas hand-waving without citing code | Require `file:line` evidence in every finding |
| Trusting cited `file:line` without checking | Verify each citation resolves in synthesis; drop fabricated ones |
| Referencing the brief instead of pasting it into each subagent | Subagents share no session context — inline the full brief + file list |
| Letting personas blur together (one voice, five hats) | Run them as separate subagents so the lenses stay independent |
| Sliding into effort estimates, plans, or implementation | Out of scope — stop at the ranked report |
| Skipping the report file | Always write the dated `docs/design-reviews/` file; durability is the point |

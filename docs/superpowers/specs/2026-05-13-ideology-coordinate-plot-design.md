# Ideology coordinate plot

**Status:** approved
**Date:** 2026-05-13
**Component:** `src/renderer/components/game/IdeologyDisplay.vue`

## Goal

Replace the two horizontal `AxisBar` rows in the Ideology panel with a single 2D coordinate plot. The bar metaphor implicitly frames each axis as a tug-of-war between two "sides," which leaks a good/bad valence the game does not have — Solidarity is not the opposite of Sovereignty in value, just in direction. A coordinate plot makes the four poles spatially symmetric and renders the player's identity as a single position in ideology space.

## Visual design

A square SVG fills the existing `.ideology-display` grid cell (top row, alongside Keystone Projects and Crisis Counter).

```
                Transformation
                       │
                       ⌶
                  ╲    ⌶    ╱
                  ╲ ╲  ⌶  ╱ ╱
                  ╲   ╲⌶╱   ╱
   Solidarity ─ ─⌶─ ─ ⊕ ─ ⌶─ ─ Sovereignty
                  ╱   ╱⌶╲   ╲
                  ╱ ╱  ⌶  ╲ ╲
                  ╱    ⌶    ╲
                       ⌶
                       │
                   Heritage

   (rings at r = 3, 6, 8 — active / dominant / gate)
```

### Static elements

- **Axis cross-hairs** through the center. Single 0.5px strokes in `--border` / mid-grey. Purely orientation; no value markers.
- **Three threshold rings** at magnitudes 3, 6, 8 (active / dominant / gate). Dashed strokes (`stroke-dasharray="2 3"`) in mid-grey. **No labels** on the rings.
- **Four pole labels** at the cardinal edges:
  - Top: "Transformation" tinted with `--suit-transformation`
  - Bottom: "Heritage" tinted with `--suit-heritage`
  - Left: "Solidarity" tinted with `--suit-solidarity`
  - Right: "Sovereignty" tinted with `--suit-sovereignty`
  - Font weight 600, ~11px.

### Dynamic elements

- **Position dot** at `(axis1, axis2)` mapped through the same clamping as the old `AxisBar` — `MAX = 20`, values clamped to `[-20, +20]`, mapped to canvas coordinates. `axis2` flips sign on render so Transformation appears at the top.
- **Dot color:** defaults to `--accent` (gold). When `demonym(vector) !== null`, tints to the suit color of the axis that drove the demonym (the axis with the larger magnitude past ±6).
- **Halo:** a lower-opacity (0.4) stroke ring at radius +6 around the dot, matching the dot color. Gives the dot visual weight against the threshold rings.
- **Demonym label** rendered below the SVG inside the same `.ideology-display` section:
  - Default ("Unaligned"): muted text color, italic.
  - Active (`The Collective` / `The Dominion` / `The Ascendancy` / `The Keepers`): color-coded to the dominant axis's suit color, italic, slightly larger weight.

### Explicitly out of scope

- No terrain "ghost" dot or terrain marker. Terrain effects (start-of-Epoch baseline, scarred Dissent injection) remain mechanical-only; the player reads them via card costs and starting hand, not a visual.
- No ring labels (active / dominant / gate).
- No exact-value text readout. The grid position carries the information; reading exact numbers is not the panel's job.
- No tooltip / hover state. A future enhancement, not in this scope.
- No animation on value changes. Vue's reactive re-render is enough; a tweened dot is a future enhancement.

## Component structure

Single file: `src/renderer/components/game/IdeologyDisplay.vue`. Rewritten in place — the `<script>` props (`vector`, `terrain`, `demonymLabel`) stay identical, so `App.vue` does not change.

- The `terrain` prop is kept on the interface but only consumed if needed (it currently feeds the now-removed terrain mark). Likely it can be dropped from the prop list since terrain is already baked into `vector` via `currentVector()`. The implementation plan should verify and remove unused props.
- A small computed for `dotColor` reading from `demonym(vector)` — but since the demonym is already derived in the facade and `demonymLabel` is passed in, the component needs a way to know *which axis* is dominant. Cleanest option: pass the demonym key (one of `"collective" | "dominion" | "ascendancy" | "keepers" | null`) as a prop in addition to the label, or have the component re-derive it locally from `vector`. Implementation plan picks one.

## Files affected

- **Rewrite:** `src/renderer/components/game/IdeologyDisplay.vue`
- **Delete:** `src/renderer/components/core/AxisBar.vue` (no other consumers; confirmed via grep)
- **Possible touch:** `src/facade/GameAPI.ts` or `App.vue` if a new prop (demonym key) is plumbed through instead of re-deriving in the component.

## Testing

This is a presentational change. Visual smoke-test only:
- Open the dev server, observe the plot renders at neutral, then drift the dot in each direction by placing aligned cards.
- Cross the ±6 gate to verify dot tints to the correct suit color and demonym label appears in matching color.
- Cross the ±8 gate to verify the dot sits inside the outermost ring without clipping.

No new unit tests. The component has no business logic beyond mapping numbers to SVG coordinates.

## Risk

Low. The replaced component is pure presentation, all four mechanical consumers of the ideology vector (alignment, influence-cost adjustment, demonym derivation, terrain) operate on the same `IdeologyVector` and are untouched. Worst case: the plot looks wrong and we revert one file.

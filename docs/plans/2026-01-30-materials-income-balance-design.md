# Materials Income Balance Design

## Problem

Materials income is too constrained in early-mid game:
- Basic Mine (4/sol) requires deposit + expedition
- Automated Factory (15/sol) requires 175 sols of research (Advanced Materials + Robotics)
- This creates a ~120 sol "materials desert" where players struggle to expand beyond survival infrastructure
- Simulation shows "Insufficient resources" blocking 58k+ times per run

## Solution

Two changes working together:

### 1. New Building: 3D Fabricator

Additive manufacturing unit that constructs components from raw feedstock.

| Property | Value |
|----------|-------|
| ID | `FABRICATOR_3D` |
| Cost | 90 materials |
| Construction Time | 15 sols |
| Production | 7 materials/sol |
| Consumption | 8 power |
| Workers | 2 ENGINEERING |
| Required Tech | Advanced Materials |
| Requires Deposit | No |
| Oxygen Contribution | -1 |
| Purpose | Industrial |

### 2. Reduce Robotics Research Time

| Property | Current | New |
|----------|---------|-----|
| Research Time | 120 sols | 85 sols |

## Materials Income Progression

| Phase | Sol Range | Best Option | Rate |
|-------|-----------|-------------|------|
| Early | 0-55 | Basic Mine (if deposit found) | 4/sol |
| Mid-Early | 55-140 | 3D Fabricator | 7/sol |
| Mid-Late | 140+ | Automated Factory | 15/sol |

## Comparison with Existing Buildings

| Building | Materials/sol | Cost | Workers | Deposit | Tech |
|----------|--------------|------|---------|---------|------|
| Basic Mine | 4 | 50 | 4 | Yes | None |
| 3D Fabricator | 7 | 90 | 2 | No | Adv. Materials |
| Automated Factory | 15 | 200 | 0 | No | Robotics |

## Expected Simulation Impact

| Metric | Current | Expected |
|--------|---------|----------|
| Win Rate | 92% | 93-95% |
| Median Victory | 588 sols | 550-570 sols |
| "Insufficient resources" blocks | 58k/run | 40-45k/run |

## Implementation

### Files to Modify

1. `src/core/models/Building.ts` - Add `FABRICATOR_3D` to BuildingId enum
2. `src/core/data/buildings.ts` - Add 3D Fabricator definition
3. `src/core/data/technologies.ts` - Reduce Robotics cost from 120 to 85 sols
4. `docs/specs/11-BALANCE-CONSTANTS.md` - Document new building stats

### Validation

1. Run 200 simulations with changes
2. Compare metrics to baseline
3. Target: Win rate 90-95%, median victory 500-600 sols

import {
  LS_QUALITY_COMFORTABLE,
  LS_QUALITY_CRISIS,
  LS_QUALITY_PRESSURE,
  LS_MAX_HEALTH_PENALTY,
  LS_MAX_MORALE_PENALTY,
  LS_MAX_EFFICIENCY_PENALTY,
} from "../../balance/LifeSupportBalance";
import type { GameEvent } from "../../models/GameEvent";
import { definePhase } from "../TickPhase";
import type { TickContext } from "../TickContext";

export const calculateLifeSupport = definePhase({
  id: "lifeSupport:calculate",
  name: "Calculate Life Support",
  reads: ["buildings", "colony", "districts"],
  writes: ["derived.lifeSupportQuality", "derived.lifeSupportEffects", "buildings", "lifeSupport"],
  execute(ctx: TickContext): GameEvent[] {
    const events: GameEvent[] = [];
    const population = ctx.colony.getPopulation();
    const totalCapacity =
      ctx.buildings.getTotalLifeSupportCapacity() + ctx.districts.getTotalCapacity();
    const industrialLoad = ctx.buildings.getTotalLifeSupportLoad();
    const resourceFactor = 1;
    const quality = ctx.lifeSupport.calculate(
      population,
      industrialLoad,
      totalCapacity,
      resourceFactor,
    );

    ctx.derived.lifeSupportQuality = quality;

    let health = 0;
    let morale = 0;
    let efficiency = 1;

    if (quality < LS_QUALITY_COMFORTABLE) {
      const severity = 1 - quality / LS_QUALITY_COMFORTABLE;
      health = -severity * LS_MAX_HEALTH_PENALTY;
      morale = -severity * LS_MAX_MORALE_PENALTY;
    }

    if (quality < LS_QUALITY_CRISIS) {
      const severity = 1 - quality / LS_QUALITY_CRISIS;
      efficiency = 1 - severity * LS_MAX_EFFICIENCY_PENALTY;
    }

    ctx.derived.lifeSupportEffects = { health, morale, efficiency };
    ctx.buildings.setLifeSupportEfficiency(efficiency);

    if (quality < LS_QUALITY_CRISIS) {
      events.push({
        type: "LIFE_SUPPORT_CRITICAL",
        quality,
        severity: "critical",
        message: `Life support critical: ${Math.round(quality * 100)}%`,
      });
    } else if (quality < LS_QUALITY_PRESSURE) {
      events.push({
        type: "LIFE_SUPPORT_STRAINED",
        quality,
        severity: "warning",
        message: `Life support strained: ${Math.round(quality * 100)}%`,
      });
    }

    return events;
  },
});

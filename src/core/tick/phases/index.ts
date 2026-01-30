import { TickRunner } from "../TickRunner";

// Pre-tick phases
import { updateLaborPoolBonus } from "./pretick";
import { calculateAirQuality } from "./airQuality";
// Resource phases
import { applyResourceFlows, checkResourceDepletion } from "./resources";
// Building phases
import {
  processBuildingsTick,
  processConstruction,
  processRepairs,
  processRecycling,
  processMaintenanceDecay,
} from "./buildings";
// Workforce phases
import { processWorkforceTick } from "./workforce";
// Colonist morale phases
import { propagateColonistMorale } from "./colonistMorale";
// Colony phases
import {
  calculateSocialCohesion,
  calculatePolicyEffects,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "./colony";
// Technology phases
import { processResearch } from "./technology";
// Politics phases
import { processNPCInfluence } from "./politics";
// Operations phases
import { processOperations, processDepositExtraction } from "./operations";
// Events phases
import { processRandomEvents } from "./events";
// Victory phases
import { checkVictoryConditions } from "./victory";

// Re-export all phases
export { updateLaborPoolBonus } from "./pretick";
export { calculateAirQuality } from "./airQuality";
export { applyResourceFlows, checkResourceDepletion } from "./resources";
export {
  processBuildingsTick,
  processConstruction,
  processRepairs,
  processRecycling,
  processMaintenanceDecay,
} from "./buildings";
export { processWorkforceTick } from "./workforce";
export { propagateColonistMorale } from "./colonistMorale";
export {
  calculateSocialCohesion,
  calculatePolicyEffects,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "./colony";
export { processResearch } from "./technology";
export { processNPCInfluence } from "./politics";
export { processOperations, processDepositExtraction } from "./operations";
export { processRandomEvents } from "./events";
export { checkVictoryConditions } from "./victory";

/**
 * Create a TickRunner with all standard game phases registered.
 *
 * Phase execution order:
 * 1. Pre-tick: Labor pool bonus
 * 2. Resources: Apply flows, check depletion
 * 3. Buildings: Construction, repairs, recycling, maintenance
 * 4. Workforce: Bonding, training, experience
 * 5. Colony: Social cohesion, policy effects, tick, auto-assign, housing
 * 6. Technology: Research progress
 * 7. Politics: NPC influence
 * 8. Operations: Operations, deposit extraction
 * 9. Events: Random events
 * 10. Victory: Check conditions
 */
export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // 1. Pre-tick phases
  runner.register(updateLaborPoolBonus);
  runner.register(calculateAirQuality);

  // 2. Resource phases
  runner.register(applyResourceFlows);
  runner.register(checkResourceDepletion);

  // 3. Building phases (using combined tick for now)
  runner.register(processBuildingsTick);
  // Stub phases not registered - they would duplicate the combined tick

  // 4. Workforce phases (using combined tick for now)
  runner.register(processWorkforceTick);

  // 4b. Colonist morale propagation (after workforce, before colony phases)
  runner.register(propagateColonistMorale);

  // 5. Colony phases
  runner.register(calculateSocialCohesion);
  runner.register(calculatePolicyEffects);
  runner.register(processColonyTick);
  runner.register(autoAssignWorkers);
  runner.register(assignHousing);

  // 6. Technology phases
  runner.register(processResearch);

  // 7. Politics phases
  runner.register(processNPCInfluence);

  // 8. Operations phases
  runner.register(processOperations);
  runner.register(processDepositExtraction);

  // 9. Events phases
  runner.register(processRandomEvents);

  // 10. Victory phases
  runner.register(checkVictoryConditions);

  runner.recomputeOrder();
  return runner;
}

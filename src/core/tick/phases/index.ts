import { TickRunner } from "../TickRunner";

// Pre-tick phases
import { updateLaborPoolBonus } from "./pretick";
import { calculateAirQuality } from "./airQuality";
import { processGridTick } from "./grid";
// Resource phases
import { applyResourceFlows, checkResourceDepletion } from "./resources";
// Building phases
import {
  processBuildingsTick,
  processConstruction,
  processRepairs,
  processRecycling,
} from "./buildings";
// Workforce phases
import { processWorkforceTick } from "./workforce";
// Colonist morale phases
import { visitSocialBuildings, propagateColonistMorale } from "./colonistMorale";
// Colony phases
import {
  calculateSocialCohesion,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "./colony";
// Technology phases
import { processResearch } from "./technology";
// Ideology phases
import { propagateIdeology, processProjectVotes } from "./ideology";
// Operations phases
import { processOperations, processDepositExtraction } from "./operations";
// Earth Crisis phases
import { processEarthCrisis } from "./earthCrisis";
// Events phases
import { processRandomEvents } from "./events";
// Victory phases
import { checkVictoryConditions } from "./victory";

// Re-export all phases
export { updateLaborPoolBonus } from "./pretick";
export { calculateAirQuality } from "./airQuality";
export { processGridTick } from "./grid";
export { applyResourceFlows, checkResourceDepletion } from "./resources";
export {
  processBuildingsTick,
  processConstruction,
  processRepairs,
  processRecycling,
} from "./buildings";
export { processWorkforceTick } from "./workforce";
export { visitSocialBuildings, propagateColonistMorale } from "./colonistMorale";
export {
  calculateSocialCohesion,
  processColonyTick,
  autoAssignWorkers,
  assignHousing,
} from "./colony";
export { processResearch } from "./technology";
export { propagateIdeology, processProjectVotes } from "./ideology";
export { processOperations, processDepositExtraction } from "./operations";
export { processEarthCrisis } from "./earthCrisis";
export { processRandomEvents } from "./events";
export { checkVictoryConditions } from "./victory";

/**
 * Create a TickRunner with all standard game phases registered.
 *
 * Phase execution order:
 * 1. Pre-tick: Labor pool bonus
 * 2. Resources: Apply flows, check depletion
 * 3. Buildings: Construction, repairs, recycling
 * 4. Workforce: Bonding, training, experience
 * 5. Colony: Social cohesion, tick, auto-assign, housing
 * 6. Technology: Research progress
 * 7. Ideology: Ideology propagation
 * 8. Operations: Operations, deposit extraction
 * 9. Events: Random events
 * 10. Victory: Check conditions
 */
export function createStandardTickRunner(): TickRunner {
  const runner = new TickRunner();

  // 1. Pre-tick phases
  runner.register(updateLaborPoolBonus);
  runner.register(calculateAirQuality);
  runner.register(processGridTick);

  // 2. Resource phases
  runner.register(applyResourceFlows);
  runner.register(checkResourceDepletion);

  // 3. Building phases (using combined tick for now)
  runner.register(processBuildingsTick);
  // Stub phases not registered - they would duplicate the combined tick

  // 4. Workforce phases (using combined tick for now)
  runner.register(processWorkforceTick);

  // 4b. Colonist morale phases (after workforce, before colony phases)
  runner.register(visitSocialBuildings);
  runner.register(propagateColonistMorale);

  // 5. Colony phases
  runner.register(calculateSocialCohesion);
  runner.register(processColonyTick);
  runner.register(autoAssignWorkers);
  runner.register(assignHousing);

  // 6. Technology phases
  runner.register(processResearch);

  // 7. Ideology phases
  runner.register(propagateIdeology);
  runner.register(processProjectVotes);

  // 8. Operations phases
  runner.register(processOperations);
  runner.register(processDepositExtraction);

  // 8b. Earth Crisis phases
  runner.register(processEarthCrisis);

  // 9. Events phases
  runner.register(processRandomEvents);

  // 10. Victory phases
  runner.register(checkVictoryConditions);

  runner.recomputeOrder();
  return runner;
}

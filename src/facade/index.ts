// src/facade/index.ts
// Public exports for the game facade API

// Domain facades (for advanced usage or testing)
export {
  AirQualityFacade,
  BuildingsFacade,
  ColonyFacade,
  EventsFacade,
  GameFlowFacade,
  IdeologyFacade,
  NPCFacade,
  OperationsFacade,
  PoliticsFacade,
  ResourcesFacade,
  TechnologyFacade,
} from "./domains";
// Main API
export { GameAPI, type StateChangeListener } from "./GameAPI";
// All types
export * from "./types";
// Starting conditions
export type { StartingCondition } from "../core/models/StartingCondition";
export { StartingConditionId, STARTING_CONDITIONS } from "../core/data/startingConditions";

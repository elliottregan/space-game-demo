// src/facade/index.ts
// Public exports for the game facade API

// Domain facades (for advanced usage or testing)
export {
  BuildingsFacade,
  ColonyFacade,
  EventsFacade,
  GameFlowFacade,
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

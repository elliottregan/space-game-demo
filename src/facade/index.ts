// src/facade/index.ts
// Public exports for the game facade API

// Main API
export { GameAPI, type StateChangeListener } from "./GameAPI";

// All types
export * from "./types";

// Domain facades (for advanced usage or testing)
export {
  ResourcesFacade,
  BuildingsFacade,
  TechnologyFacade,
  ColonyFacade,
  PoliticsFacade,
  OperationsFacade,
  NPCFacade,
  EventsFacade,
  GameFlowFacade,
} from "./domains";

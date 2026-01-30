import { STARTING_POPULATION, STARTING_RESOURCES } from "../balance/EconomyBaseline";
import { BuildingId } from "../models/Building";
import type { StartingCondition } from "../models/StartingCondition";

export enum StartingConditionId {
  DEFAULT = "default",
  ESTABLISHED_BASE = "established_base",
}

export const STARTING_CONDITIONS: StartingCondition[] = [
  {
    id: StartingConditionId.DEFAULT,
    name: "Fresh Start",
    description: "14 colonists with basic supplies and minimal life support.",
    population: STARTING_POPULATION,
    resources: STARTING_RESOURCES,
    preBuiltBuildings: [
      BuildingId.SOLAR_PANEL,
      BuildingId.SOLAR_PANEL,
      BuildingId.HABITAT,
      BuildingId.BASIC_FARM,
      BuildingId.OXYGEN_GENERATOR,
      BuildingId.WATER_EXTRACTOR,
    ],
  },
  {
    id: StartingConditionId.ESTABLISHED_BASE,
    name: "Established Base",
    description: "A small outpost with basic infrastructure already in place.",
    population: STARTING_POPULATION,
    resources: STARTING_RESOURCES,
    preBuiltBuildings: [
      BuildingId.HABITAT,
      BuildingId.HABITAT,
      BuildingId.SOLAR_PANEL,
      BuildingId.BASIC_FARM,
      BuildingId.BASIC_FARM,
      BuildingId.OXYGEN_GENERATOR,
      BuildingId.OXYGEN_GENERATOR,
    ],
  },
];

export function getStartingCondition(id: string): StartingCondition | undefined {
  return STARTING_CONDITIONS.find((c) => c.id === id);
}

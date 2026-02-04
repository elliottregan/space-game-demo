import { GameState } from "../src/core/GameState";
import { BuildingId } from "../src/core/models/Building";

function profileTick(colonistCount: number, buildingCount: number): void {
  const state = new GameState();

  // Add colonists
  state.colony.adjustPopulation(colonistCount - state.colony.getColonists().length);

  // Add buildings (mix of types)
  const buildingTypes: BuildingId[] = [
    BuildingId.BASIC_FARM,
    BuildingId.WATER_EXTRACTOR,
    BuildingId.SOLAR_PANEL,
    BuildingId.HABITAT,
  ];

  for (let i = 0; i < buildingCount; i++) {
    const defId = buildingTypes[i % buildingTypes.length];
    if (!defId) continue;
    const def = state.buildings.getDefinition(defId);
    if (!def) continue;

    state.buildings.addBuilding({
      definitionId: defId,
      status: "active",
      constructionProgress: def.constructionTime,
      assignedWorkers: [],
      mode: "normal",
      broken: false,
      repairProgress: 0,
    });

    // Register production/consumption
    if (def.production) state.resources.addProduction(def.production);
    if (def.consumption) state.resources.addConsumption(def.consumption);
  }

  // Assign workers to buildings
  const colonists = state.colony.getColonists();
  const buildings = state.buildings.getBuildings();
  let colonistIdx = 0;
  for (const building of buildings) {
    const def = state.buildings.getDefinition(building.definitionId);
    if (!def?.workerSlots) continue;
    for (let s = 0; s < def.workerSlots && colonistIdx < colonists.length; s++) {
      const colonist = colonists[colonistIdx++];
      if (colonist) building.assignedWorkers.push(colonist.id);
    }
  }

  // Initialize colonist consumption
  state.colony.tick(state.resources, state.buildings, { morale: 0, health: 0 });

  // Warm up longer to build up relationships
  for (let i = 0; i < 100; i++) state.tick();

  // Check relationship count
  const relationships = state.workforce.getAllCoworkerRelationships();
  const relationshipCount = relationships.size;

  // Profile
  const iterations = 100;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    state.tick();
  }
  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  console.log(
    `${colonistCount.toString().padStart(4)} colonists, ${buildingCount.toString().padStart(4)} buildings, ` +
      `${relationshipCount.toString().padStart(5)} rels: ${avgMs.toFixed(3)}ms/tick`,
  );
}

console.log("=== Tick Performance Profile ===\n");
console.log("Target for 60fps: 16.67ms\n");

profileTick(10, 5);
profileTick(50, 20);
profileTick(100, 50);
profileTick(200, 100);
profileTick(500, 200);
profileTick(1000, 400);

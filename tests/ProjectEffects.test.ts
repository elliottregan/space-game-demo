import { describe, expect, test, beforeEach } from "bun:test";
import { RecurringEventScheduler } from "../src/core/systems/RecurringEventScheduler";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { IdeologyManager } from "../src/core/systems/IdeologyManager";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { NPCFaction, ProjectId } from "../src/core/models/NPCInfluence";
import { TechnologyId } from "../src/core/models/Technology";
import { getProject } from "../src/core/data/projects";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import type { Colonist, ColonistIdeology } from "../src/core/models/Colonist";
import { ColonistRole, MasteryLevel } from "../src/core/models/Colonist";

function createTestColonist(id: string, name: string, ideology: ColonistIdeology): Colonist {
  return {
    id,
    name,
    role: ColonistRole.UNASSIGNED,
    experience: 0,
    masteryLevel: MasteryLevel.NOVICE,
    skills: [],
    ideology,
  };
}

describe("RecurringEventScheduler", () => {
  let scheduler: RecurringEventScheduler;

  beforeEach(() => {
    scheduler = new RecurringEventScheduler();
  });

  test("registers recurring event with correct nextTriggerSol", () => {
    scheduler.register(
      ProjectId.IMMIGRATION_PROGRAM,
      { eventType: "immigration", intervalSols: 10 },
      100,
    );

    const events = scheduler.getScheduledEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.nextTriggerSol).toBe(110);
    expect(events[0]?.projectId).toBe(ProjectId.IMMIGRATION_PROGRAM);
    expect(events[0]?.eventType).toBe("immigration");
    expect(events[0]?.intervalSols).toBe(10);
  });

  test("tick fires event when sol reaches trigger time", () => {
    scheduler.register(
      ProjectId.IMMIGRATION_PROGRAM,
      { eventType: "immigration", intervalSols: 10 },
      100,
    );

    // Tick at sol 109 - no events
    const earlyEvents = scheduler.tick(109);
    expect(earlyEvents.length).toBe(0);

    // Tick at sol 110 - fires event
    const triggerEvents = scheduler.tick(110);
    expect(triggerEvents.length).toBe(1);
    expect(triggerEvents[0]?.type).toBe("SCHEDULED_EVENT");
    expect(triggerEvents[0]?.scheduledEventType).toBe("immigration");
    expect(triggerEvents[0]?.projectId).toBe(ProjectId.IMMIGRATION_PROGRAM);
  });

  test("tick updates nextTriggerSol after firing", () => {
    scheduler.register(
      ProjectId.IMMIGRATION_PROGRAM,
      { eventType: "immigration", intervalSols: 10 },
      100,
    );

    // Fire at sol 110
    scheduler.tick(110);

    // After firing at 110, nextTriggerSol should be 120
    const events = scheduler.getScheduledEvents();
    expect(events[0]?.nextTriggerSol).toBe(120);
  });

  test("tick with params includes params in fired event", () => {
    scheduler.register(
      ProjectId.IMMIGRATION_PROGRAM,
      { eventType: "immigration", intervalSols: 10, params: { count: 5 } },
      100,
    );

    const events = scheduler.tick(110);
    expect(events[0]?.params).toEqual({ count: 5 });
  });

  test("serialization and deserialization preserves state", () => {
    scheduler.register(
      ProjectId.IMMIGRATION_PROGRAM,
      { eventType: "immigration", intervalSols: 10, params: { count: 3 } },
      100,
    );

    const json = scheduler.toJSON();
    const restored = RecurringEventScheduler.fromJSON(json);

    const events = restored.getScheduledEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.projectId).toBe(ProjectId.IMMIGRATION_PROGRAM);
    expect(events[0]?.eventType).toBe("immigration");
    expect(events[0]?.intervalSols).toBe(10);
    expect(events[0]?.nextTriggerSol).toBe(110);
    expect(events[0]?.params).toEqual({ count: 3 });
  });

  test("unregisterProject removes all events for project", () => {
    scheduler.register(
      ProjectId.IMMIGRATION_PROGRAM,
      { eventType: "immigration", intervalSols: 10 },
      100,
    );
    scheduler.register(ProjectId.EARTH_MEMORIAL, { eventType: "ceremony", intervalSols: 50 }, 100);

    scheduler.unregisterProject(ProjectId.IMMIGRATION_PROGRAM);

    const events = scheduler.getScheduledEvents();
    expect(events.length).toBe(1);
    expect(events[0]?.projectId).toBe(ProjectId.EARTH_MEMORIAL);
  });

  test("reset clears all scheduled events", () => {
    scheduler.register(
      ProjectId.IMMIGRATION_PROGRAM,
      { eventType: "immigration", intervalSols: 10 },
      100,
    );

    scheduler.reset();

    expect(scheduler.getScheduledEvents().length).toBe(0);
  });
});

describe("ResourceManager production bonuses", () => {
  let manager: ResourceManager;

  beforeEach(() => {
    manager = new ResourceManager({
      food: 100,
      water: 100,
      materials: 100,
    });
  });

  test("addProductionBonus adds bonus", () => {
    manager.addProductionBonus("test-source", "materials", 5);

    expect(manager.getProductionBonus("materials")).toBe(5);
  });

  test("multiple bonuses for same resource stack", () => {
    manager.addProductionBonus("source1", "materials", 5);
    manager.addProductionBonus("source2", "materials", 3);

    expect(manager.getProductionBonus("materials")).toBe(8);
  });

  test("bonuses for different resources are independent", () => {
    manager.addProductionBonus("source1", "materials", 5);
    manager.addProductionBonus("source2", "food", 10);

    expect(manager.getProductionBonus("materials")).toBe(5);
    expect(manager.getProductionBonus("food")).toBe(10);
  });

  test("removeProductionBonus removes bonus", () => {
    manager.addProductionBonus("test-source", "materials", 5);
    manager.removeProductionBonus("test-source");

    expect(manager.getProductionBonus("materials")).toBe(0);
  });

  test("bonus affects production in tick", () => {
    manager.addProductionBonus("test-source", "materials", 5);
    manager.tick();

    expect(manager.getResources().materials).toBe(105);
  });

  test("bonus stacks with regular production", () => {
    manager.addProduction({ materials: 10 });
    manager.addProductionBonus("test-source", "materials", 5);
    manager.tick();

    // 100 + 10 (production) + 5 (bonus) = 115
    expect(manager.getResources().materials).toBe(115);
  });

  test("bonus included in net flow calculation", () => {
    manager.addProduction({ materials: 10 });
    manager.addConsumption({ materials: 3 });
    manager.addProductionBonus("test-source", "materials", 5);

    const netFlow = manager.getNetFlow();
    // 10 (production) + 5 (bonus) - 3 (consumption) = 12
    expect(netFlow.materials).toBe(12);
  });

  test("replacing same source updates bonus", () => {
    manager.addProductionBonus("test-source", "materials", 5);
    manager.addProductionBonus("test-source", "materials", 10);

    expect(manager.getProductionBonus("materials")).toBe(10);
  });

  test("serialization preserves production bonuses", () => {
    manager.addProductionBonus("source1", "materials", 5);
    manager.addProductionBonus("source2", "food", 3);

    const json = manager.toJSON();
    const restored = ResourceManager.fromJSON(json);

    expect(restored.getProductionBonus("materials")).toBe(5);
    expect(restored.getProductionBonus("food")).toBe(3);
  });
});

describe("Project requirements", () => {
  let ideologyManager: IdeologyManager;
  let technology: TechnologyTree;

  beforeEach(() => {
    ideologyManager = new IdeologyManager();
    technology = new TechnologyTree(TECHNOLOGIES);
  });

  test("TECHNOLOGY requirement blocks proposal without tech", () => {
    const project = getProject(ProjectId.IMMIGRATION_PROGRAM);
    expect(project).toBeDefined();

    const result = ideologyManager.canProposeProject(project!, { technology });

    expect(result.canPropose).toBe(false);
    expect(result.reason).toBe(`Technology not researched: ${TechnologyId.HABITAT_FABRICATION}`);
  });

  test("TECHNOLOGY requirement allows proposal with tech", () => {
    const project = getProject(ProjectId.IMMIGRATION_PROGRAM);
    expect(project).toBeDefined();

    // Research the required technology
    technology.completeResearch(TechnologyId.HABITAT_FABRICATION);

    const result = ideologyManager.canProposeProject(project!, { technology });

    expect(result.canPropose).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("already completed project cannot be proposed", () => {
    const project = getProject(ProjectId.IMMIGRATION_PROGRAM);
    expect(project).toBeDefined();

    technology.completeResearch(TechnologyId.HABITAT_FABRICATION);
    ideologyManager.completeProject(ProjectId.IMMIGRATION_PROGRAM);

    const result = ideologyManager.canProposeProject(project!, { technology });

    expect(result.canPropose).toBe(false);
    expect(result.reason).toBe("Project already completed");
  });

  test("pending proposal cannot be proposed again", () => {
    const project = getProject(ProjectId.IMMIGRATION_PROGRAM);
    expect(project).toBeDefined();

    technology.completeResearch(TechnologyId.HABITAT_FABRICATION);
    ideologyManager.submitProposal(ProjectId.IMMIGRATION_PROGRAM, NPCFaction.EarthLoyalists, 100);

    const result = ideologyManager.canProposeProject(project!, { technology });

    expect(result.canPropose).toBe(false);
    expect(result.reason).toBe("Project already pending vote");
  });

  test("failed proposal cannot be proposed without clearing", () => {
    const project = getProject(ProjectId.IMMIGRATION_PROGRAM);
    expect(project).toBeDefined();

    technology.completeResearch(TechnologyId.HABITAT_FABRICATION);

    // Submit and let it fail by processing vote with no supporters
    ideologyManager.submitProposal(ProjectId.IMMIGRATION_PROGRAM, NPCFaction.EarthLoyalists, 100);
    ideologyManager.processVotes(200); // Vote happens and fails

    const result = ideologyManager.canProposeProject(project!, { technology });

    expect(result.canPropose).toBe(false);
    expect(result.reason).toBe("Project previously failed (must clear first)");
  });

  test("cleared failed proposal can be proposed again", () => {
    const project = getProject(ProjectId.IMMIGRATION_PROGRAM);
    expect(project).toBeDefined();

    technology.completeResearch(TechnologyId.HABITAT_FABRICATION);

    ideologyManager.submitProposal(ProjectId.IMMIGRATION_PROGRAM, NPCFaction.EarthLoyalists, 100);
    ideologyManager.processVotes(200);
    ideologyManager.clearFailedProposal(ProjectId.IMMIGRATION_PROGRAM);

    const result = ideologyManager.canProposeProject(project!, { technology });

    expect(result.canPropose).toBe(true);
  });
});

describe("Conviction boost", () => {
  let ideologyManager: IdeologyManager;

  beforeEach(() => {
    ideologyManager = new IdeologyManager();
  });

  test("boostFactionConviction increases conviction for aligned colonists", () => {
    const colonist = createTestColonist("c1", "Earth Supporter", {
      earthLoyalist: 0.6,
      marsIndependence: 0.2,
      corporateInterests: 0.1,
      conviction: 0.3,
    });

    ideologyManager.boostFactionConviction(NPCFaction.EarthLoyalists, 0.1, [colonist]);

    expect(colonist.ideology?.conviction).toBeCloseTo(0.4, 2);
  });

  test("boostFactionConviction does not affect unaligned colonists", () => {
    const colonist = createTestColonist("c1", "Low Earth Affinity", {
      earthLoyalist: 0.15, // Below 0.2 threshold
      marsIndependence: 0.5,
      corporateInterests: 0.3,
      conviction: 0.3,
    });

    ideologyManager.boostFactionConviction(NPCFaction.EarthLoyalists, 0.1, [colonist]);

    expect(colonist.ideology?.conviction).toBe(0.3); // Unchanged
  });

  test("boostFactionConviction affects multiple aligned colonists", () => {
    const colonists = [
      createTestColonist("c1", "Strong Supporter", {
        earthLoyalist: 0.8,
        marsIndependence: 0.1,
        corporateInterests: 0.1,
        conviction: 0.3,
      }),
      createTestColonist("c2", "Moderate Supporter", {
        earthLoyalist: 0.4,
        marsIndependence: 0.3,
        corporateInterests: 0.3,
        conviction: 0.5,
      }),
      createTestColonist("c3", "Not Aligned", {
        earthLoyalist: 0.1,
        marsIndependence: 0.6,
        corporateInterests: 0.3,
        conviction: 0.4,
      }),
    ];

    ideologyManager.boostFactionConviction(NPCFaction.EarthLoyalists, 0.15, colonists);

    expect(colonists[0]?.ideology?.conviction).toBeCloseTo(0.45, 2);
    expect(colonists[1]?.ideology?.conviction).toBeCloseTo(0.65, 2);
    expect(colonists[2]?.ideology?.conviction).toBe(0.4); // Unchanged
  });

  test("boostFactionConviction caps conviction at 1.0", () => {
    const colonist = createTestColonist("c1", "High Conviction", {
      earthLoyalist: 0.8,
      marsIndependence: 0.1,
      corporateInterests: 0.1,
      conviction: 0.95,
    });

    ideologyManager.boostFactionConviction(NPCFaction.EarthLoyalists, 0.2, [colonist]);

    expect(colonist.ideology?.conviction).toBe(1.0);
  });

  test("boostFactionConviction works for MarsIndependence faction", () => {
    const colonist = createTestColonist("c1", "Mars Supporter", {
      earthLoyalist: 0.1,
      marsIndependence: 0.7,
      corporateInterests: 0.2,
      conviction: 0.3,
    });

    ideologyManager.boostFactionConviction(NPCFaction.MarsIndependence, 0.1, [colonist]);

    expect(colonist.ideology?.conviction).toBeCloseTo(0.4, 2);
  });

  test("boostFactionConviction works for CorporateInterests faction", () => {
    const colonist = createTestColonist("c1", "Corporate Supporter", {
      earthLoyalist: 0.1,
      marsIndependence: 0.2,
      corporateInterests: 0.6,
      conviction: 0.3,
    });

    ideologyManager.boostFactionConviction(NPCFaction.CorporateInterests, 0.1, [colonist]);

    expect(colonist.ideology?.conviction).toBeCloseTo(0.4, 2);
  });

  test("boostFactionConviction skips colonists without ideology", () => {
    const colonistWithIdeology = createTestColonist("c1", "With Ideology", {
      earthLoyalist: 0.8,
      marsIndependence: 0.1,
      corporateInterests: 0.1,
      conviction: 0.3,
    });
    const colonistWithoutIdeology: Colonist = {
      id: "c2",
      name: "Without Ideology",
      role: ColonistRole.UNASSIGNED,
      experience: 0,
      masteryLevel: MasteryLevel.NOVICE,
      skills: [],
      // No ideology field
    };

    // Should not throw
    ideologyManager.boostFactionConviction(NPCFaction.EarthLoyalists, 0.1, [
      colonistWithIdeology,
      colonistWithoutIdeology,
    ]);

    expect(colonistWithIdeology.ideology?.conviction).toBeCloseTo(0.4, 2);
    expect(colonistWithoutIdeology.ideology).toBeUndefined();
  });
});

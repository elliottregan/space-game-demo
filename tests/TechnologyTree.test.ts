import { describe, it, expect, beforeEach } from "bun:test";
import { TechnologyTree } from "../src/core/systems/TechnologyTree";
import { ResourceManager } from "../src/core/systems/ResourceManager";
import { TECHNOLOGIES } from "../src/core/data/technologies";
import { TechnologyId } from "../src/core/models/Technology";

describe("TechnologyTree", () => {
  let tree: TechnologyTree;
  let resources: ResourceManager;

  beforeEach(() => {
    tree = new TechnologyTree(TECHNOLOGIES);
    resources = new ResourceManager({
      food: 500,
      water: 500,

      materials: 500,
    });
  });

  it("should allow researching techs with no prerequisites", () => {
    expect(tree.canResearch(TechnologyId.HYDROPONICS)).toBe(true);
    expect(tree.canResearch(TechnologyId.WATER_RECYCLING)).toBe(true);
    expect(tree.canResearch(TechnologyId.ADVANCED_MATERIALS)).toBe(true);
  });

  it("should not allow researching techs with unmet prerequisites", () => {
    expect(tree.canResearch(TechnologyId.ROBOTICS)).toBe(false);
    expect(tree.canResearch(TechnologyId.ASTEROID_MINING_PLATFORM)).toBe(false);
  });

  it("should start research", () => {
    const result = tree.startResearch(TechnologyId.HYDROPONICS, resources);
    expect(result).toBe(true);
    expect(tree.getCurrentResearch()).not.toBeNull();
    expect(tree.getCurrentResearch()?.techId).toBe(TechnologyId.HYDROPONICS);
  });

  it("should not allow multiple simultaneous research", () => {
    tree.startResearch(TechnologyId.HYDROPONICS, resources);
    const result = tree.startResearch(TechnologyId.WATER_RECYCLING, resources);
    expect(result).toBe(false);
  });

  it("should complete research after required sols", () => {
    tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

    const tech = tree.getTech(TechnologyId.WATER_RECYCLING)!;
    for (let i = 0; i < tech.cost.sols; i++) {
      tree.tick();
    }

    expect(tree.isResearched(TechnologyId.WATER_RECYCLING)).toBe(true);
    expect(tree.getCurrentResearch()).toBeNull();
  });

  it("should emit event on research completion", () => {
    tree.startResearch(TechnologyId.WATER_RECYCLING, resources);

    const tech = tree.getTech(TechnologyId.WATER_RECYCLING)!;
    let events: any[] = [];
    for (let i = 0; i < tech.cost.sols; i++) {
      events = tree.tick();
    }

    const completeEvent = events.find((e) => e.type === "RESEARCH_COMPLETE");
    expect(completeEvent).toBeDefined();
    expect(completeEvent?.techId).toBe(TechnologyId.WATER_RECYCLING);
  });

  it("should allow researching dependent tech after prerequisite is complete", () => {
    tree.startResearch(TechnologyId.ADVANCED_MATERIALS, resources);

    const tech = tree.getTech(TechnologyId.ADVANCED_MATERIALS)!;
    for (let i = 0; i < tech.cost.sols; i++) {
      tree.tick();
    }

    expect(tree.canResearch(TechnologyId.ROBOTICS)).toBe(true);
  });

  describe("Research Queue", () => {
    it("should track progress per tech in a map", () => {
      tree.startResearch(TechnologyId.HYDROPONICS, resources);

      // Advance 10 sols
      for (let i = 0; i < 10; i++) {
        tree.tick();
      }

      expect(tree.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(10);
    });

    it("should increment progress in the map during tick", () => {
      tree.startResearch(TechnologyId.HYDROPONICS, resources);
      tree.tick();
      tree.tick();

      expect(tree.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(2);
      expect(tree.getCurrentResearchId()).toBe(TechnologyId.HYDROPONICS);
    });

    it("should set currentResearchId and add to queue on startResearch", () => {
      tree.startResearch(TechnologyId.HYDROPONICS, resources);

      expect(tree.getCurrentResearchId()).toBe(TechnologyId.HYDROPONICS);
      expect(tree.getResearchQueue()).toEqual([TechnologyId.HYDROPONICS]);
    });

    it("should resume progress if tech was partially researched before", () => {
      tree.startResearch(TechnologyId.HYDROPONICS, resources);

      // Advance 10 sols
      for (let i = 0; i < 10; i++) {
        tree.tick();
      }

      // Cancel (simulate changing target)
      tree.cancelResearch();
      expect(tree.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(10);

      // Start again - should resume
      tree.startResearch(TechnologyId.HYDROPONICS, resources);
      expect(tree.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(10);
    });

    it("should preserve progress when cancelling research", () => {
      tree.startResearch(TechnologyId.HYDROPONICS, resources);

      for (let i = 0; i < 20; i++) {
        tree.tick();
      }

      tree.cancelResearch();

      expect(tree.getCurrentResearchId()).toBeNull();
      expect(tree.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(20);
      expect(tree.getResearchQueue()).toEqual([]);
    });

    it("should return prerequisite chain in topological order", () => {
      // asteroid_mining_platform needs: asteroid_mining, robotics
      // asteroid_mining needs: advanced_materials
      // robotics needs: advanced_materials

      const chain = tree.getPrerequisiteChain(TechnologyId.ASTEROID_MINING_PLATFORM);

      // Should include all unresearched prerequisites + target
      expect(chain).toContain(TechnologyId.ASTEROID_MINING_PLATFORM);
      expect(chain).toContain(TechnologyId.ASTEROID_MINING);
      expect(chain).toContain(TechnologyId.ROBOTICS);
      expect(chain).toContain(TechnologyId.ADVANCED_MATERIALS);

      // Prerequisites must come before dependents
      expect(chain.indexOf(TechnologyId.ADVANCED_MATERIALS)).toBeLessThan(
        chain.indexOf(TechnologyId.ASTEROID_MINING),
      );
      expect(chain.indexOf(TechnologyId.ADVANCED_MATERIALS)).toBeLessThan(
        chain.indexOf(TechnologyId.ROBOTICS),
      );
      expect(chain.indexOf(TechnologyId.ASTEROID_MINING)).toBeLessThan(
        chain.indexOf(TechnologyId.ASTEROID_MINING_PLATFORM),
      );
      expect(chain.indexOf(TechnologyId.ROBOTICS)).toBeLessThan(
        chain.indexOf(TechnologyId.ASTEROID_MINING_PLATFORM),
      );
    });

    it("should exclude already researched techs from chain", () => {
      // Research hydroponics first
      tree.startResearch(TechnologyId.HYDROPONICS, resources);
      const tech = tree.getTech(TechnologyId.HYDROPONICS)!;
      for (let i = 0; i < tech.cost.sols; i++) {
        tree.tick();
      }

      const chain = tree.getPrerequisiteChain(TechnologyId.GENETICS);

      expect(chain).not.toContain(TechnologyId.HYDROPONICS);
      expect(chain).toEqual([TechnologyId.GENETICS]);
    });

    it("should queue all prerequisites when calling queueResearch on locked tech", () => {
      // genetics needs hydroponics
      tree.queueResearch(TechnologyId.GENETICS, resources);

      expect(tree.getResearchQueue()).toEqual([TechnologyId.HYDROPONICS, TechnologyId.GENETICS]);
      expect(tree.getCurrentResearchId()).toBe(TechnologyId.HYDROPONICS);
    });

    it("should merge queues when changing target", () => {
      // Start with genetics (needs hydroponics)
      tree.queueResearch(TechnologyId.GENETICS, resources);
      expect(tree.getResearchQueue()).toEqual([TechnologyId.HYDROPONICS, TechnologyId.GENETICS]);

      // Advance hydroponics 10 sols
      for (let i = 0; i < 10; i++) {
        tree.tick();
      }
      expect(tree.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(10);

      // Change to advanced_medicine (needs hydroponics, genetics, advanced_medicine)
      tree.queueResearch(TechnologyId.ADVANCED_MEDICINE, resources);

      // hydroponics still in queue (shared), genetics still needed, advanced_medicine added
      expect(tree.getResearchQueue()).toEqual([
        TechnologyId.HYDROPONICS,
        TechnologyId.GENETICS,
        TechnologyId.ADVANCED_MEDICINE,
      ]);
      // Progress preserved
      expect(tree.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(10);
    });

    it("should remove techs not in new chain when changing target", () => {
      // Start with robotics (needs advanced_materials)
      tree.queueResearch(TechnologyId.ROBOTICS, resources);
      expect(tree.getResearchQueue()).toEqual([
        TechnologyId.ADVANCED_MATERIALS,
        TechnologyId.ROBOTICS,
      ]);

      // Change to genetics (needs hydroponics)
      tree.queueResearch(TechnologyId.GENETICS, resources);

      // robotics and advanced_materials removed, new chain used
      expect(tree.getResearchQueue()).toEqual([TechnologyId.HYDROPONICS, TechnologyId.GENETICS]);
    });

    it("should auto-start next tech in queue when current completes", () => {
      tree.queueResearch(TechnologyId.GENETICS, resources);
      expect(tree.getResearchQueue()).toEqual([TechnologyId.HYDROPONICS, TechnologyId.GENETICS]);

      // Complete hydroponics (60 sols)
      const hydroTech = tree.getTech(TechnologyId.HYDROPONICS)!;
      for (let i = 0; i < hydroTech.cost.sols; i++) {
        tree.tick(resources);
      }

      expect(tree.isResearched(TechnologyId.HYDROPONICS)).toBe(true);
      expect(tree.getCurrentResearchId()).toBe(TechnologyId.GENETICS);
      expect(tree.getResearchQueue()).toEqual([TechnologyId.GENETICS]);
    });

    it("should pause queue if resources insufficient for next tech", () => {
      // asteroid_mining costs 200 materials
      // Set up: research advanced_materials and robotics first
      tree.queueResearch(TechnologyId.ROBOTICS, resources);

      // Complete advanced_materials
      const amTech = tree.getTech(TechnologyId.ADVANCED_MATERIALS)!;
      for (let i = 0; i < amTech.cost.sols; i++) {
        tree.tick(resources);
      }

      // Complete robotics
      const robTech = tree.getTech(TechnologyId.ROBOTICS)!;
      for (let i = 0; i < robTech.cost.sols; i++) {
        tree.tick(resources);
      }

      // Now queue asteroid_mining with insufficient resources
      const poorResources = new ResourceManager({
        food: 100,
        water: 100,

        materials: 50,
      });

      tree.queueResearch(TechnologyId.ASTEROID_MINING, poorResources);

      // Queue is set but nothing is researching (waiting for resources)
      expect(tree.getResearchQueue()).toEqual([TechnologyId.ASTEROID_MINING]);
      expect(tree.getCurrentResearchId()).toBeNull();
    });

    it("should return TechResearch object from getCurrentResearch for compatibility", () => {
      tree.startResearch(TechnologyId.HYDROPONICS, resources);

      for (let i = 0; i < 10; i++) {
        tree.tick();
      }

      const research = tree.getCurrentResearch();
      expect(research).not.toBeNull();
      expect(research?.techId).toBe(TechnologyId.HYDROPONICS);
      expect(research?.progress).toBe(10);
      expect(research?.requiredSols).toBe(45);
    });

    it("should serialize and restore queue and progress", () => {
      tree.queueResearch(TechnologyId.GENETICS, resources);

      // Advance 15 sols
      for (let i = 0; i < 15; i++) {
        tree.tick();
      }

      const json = tree.toJSON();
      const restored = TechnologyTree.fromJSON(json, TECHNOLOGIES);

      expect(restored.getCurrentResearchId()).toBe(TechnologyId.HYDROPONICS);
      expect(restored.getResearchProgress(TechnologyId.HYDROPONICS)).toBe(15);
      expect(restored.getResearchQueue()).toEqual([
        TechnologyId.HYDROPONICS,
        TechnologyId.GENETICS,
      ]);
    });
  });
});

// tests/WorkforceManager.test.ts
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { SkillId } from "../src/core/data/skills";
import { ColonistRole, MasteryLevel, type Colonist } from "../src/core/models/Colonist";
import { WorkforceManager } from "../src/core/systems/WorkforceManager";
import {
  MASTERY_THRESHOLDS,
  EXPERIENCE_GAIN_RATE,
  ROLE_AFFINITY,
  MASTERY_EFFICIENCY,
  MAX_SKILL_EFFICIENCY_BONUS,
  COWORKER_BONDING_RATE,
  INITIAL_COWORKER_RELATIONSHIP,
  HOUSEMATE_BONDING_RATE,
  INITIAL_HOUSEMATE_RELATIONSHIP,
  MAX_COWORKER_RELATIONSHIP,
  COWORKER_RELATIONSHIP_DECAY,
  TEAM_COHESION_THRESHOLD,
  MAX_TEAM_COHESION_BONUS,
} from "../src/core/balance/WorkforceBalance";

// Helper to create test colonists
const createColonist = (overrides: Partial<Colonist> = {}): Colonist => ({
  id: "test_1",
  name: "Test Colonist",
  role: ColonistRole.UNASSIGNED,
  experience: 0,
  masteryLevel: MasteryLevel.NOVICE,
  skills: [],
  ...overrides,
});

// Mock ColonyManager for tick()
const mockColony = (colonists: Colonist[]) => ({
  getColonists: () => colonists,
});

// Mock BuildingManager for coworker tests
const mockBuildings = (buildings: { id: string; status: string; assignedWorkers: string[] }[]) => ({
  getBuildings: () => buildings,
});

describe("WorkforceManager", () => {
  let workforce: WorkforceManager;

  beforeEach(() => {
    workforce = new WorkforceManager();
  });

  // ==========================================================================
  // startTraining() tests
  // ==========================================================================
  describe("startTraining()", () => {
    it("should return true for valid training (different role)", () => {
      const colonist = createColonist({ role: ColonistRole.UNASSIGNED });
      const result = workforce.startTraining(colonist, ColonistRole.ENGINEERING);

      expect(result).toBe(true);
      expect(colonist.trainingTarget).toBe(ColonistRole.ENGINEERING);
      expect(colonist.trainingProgress).toBe(0);
    });

    it("should return false when same role", () => {
      const colonist = createColonist({ role: ColonistRole.ENGINEERING });
      const result = workforce.startTraining(colonist, ColonistRole.ENGINEERING);

      expect(result).toBe(false);
      expect(colonist.trainingTarget).toBeUndefined();
    });

    it("should return false when already training", () => {
      const colonist = createColonist({
        role: ColonistRole.UNASSIGNED,
        trainingTarget: ColonistRole.RESEARCH,
        trainingProgress: 2,
      });
      const result = workforce.startTraining(colonist, ColonistRole.ENGINEERING);

      expect(result).toBe(false);
      expect(colonist.trainingTarget).toBe(ColonistRole.RESEARCH);
    });

    it("should return false when target is UNASSIGNED", () => {
      const colonist = createColonist({ role: ColonistRole.ENGINEERING });
      const result = workforce.startTraining(colonist, ColonistRole.UNASSIGNED);

      expect(result).toBe(false);
      expect(colonist.trainingTarget).toBeUndefined();
    });

    it("should set trainingTarget and trainingProgress=0", () => {
      const colonist = createColonist({ role: ColonistRole.UNASSIGNED });
      workforce.startTraining(colonist, ColonistRole.FARMING);

      expect(colonist.trainingTarget).toBe(ColonistRole.FARMING);
      expect(colonist.trainingProgress).toBe(0);
    });
  });

  // ==========================================================================
  // cancelTraining() tests
  // ==========================================================================
  describe("cancelTraining()", () => {
    it("should clear trainingTarget and trainingProgress", () => {
      const colonist = createColonist({
        role: ColonistRole.UNASSIGNED,
        trainingTarget: ColonistRole.RESEARCH,
        trainingProgress: 3,
      });

      workforce.cancelTraining(colonist);

      expect(colonist.trainingTarget).toBeUndefined();
      expect(colonist.trainingProgress).toBeUndefined();
    });

    it("should work when colonist is training", () => {
      const colonist = createColonist({ role: ColonistRole.UNASSIGNED });
      workforce.startTraining(colonist, ColonistRole.ENGINEERING);

      workforce.cancelTraining(colonist);

      expect(colonist.trainingTarget).toBeUndefined();
      expect(colonist.trainingProgress).toBeUndefined();
    });

    it("should be no-op when not training", () => {
      const colonist = createColonist({ role: ColonistRole.ENGINEERING });

      // Should not throw
      workforce.cancelTraining(colonist);

      expect(colonist.trainingTarget).toBeUndefined();
      expect(colonist.trainingProgress).toBeUndefined();
    });
  });

  // ==========================================================================
  // getTrainingTime() tests
  // ==========================================================================
  describe("getTrainingTime()", () => {
    it("should return correct affinity (RESEARCH -> CIVIL_SCIENCE = 3)", () => {
      const time = workforce.getTrainingTime(ColonistRole.RESEARCH, ColonistRole.CIVIL_SCIENCE);
      expect(time).toBe(ROLE_AFFINITY[ColonistRole.RESEARCH]![ColonistRole.CIVIL_SCIENCE]!);
      expect(time).toBe(3);
    });

    it("should return correct affinity (UNASSIGNED -> any = 5)", () => {
      const timeToEngineering = workforce.getTrainingTime(ColonistRole.UNASSIGNED, ColonistRole.ENGINEERING);
      const timeToResearch = workforce.getTrainingTime(ColonistRole.UNASSIGNED, ColonistRole.RESEARCH);
      const timeToFarming = workforce.getTrainingTime(ColonistRole.UNASSIGNED, ColonistRole.FARMING);

      expect(timeToEngineering).toBe(5);
      expect(timeToResearch).toBe(5);
      expect(timeToFarming).toBe(5);
    });

    it("should return default (10) for undefined affinity", () => {
      // RESEARCH -> UNASSIGNED is not defined in ROLE_AFFINITY
      const time = workforce.getTrainingTime(ColonistRole.RESEARCH, ColonistRole.UNASSIGNED);
      expect(time).toBe(10);
    });

    it("should return different values for different role pairs", () => {
      const researchToEngineering = workforce.getTrainingTime(ColonistRole.RESEARCH, ColonistRole.ENGINEERING);
      const researchToFarming = workforce.getTrainingTime(ColonistRole.RESEARCH, ColonistRole.FARMING);
      const engineeringToFarming = workforce.getTrainingTime(ColonistRole.ENGINEERING, ColonistRole.FARMING);

      expect(researchToEngineering).toBe(7);
      expect(researchToFarming).toBe(10);
      expect(engineeringToFarming).toBe(4);
    });
  });

  // ==========================================================================
  // Training Progression via tick() tests
  // ==========================================================================
  describe("Training Progression via tick()", () => {
    it("should increment trainingProgress each tick", () => {
      const colonist = createColonist({ role: ColonistRole.UNASSIGNED });
      workforce.startTraining(colonist, ColonistRole.ENGINEERING);

      const colony = mockColony([colonist]);
      workforce.tick(colony as any);

      expect(colonist.trainingProgress).toBe(1);

      workforce.tick(colony as any);
      expect(colonist.trainingProgress).toBe(2);
    });

    it("should emit TRAINING_COMPLETE when training finishes", () => {
      const colonist = createColonist({ role: ColonistRole.UNASSIGNED });
      workforce.startTraining(colonist, ColonistRole.ENGINEERING);
      colonist.trainingProgress = 4; // One away from completion (5 required)

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      const completeEvent = events.find((e) => e.type === "TRAINING_COMPLETE");
      expect(completeEvent).toBeDefined();
      expect(completeEvent?.colonistId).toBe("test_1");
      expect(completeEvent?.newRole).toBe(ColonistRole.ENGINEERING);
    });

    it("should update colonist.role on completion", () => {
      const colonist = createColonist({ role: ColonistRole.UNASSIGNED });
      workforce.startTraining(colonist, ColonistRole.RESEARCH);
      colonist.trainingProgress = 4; // One tick from completion

      const colony = mockColony([colonist]);
      workforce.tick(colony as any);

      expect(colonist.role).toBe(ColonistRole.RESEARCH);
    });

    it("should reset experience and mastery to 0/NOVICE on completion", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        experience: 50,
        masteryLevel: MasteryLevel.EXPERT,
      });
      workforce.startTraining(colonist, ColonistRole.RESEARCH);
      colonist.trainingProgress = 6; // One tick from completion (ENGINEERING->RESEARCH = 7)

      const colony = mockColony([colonist]);
      workforce.tick(colony as any);

      // After training completes, colonist gains XP for new role in same tick
      // So experience is 0 + 0.5 = 0.5
      expect(colonist.experience).toBe(EXPERIENCE_GAIN_RATE);
      expect(colonist.masteryLevel).toBe(MasteryLevel.NOVICE);
    });

    it("should clear training state on completion", () => {
      const colonist = createColonist({ role: ColonistRole.UNASSIGNED });
      workforce.startTraining(colonist, ColonistRole.FARMING);
      colonist.trainingProgress = 4; // One tick from completion

      const colony = mockColony([colonist]);
      workforce.tick(colony as any);

      expect(colonist.trainingTarget).toBeUndefined();
      expect(colonist.trainingProgress).toBeUndefined();
    });
  });

  // ==========================================================================
  // Experience & Mastery tests
  // ==========================================================================
  describe("Experience & Mastery", () => {
    it("should gain 0.5 XP per tick when working", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        experience: 0,
      });

      const colony = mockColony([colonist]);
      workforce.tick(colony as any);

      expect(colonist.experience).toBe(EXPERIENCE_GAIN_RATE);
      expect(colonist.experience).toBe(0.5);
    });

    it("should not gain XP when UNASSIGNED", () => {
      const colonist = createColonist({
        role: ColonistRole.UNASSIGNED,
        experience: 0,
      });

      const colony = mockColony([colonist]);
      workforce.tick(colony as any);

      expect(colonist.experience).toBe(0);
    });

    it("should not gain XP when training", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        experience: 10,
      });
      workforce.startTraining(colonist, ColonistRole.RESEARCH);

      const colony = mockColony([colonist]);
      workforce.tick(colony as any);

      // Experience should not increase while training
      // (training increment happens, but XP gain is skipped)
      expect(colonist.experience).toBe(10);
    });

    it("should level to SKILLED at 25 XP", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        experience: 24.5,
        masteryLevel: MasteryLevel.NOVICE,
      });

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      expect(colonist.experience).toBe(25);
      expect(colonist.masteryLevel).toBe(MasteryLevel.SKILLED);

      const masteryEvent = events.find((e) => e.type === "MASTERY_GAINED");
      expect(masteryEvent).toBeDefined();
      expect(masteryEvent?.newLevel).toBe("Skilled");
    });

    it("should level to EXPERT at 50 XP", () => {
      const colonist = createColonist({
        role: ColonistRole.RESEARCH,
        experience: 49.5,
        masteryLevel: MasteryLevel.SKILLED,
      });

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      expect(colonist.experience).toBe(50);
      expect(colonist.masteryLevel).toBe(MasteryLevel.EXPERT);

      const masteryEvent = events.find((e) => e.type === "MASTERY_GAINED");
      expect(masteryEvent).toBeDefined();
      expect(masteryEvent?.newLevel).toBe("Expert");
    });

    it("should level to MASTER at 75 XP", () => {
      const colonist = createColonist({
        role: ColonistRole.FARMING,
        experience: 74.5,
        masteryLevel: MasteryLevel.EXPERT,
      });

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      expect(colonist.experience).toBe(75);
      expect(colonist.masteryLevel).toBe(MasteryLevel.MASTER);

      const masteryEvent = events.find((e) => e.type === "MASTERY_GAINED");
      expect(masteryEvent).toBeDefined();
      expect(masteryEvent?.newLevel).toBe("Master");
    });

    it("should emit MASTERY_GAINED event on level up", () => {
      const colonist = createColonist({
        role: ColonistRole.CIVIL_SCIENCE,
        experience: 24.5,
        masteryLevel: MasteryLevel.NOVICE,
      });

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      const masteryEvent = events.find((e) => e.type === "MASTERY_GAINED");
      expect(masteryEvent).toBeDefined();
      expect(masteryEvent?.colonistId).toBe("test_1");
      expect(masteryEvent?.colonistName).toBe("Test Colonist");
      expect(masteryEvent?.role).toBe(ColonistRole.CIVIL_SCIENCE);
      expect(masteryEvent?.severity).toBe("info");
    });
  });

  // ==========================================================================
  // Master Breakthrough tests
  // ==========================================================================
  describe("Master Breakthrough", () => {
    let originalRandom: typeof Math.random;

    beforeEach(() => {
      originalRandom = Math.random;
    });

    afterEach(() => {
      Math.random = originalRandom;
    });

    it("should not trigger breakthrough for non-MASTER colonists", () => {
      Math.random = () => 0.001; // Would trigger if colonist was MASTER

      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        experience: 40,
        masteryLevel: MasteryLevel.SKILLED,
      });

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      const breakthroughEvent = events.find((e) => e.type === "MASTER_BREAKTHROUGH");
      expect(breakthroughEvent).toBeUndefined();
    });

    it("should trigger breakthrough when Math.random is below MASTER_EVENT_CHANCE", () => {
      Math.random = () => 0.001; // Below 0.01 threshold

      const colonist = createColonist({
        role: ColonistRole.RESEARCH,
        experience: 80,
        masteryLevel: MasteryLevel.MASTER,
      });

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      const breakthroughEvent = events.find((e) => e.type === "MASTER_BREAKTHROUGH");
      expect(breakthroughEvent).toBeDefined();
    });

    it("should include correct colonist info in breakthrough event", () => {
      Math.random = () => 0.005;

      const colonist = createColonist({
        id: "master_1",
        name: "Dr. Expert",
        role: ColonistRole.CIVIL_SCIENCE,
        experience: 100,
        masteryLevel: MasteryLevel.MASTER,
      });

      const colony = mockColony([colonist]);
      const events = workforce.tick(colony as any);

      const breakthroughEvent = events.find((e) => e.type === "MASTER_BREAKTHROUGH");
      expect(breakthroughEvent).toBeDefined();
      expect(breakthroughEvent?.colonistId).toBe("master_1");
      expect(breakthroughEvent?.colonistName).toBe("Dr. Expert");
      expect(breakthroughEvent?.role).toBe(ColonistRole.CIVIL_SCIENCE);
      expect(breakthroughEvent?.severity).toBe("info");
    });
  });

  // ==========================================================================
  // Helper Methods tests
  // ==========================================================================
  describe("Helper Methods", () => {
    describe("getRoleName()", () => {
      it("should return 'Unassigned' for UNASSIGNED", () => {
        expect(workforce.getRoleName(ColonistRole.UNASSIGNED)).toBe("Unassigned");
      });

      it("should return 'Researcher' for RESEARCH", () => {
        expect(workforce.getRoleName(ColonistRole.RESEARCH)).toBe("Researcher");
      });

      it("should return 'Engineer' for ENGINEERING", () => {
        expect(workforce.getRoleName(ColonistRole.ENGINEERING)).toBe("Engineer");
      });

      it("should return 'Civil Scientist' for CIVIL_SCIENCE", () => {
        expect(workforce.getRoleName(ColonistRole.CIVIL_SCIENCE)).toBe("Civil Scientist");
      });

      it("should return 'Farmer' for FARMING", () => {
        expect(workforce.getRoleName(ColonistRole.FARMING)).toBe("Farmer");
      });
    });

    describe("getMasteryName()", () => {
      it("should return 'Novice' for NOVICE", () => {
        expect(workforce.getMasteryName(MasteryLevel.NOVICE)).toBe("Novice");
      });

      it("should return 'Skilled' for SKILLED", () => {
        expect(workforce.getMasteryName(MasteryLevel.SKILLED)).toBe("Skilled");
      });

      it("should return 'Expert' for EXPERT", () => {
        expect(workforce.getMasteryName(MasteryLevel.EXPERT)).toBe("Expert");
      });

      it("should return 'Master' for MASTER", () => {
        expect(workforce.getMasteryName(MasteryLevel.MASTER)).toBe("Master");
      });
    });

    describe("calculateMasteryLevel()", () => {
      it("should return NOVICE for experience 0", () => {
        expect(workforce.calculateMasteryLevel(0)).toBe(MasteryLevel.NOVICE);
      });

      it("should return NOVICE for experience 24", () => {
        expect(workforce.calculateMasteryLevel(24)).toBe(MasteryLevel.NOVICE);
      });

      it("should return SKILLED for experience 25", () => {
        expect(workforce.calculateMasteryLevel(25)).toBe(MasteryLevel.SKILLED);
      });

      it("should return SKILLED for experience 49", () => {
        expect(workforce.calculateMasteryLevel(49)).toBe(MasteryLevel.SKILLED);
      });

      it("should return EXPERT for experience 50", () => {
        expect(workforce.calculateMasteryLevel(50)).toBe(MasteryLevel.EXPERT);
      });

      it("should return EXPERT for experience 74", () => {
        expect(workforce.calculateMasteryLevel(74)).toBe(MasteryLevel.EXPERT);
      });

      it("should return MASTER for experience 75", () => {
        expect(workforce.calculateMasteryLevel(75)).toBe(MasteryLevel.MASTER);
      });

      it("should return MASTER for experience 100", () => {
        expect(workforce.calculateMasteryLevel(100)).toBe(MasteryLevel.MASTER);
      });
    });
  });

  // ==========================================================================
  // getWorkforceStats() tests
  // ==========================================================================
  describe("getWorkforceStats()", () => {
    it("should return correct role counts", () => {
      const colonists = [
        createColonist({ id: "1", role: ColonistRole.ENGINEERING }),
        createColonist({ id: "2", role: ColonistRole.ENGINEERING }),
        createColonist({ id: "3", role: ColonistRole.RESEARCH }),
        createColonist({ id: "4", role: ColonistRole.UNASSIGNED }),
        createColonist({ id: "5", role: ColonistRole.FARMING }),
      ];

      const colony = mockColony(colonists);
      const stats = workforce.getWorkforceStats(colony as any);

      expect(stats[ColonistRole.ENGINEERING]).toBe(2);
      expect(stats[ColonistRole.RESEARCH]).toBe(1);
      expect(stats[ColonistRole.UNASSIGNED]).toBe(1);
      expect(stats[ColonistRole.FARMING]).toBe(1);
      expect(stats[ColonistRole.CIVIL_SCIENCE]).toBe(0);
    });

    it("should return zeros for empty colony", () => {
      const colony = mockColony([]);
      const stats = workforce.getWorkforceStats(colony as any);

      expect(stats[ColonistRole.UNASSIGNED]).toBe(0);
      expect(stats[ColonistRole.RESEARCH]).toBe(0);
      expect(stats[ColonistRole.ENGINEERING]).toBe(0);
      expect(stats[ColonistRole.CIVIL_SCIENCE]).toBe(0);
      expect(stats[ColonistRole.FARMING]).toBe(0);
    });

    it("should count by current role, not trainingTarget", () => {
      const colonists = [
        createColonist({
          id: "1",
          role: ColonistRole.UNASSIGNED,
          trainingTarget: ColonistRole.ENGINEERING,
          trainingProgress: 2,
        }),
        createColonist({
          id: "2",
          role: ColonistRole.RESEARCH,
          trainingTarget: ColonistRole.FARMING,
          trainingProgress: 5,
        }),
      ];

      const colony = mockColony(colonists);
      const stats = workforce.getWorkforceStats(colony as any);

      // Should count by current role, not training target
      expect(stats[ColonistRole.UNASSIGNED]).toBe(1);
      expect(stats[ColonistRole.RESEARCH]).toBe(1);
      expect(stats[ColonistRole.ENGINEERING]).toBe(0);
      expect(stats[ColonistRole.FARMING]).toBe(0);
    });
  });

  // ==========================================================================
  // getColonistEfficiency() tests
  // ==========================================================================
  describe("getColonistEfficiency()", () => {
    it("should return base mastery efficiency for colonist with no skills", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [],
      });

      const efficiency = workforce.getColonistEfficiency(colonist);
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]!);
    });

    it("should return higher efficiency for higher mastery levels", () => {
      const novice = createColonist({ role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.NOVICE, skills: [] });
      const skilled = createColonist({ role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.SKILLED, skills: [] });
      const expert = createColonist({ role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.EXPERT, skills: [] });
      const master = createColonist({ role: ColonistRole.RESEARCH, masteryLevel: MasteryLevel.MASTER, skills: [] });

      expect(workforce.getColonistEfficiency(novice)).toBe(0.7);
      expect(workforce.getColonistEfficiency(skilled)).toBe(1.0);
      expect(workforce.getColonistEfficiency(expert)).toBe(1.3);
      expect(workforce.getColonistEfficiency(master)).toBe(1.6);
    });

    it("should add skill bonus for matching skill", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [SkillId.JURY_RIGGER], // +15% for Engineering
      });

      const efficiency = workforce.getColonistEfficiency(colonist);
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]! + 0.15);
    });

    it("should not add bonus for non-matching skill", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [SkillId.GREEN_THUMB], // Farming skill, not Engineering
      });

      const efficiency = workforce.getColonistEfficiency(colonist);
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]!);
    });

    it("should cap skill bonus at MAX_SKILL_EFFICIENCY_BONUS", () => {
      const colonist = createColonist({
        role: ColonistRole.ENGINEERING,
        masteryLevel: MasteryLevel.NOVICE,
        skills: [SkillId.JURY_RIGGER, SkillId.CALM_UNDER_PRESSURE], // +15% + +10% = +25%, but capped at +20%
      });

      const efficiency = workforce.getColonistEfficiency(colonist);
      expect(efficiency).toBe(MASTERY_EFFICIENCY[MasteryLevel.NOVICE]! + MAX_SKILL_EFFICIENCY_BONUS);
    });
  });

  // ==========================================================================
  // Coworker Relationship System tests
  // ==========================================================================
  describe("Coworker Relationship System", () => {
    describe("processCoworkerBonding()", () => {
      it("should create relationship when two colonists work together", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
          createColonist({ id: "c2", role: ColonistRole.ENGINEERING }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, buildings as any, 1);

        const bondEvent = events.find((e) => e.type === "COWORKER_BOND_FORMED");
        expect(bondEvent).toBeDefined();
        expect(bondEvent?.colonistA).toBe("c1");
        expect(bondEvent?.colonistB).toBe("c2");

        const relationship = workforce.getCoworkerRelationship("c1", "c2");
        expect(relationship).toBeDefined();
        expect(relationship?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP);
        expect(relationship?.formedAt).toBe(1);
      });

      it("should strengthen relationship over multiple ticks", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.RESEARCH }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);
        workforce.tick(colony as any, buildings as any, 1);
        workforce.tick(colony as any, buildings as any, 2);
        workforce.tick(colony as any, buildings as any, 3);

        const relationship = workforce.getCoworkerRelationship("c1", "c2");
        expect(relationship?.strength).toBeCloseTo(
          INITIAL_COWORKER_RELATIONSHIP + COWORKER_BONDING_RATE * 2,
          6
        );
      });

      it("should not create relationship for solo worker", () => {
        const colonists = [createColonist({ id: "c1", role: ColonistRole.ENGINEERING })];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1"] },
        ]);

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, buildings as any, 1);

        const bondEvent = events.find((e) => e.type === "COWORKER_BOND_FORMED");
        expect(bondEvent).toBeUndefined();
      });

      it("should not create relationship for inactive building", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
          createColonist({ id: "c2", role: ColonistRole.ENGINEERING }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "disabled", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, buildings as any, 1);

        const bondEvent = events.find((e) => e.type === "COWORKER_BOND_FORMED");
        expect(bondEvent).toBeUndefined();
      });

      it("should decay relationships when colonists stop working together", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
          createColonist({ id: "c2", role: ColonistRole.ENGINEERING }),
        ];
        const buildingsTogether = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);
        const buildingsSeparate = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1"] },
          { id: "b2", status: "active", assignedWorkers: ["c2"] },
        ]);

        const colony = mockColony(colonists);

        // Work together first
        workforce.tick(colony as any, buildingsTogether as any, 1);
        const initialStrength = workforce.getCoworkerRelationshipStrength("c1", "c2");

        // Now separate
        workforce.tick(colony as any, buildingsSeparate as any, 2);
        const decayedStrength = workforce.getCoworkerRelationshipStrength("c1", "c2");

        expect(decayedStrength).toBe(initialStrength - COWORKER_RELATIONSHIP_DECAY);
      });

      it("should cap relationship strength at MAX_COWORKER_RELATIONSHIP", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.RESEARCH }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);

        // Tick many times to reach max
        for (let i = 0; i < 200; i++) {
          workforce.tick(colony as any, buildings as any, i);
        }

        const strength = workforce.getCoworkerRelationshipStrength("c1", "c2");
        expect(strength).toBe(MAX_COWORKER_RELATIONSHIP);
      });

      it("should bond all pairs in a multi-worker building", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
          createColonist({ id: "c2", role: ColonistRole.ENGINEERING }),
          createColonist({ id: "c3", role: ColonistRole.ENGINEERING }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2", "c3"] },
        ]);

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, buildings as any, 1);

        const bondEvents = events.filter((e) => e.type === "COWORKER_BOND_FORMED");
        expect(bondEvents.length).toBe(3); // c1-c2, c1-c3, c2-c3

        expect(workforce.getCoworkerRelationship("c1", "c2")).toBeDefined();
        expect(workforce.getCoworkerRelationship("c1", "c3")).toBeDefined();
        expect(workforce.getCoworkerRelationship("c2", "c3")).toBeDefined();
      });
    });

    describe("getCoworkerRelationshipStrength()", () => {
      it("should return 0 for colonists who have never worked together", () => {
        const strength = workforce.getCoworkerRelationshipStrength("unknown1", "unknown2");
        expect(strength).toBe(0);
      });

      it("should return correct strength after bonding", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.RESEARCH }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);
        workforce.tick(colony as any, buildings as any, 1);

        expect(workforce.getCoworkerRelationshipStrength("c1", "c2")).toBe(INITIAL_COWORKER_RELATIONSHIP);
        expect(workforce.getCoworkerRelationshipStrength("c2", "c1")).toBe(INITIAL_COWORKER_RELATIONSHIP);
      });
    });

    describe("getTeamCohesionMultiplier()", () => {
      it("should return 1.0 for solo worker", () => {
        expect(workforce.getTeamCohesionMultiplier(["c1"])).toBe(1.0);
      });

      it("should return 1.0 for empty worker list", () => {
        expect(workforce.getTeamCohesionMultiplier([])).toBe(1.0);
      });

      it("should return 1.0 for workers with no relationship", () => {
        expect(workforce.getTeamCohesionMultiplier(["c1", "c2"])).toBe(1.0);
      });

      it("should return 1.0 for workers below cohesion threshold", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.RESEARCH }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);
        workforce.tick(colony as any, buildings as any, 1);

        // Initial relationship (0.1) is below threshold (0.2)
        expect(workforce.getTeamCohesionMultiplier(["c1", "c2"])).toBe(1.0);
      });

      it("should return bonus for workers above cohesion threshold", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.RESEARCH }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);

        // Tick enough times to get above threshold
        for (let i = 0; i < 15; i++) {
          workforce.tick(colony as any, buildings as any, i);
        }

        const strength = workforce.getCoworkerRelationshipStrength("c1", "c2");
        expect(strength).toBeGreaterThan(TEAM_COHESION_THRESHOLD);

        const multiplier = workforce.getTeamCohesionMultiplier(["c1", "c2"]);
        expect(multiplier).toBeGreaterThan(1.0);
        expect(multiplier).toBeLessThanOrEqual(1.0 + MAX_TEAM_COHESION_BONUS);
      });
    });
  });

  // ==========================================================================
  // Housemate Relationship System tests
  // ==========================================================================
  describe("Housemate Relationship System", () => {
    describe("processHousemateBonding()", () => {
      it("should create relationship when two colonists share housing", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH, housingId: "hab1" }),
        ];

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, mockBuildings([]) as any, 1);

        const bondEvent = events.find((e) => e.type === "HOUSEMATE_BOND_FORMED");
        expect(bondEvent).toBeDefined();
        expect(bondEvent?.colonistA).toBe("c1");
        expect(bondEvent?.colonistB).toBe("c2");
        expect(bondEvent?.housingId).toBe("hab1");

        const relationship = workforce.getCoworkerRelationship("c1", "c2");
        expect(relationship).toBeDefined();
        expect(relationship?.strength).toBe(INITIAL_HOUSEMATE_RELATIONSHIP);
      });

      it("should not create relationship for colonists in different housing", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH, housingId: "hab2" }),
        ];

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, mockBuildings([]) as any, 1);

        const bondEvent = events.find((e) => e.type === "HOUSEMATE_BOND_FORMED");
        expect(bondEvent).toBeUndefined();
        expect(workforce.getCoworkerRelationship("c1", "c2")).toBeUndefined();
      });

      it("should not create relationship for colonists without housing", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH }),
        ];

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, mockBuildings([]) as any, 1);

        const bondEvent = events.find((e) => e.type === "HOUSEMATE_BOND_FORMED");
        expect(bondEvent).toBeUndefined();
      });

      it("should strengthen relationship over time at housemate rate", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH, housingId: "hab1" }),
        ];

        const colony = mockColony(colonists);
        const buildings = mockBuildings([]);

        workforce.tick(colony as any, buildings as any, 1);
        workforce.tick(colony as any, buildings as any, 2);
        workforce.tick(colony as any, buildings as any, 3);

        const relationship = workforce.getCoworkerRelationship("c1", "c2");
        // After tick 1: relationship formed at 0.15
        // Ticks 2-3: relationship decays when not working together, but housemate bonding adds back
        // Net effect per tick: -COWORKER_RELATIONSHIP_DECAY + HOUSEMATE_BONDING_RATE
        const expectedStrength =
          INITIAL_HOUSEMATE_RELATIONSHIP +
          2 * (HOUSEMATE_BONDING_RATE - COWORKER_RELATIONSHIP_DECAY);
        expect(relationship?.strength).toBeCloseTo(expectedStrength, 6);
      });

      it("should bond all housemates in shared housing", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
          createColonist({ id: "c2", role: ColonistRole.RESEARCH, housingId: "hab1" }),
          createColonist({ id: "c3", role: ColonistRole.FARMING, housingId: "hab1" }),
        ];

        const colony = mockColony(colonists);
        const events = workforce.tick(colony as any, mockBuildings([]) as any, 1);

        const bondEvents = events.filter((e) => e.type === "HOUSEMATE_BOND_FORMED");
        expect(bondEvents.length).toBe(3); // c1-c2, c1-c3, c2-c3

        expect(workforce.getCoworkerRelationship("c1", "c2")).toBeDefined();
        expect(workforce.getCoworkerRelationship("c1", "c3")).toBeDefined();
        expect(workforce.getCoworkerRelationship("c2", "c3")).toBeDefined();
      });

      it("housemate bonding rate should be higher than coworker rate", () => {
        expect(HOUSEMATE_BONDING_RATE).toBeGreaterThan(COWORKER_BONDING_RATE);
        expect(INITIAL_HOUSEMATE_RELATIONSHIP).toBeGreaterThan(INITIAL_COWORKER_RELATIONSHIP);
      });
    });

    describe("combined coworker and housemate bonding", () => {
      it("should accumulate both bonuses when colonists are coworkers and housemates", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
          createColonist({ id: "c2", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);

        // First tick creates relationships
        workforce.tick(colony as any, buildings as any, 1);

        // Coworker event happens first, creating initial relationship
        // Then housemate event strengthens the same relationship
        const relationship = workforce.getCoworkerRelationship("c1", "c2");
        expect(relationship).toBeDefined();
        // Initial coworker + housemate bonding in first tick
        expect(relationship?.strength).toBe(INITIAL_COWORKER_RELATIONSHIP + HOUSEMATE_BONDING_RATE);
      });

      it("should continue to accumulate both bonuses over time", () => {
        const colonists = [
          createColonist({ id: "c1", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
          createColonist({ id: "c2", role: ColonistRole.ENGINEERING, housingId: "hab1" }),
        ];
        const buildings = mockBuildings([
          { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
        ]);

        const colony = mockColony(colonists);

        workforce.tick(colony as any, buildings as any, 1);
        workforce.tick(colony as any, buildings as any, 2);

        const relationship = workforce.getCoworkerRelationship("c1", "c2");
        // After two ticks:
        // Tick 1: INITIAL_COWORKER + HOUSEMATE_BONDING_RATE
        // Tick 2: +COWORKER_BONDING_RATE + HOUSEMATE_BONDING_RATE
        const expected =
          INITIAL_COWORKER_RELATIONSHIP +
          HOUSEMATE_BONDING_RATE +
          COWORKER_BONDING_RATE +
          HOUSEMATE_BONDING_RATE;
        expect(relationship?.strength).toBeCloseTo(expected, 6);
      });
    });
  });

  // ==========================================================================
  // Serialization tests
  // ==========================================================================
  describe("Serialization", () => {
    it("should serialize and deserialize coworker relationships", () => {
      const colonists = [
        createColonist({ id: "c1", role: ColonistRole.ENGINEERING }),
        createColonist({ id: "c2", role: ColonistRole.ENGINEERING }),
      ];
      const buildings = mockBuildings([
        { id: "b1", status: "active", assignedWorkers: ["c1", "c2"] },
      ]);

      const colony = mockColony(colonists);
      workforce.tick(colony as any, buildings as any, 1);
      workforce.tick(colony as any, buildings as any, 2);

      const json = workforce.toJSON();
      const restored = WorkforceManager.fromJSON(json);

      expect(restored.getCoworkerRelationshipStrength("c1", "c2")).toBe(
        workforce.getCoworkerRelationshipStrength("c1", "c2")
      );

      const originalRel = workforce.getCoworkerRelationship("c1", "c2");
      const restoredRel = restored.getCoworkerRelationship("c1", "c2");
      expect(restoredRel?.formedAt).toBe(originalRel?.formedAt);
      expect(restoredRel?.lastWorkedTogether).toBe(originalRel?.lastWorkedTogether);
    });
  });
});

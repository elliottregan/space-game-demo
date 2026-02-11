import { describe, expect, test, beforeEach } from "bun:test";
import { VictoryManager } from "../src/core/systems/VictoryManager";
import { DistrictGrantManager } from "../src/core/systems/DistrictGrantManager";
import { DistrictGrantId } from "../src/core/models/DistrictGrant";

/**
 * Capstone unlock requires:
 * 1. All prerequisite grants completed (via completedGrantIds set)
 * 2. Axis progress >= CAPSTONE_UNLOCK_THRESHOLD (8) for each axis in the capstone's axisRequirements
 *
 * Axis progress accumulates from completed identity grants: each grant adds its victoryProgress
 * to every axis in its own axisRequirements.
 */
describe("Axis-gated victory", () => {
  let victoryManager: VictoryManager;
  let grantManager: DistrictGrantManager;

  beforeEach(() => {
    victoryManager = new VictoryManager();
    grantManager = new DistrictGrantManager();
  });

  /** Complete grants that accumulate sovereignty axis progress to >= 8. */
  function fillSovereigntyProgress(): void {
    // IMMIGRATION_PROGRAM(2) + MARS_NATIONALISM_CHARTER(2) + TRANSHUMAN_RESEARCH_INITIATIVE(2) = 6
    // Need a second district's IMMIGRATION_PROGRAM(2) to reach 8
    grantManager.addCompletedGrant("district-1", DistrictGrantId.IMMIGRATION_PROGRAM);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.MARS_NATIONALISM_CHARTER);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.TRANSHUMAN_RESEARCH_INITIATIVE);
    grantManager.addCompletedGrant("district-2", DistrictGrantId.IMMIGRATION_PROGRAM);
  }

  /** Complete grants that accumulate solidarity axis progress to >= 8. */
  function fillSolidarityProgress(): void {
    // UNIVERSAL_HOUSING(2) + HEALTHCARE_EXPANSION(2) + DEMOCRATIC_ASSEMBLY(2) = 6
    // VENTURE_CAPITAL_INITIATIVE(1) + PRIVATE_MINING_CONTRACTS(1) = 2 => total 8
    grantManager.addCompletedGrant("district-1", DistrictGrantId.UNIVERSAL_HOUSING);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.HEALTHCARE_EXPANSION);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.DEMOCRATIC_ASSEMBLY);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.VENTURE_CAPITAL_INITIATIVE);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.PRIVATE_MINING_CONTRACTS);
  }

  /** Complete grants that accumulate transformation axis progress to >= 8. */
  function fillTransformationProgress(): void {
    // HERITAGE_ARCHIVE(2) + EARTH_MEMORIAL(1) + GENETIC_ADAPTATION_PROGRAM(2)
    // + MARS_NATIONALISM_CHARTER(2) + TRANSHUMAN_RESEARCH_INITIATIVE(2) = 9
    grantManager.addCompletedGrant("district-1", DistrictGrantId.HERITAGE_ARCHIVE);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.EARTH_MEMORIAL);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.GENETIC_ADAPTATION_PROGRAM);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.MARS_NATIONALISM_CHARTER);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.TRANSHUMAN_RESEARCH_INITIATIVE);
  }

  test("capstone available when prerequisites met and axis progress sufficient", () => {
    // Earth Relief Compact prerequisites
    grantManager.addCompletedGrant("district-1", DistrictGrantId.EARTH_MEMORIAL);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.HERITAGE_ARCHIVE);

    // Earth Relief Compact needs sovereignty + solidarity axes >= 8 each
    fillSovereigntyProgress();
    fillSolidarityProgress();

    const result = victoryManager.checkCapstoneAvailability(grantManager);
    expect(result.availableCapstones).toContain(DistrictGrantId.EARTH_RELIEF_COMPACT);
  });

  test("capstone not available when prerequisites not met", () => {
    // Only complete one of two prerequisites for Earth Relief Compact
    grantManager.addCompletedGrant("district-1", DistrictGrantId.EARTH_MEMORIAL);
    // Missing: HERITAGE_ARCHIVE

    fillSovereigntyProgress();
    fillSolidarityProgress();

    const result = victoryManager.checkCapstoneAvailability(grantManager);
    expect(result.availableCapstones).not.toContain(DistrictGrantId.EARTH_RELIEF_COMPACT);
  });

  test("capstone not available when axis progress insufficient", () => {
    // Complete prerequisites for Earth Relief Compact
    grantManager.addCompletedGrant("district-1", DistrictGrantId.EARTH_MEMORIAL);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.HERITAGE_ARCHIVE);

    // Only partial progress on each axis (far below threshold of 8)
    grantManager.addCompletedGrant("district-1", DistrictGrantId.IMMIGRATION_PROGRAM);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.UNIVERSAL_HOUSING);

    const result = victoryManager.checkCapstoneAvailability(grantManager);
    expect(result.availableCapstones).not.toContain(DistrictGrantId.EARTH_RELIEF_COMPACT);
  });

  test("Declaration of Sovereignty capstone requires sovereignty axis progress", () => {
    // Prerequisites: UNIVERSAL_HOUSING, DEMOCRATIC_ASSEMBLY
    grantManager.addCompletedGrant("district-1", DistrictGrantId.UNIVERSAL_HOUSING);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.DEMOCRATIC_ASSEMBLY);

    // Sovereignty axis progress >= 8
    fillSovereigntyProgress();

    const result = victoryManager.checkCapstoneAvailability(grantManager);
    expect(result.availableCapstones).toContain(DistrictGrantId.DECLARATION_OF_SOVEREIGNTY);
  });

  test("Deep Space Mining Charter requires multi-axis progress", () => {
    // Prerequisites: ORBITAL_INFRASTRUCTURE, ASTEROID_SURVEY_PROGRAM
    grantManager.addCompletedGrant("district-1", DistrictGrantId.ORBITAL_INFRASTRUCTURE);
    grantManager.addCompletedGrant("district-1", DistrictGrantId.ASTEROID_SURVEY_PROGRAM);

    // Needs solidarity + transformation axes >= 8 each
    fillSolidarityProgress();
    fillTransformationProgress();

    const result = victoryManager.checkCapstoneAvailability(grantManager);
    expect(result.availableCapstones).toContain(DistrictGrantId.DEEP_SPACE_MINING_CHARTER);
  });

  test("completed capstone is not listed as available", () => {
    grantManager.addCompletedGrant("district-1", DistrictGrantId.EARTH_RELIEF_COMPACT);

    const result = victoryManager.checkCapstoneAvailability(grantManager);
    expect(result.availableCapstones).not.toContain(DistrictGrantId.EARTH_RELIEF_COMPACT);
  });
});

import type { GameEvent } from "../models/GameEvent";
import type { Technology, TechResearch } from "../models/Technology";
import type { ResourceManager } from "./ResourceManager";

export class TechnologyTree {
  private technologies: Map<string, Technology> = new Map();
  private researched: Set<string> = new Set();
  private researchProgress: Map<string, number> = new Map();
  private currentResearchId: string | null = null;
  private researchQueue: string[] = [];
  private currentResearch: TechResearch | null = null;
  private researchSpeedBonus: number = 0;

  constructor(techs: Technology[]) {
    techs.forEach((t) => this.technologies.set(t.id, t));
  }

  getResearchProgress(techId: string): number {
    return this.researchProgress.get(techId) ?? 0;
  }

  getCurrentResearchId(): string | null {
    return this.currentResearchId;
  }

  getResearchQueue(): string[] {
    return [...this.researchQueue];
  }

  tick(resources?: ResourceManager): GameEvent[] {
    const events: GameEvent[] = [];

    if (this.currentResearchId) {
      const speedMultiplier = 1.0 + this.researchSpeedBonus;
      const currentProgress = this.researchProgress.get(this.currentResearchId) ?? 0;
      const newProgress = currentProgress + speedMultiplier;
      this.researchProgress.set(this.currentResearchId, newProgress);

      const tech = this.technologies.get(this.currentResearchId);
      if (!tech) {
        this.currentResearchId = null;
        return events;
      }

      if (newProgress >= tech.cost.sols) {
        this.researched.add(this.currentResearchId);
        this.researchProgress.delete(this.currentResearchId);

        // Remove from queue front
        if (this.researchQueue.length > 0 && this.researchQueue[0] === this.currentResearchId) {
          this.researchQueue.shift();
        }

        events.push({
          type: "RESEARCH_COMPLETE",
          techId: this.currentResearchId,
          techName: tech.name,
          severity: "info",
          message: `Research complete: ${tech.name}!`,
        });

        this.currentResearchId = null;
        this.currentResearch = null; // Backward compatibility

        // Auto-start next in queue
        this.tryStartNextInQueue(resources);
      }
    } else if (this.researchQueue.length > 0) {
      // Nothing researching but queue exists - try to start
      this.tryStartNextInQueue(resources);
    }

    return events;
  }

  private tryStartNextInQueue(resources?: ResourceManager): void {
    if (this.researchQueue.length === 0) return;
    if (this.currentResearchId) return;

    const nextTechId = this.researchQueue[0];
    const tech = this.technologies.get(nextTechId);
    if (!tech) return;

    // Check if we can afford it
    if (tech.cost.resources && resources) {
      if (!resources.canAfford(tech.cost.resources)) {
        // Can't afford - stay paused
        return;
      }
      resources.deduct(tech.cost.resources);
    }

    // Initialize progress if needed
    if (!this.researchProgress.has(nextTechId)) {
      this.researchProgress.set(nextTechId, 0);
    }

    this.currentResearchId = nextTechId;
  }

  canResearch(techId: string): boolean {
    const tech = this.technologies.get(techId);
    if (!tech || this.researched.has(techId)) return false;

    return tech.prerequisites.every((prereq) => this.researched.has(prereq));
  }

  startResearch(techId: string, resources: ResourceManager): boolean {
    if (!this.canResearch(techId)) return false;
    if (this.currentResearchId) return false;

    const tech = this.technologies.get(techId);
    if (!tech) return false;

    if (tech.cost.resources && !resources.canAfford(tech.cost.resources)) {
      return false;
    }

    if (tech.cost.resources) {
      resources.deduct(tech.cost.resources);
    }

    this.currentResearchId = techId;

    // Add to queue if not already present
    if (!this.researchQueue.includes(techId)) {
      this.researchQueue.push(techId);
    }

    // Initialize progress if not already tracking (preserves existing progress)
    if (!this.researchProgress.has(techId)) {
      this.researchProgress.set(techId, 0);
    }

    // Backward compatibility: maintain currentResearch object
    this.currentResearch = {
      techId,
      progress: this.researchProgress.get(techId) ?? 0,
      requiredSols: tech.cost.sols,
    };

    return true;
  }

  cancelResearch(): void {
    this.currentResearchId = null;
    this.researchQueue = [];
    // Note: progress is NOT cleared - preserved in researchProgress map

    // Backward compatibility
    this.currentResearch = null;
  }

  isResearched(techId: string): boolean {
    return this.researched.has(techId);
  }

  getTech(techId: string): Technology | undefined {
    return this.technologies.get(techId);
  }

  getAllTechs(): Technology[] {
    return Array.from(this.technologies.values());
  }

  getAvailableTechs(): Technology[] {
    return Array.from(this.technologies.values()).filter((tech) => this.canResearch(tech.id));
  }

  getResearchedTechs(): Technology[] {
    return Array.from(this.technologies.values()).filter((tech) => this.researched.has(tech.id));
  }

  getCurrentResearch(): TechResearch | null {
    if (!this.currentResearchId) return null;

    const tech = this.technologies.get(this.currentResearchId);
    if (!tech) return null;

    return {
      techId: this.currentResearchId,
      progress: this.researchProgress.get(this.currentResearchId) ?? 0,
      requiredSols: tech.cost.sols,
    };
  }

  getResearchedCount(): number {
    return this.researched.size;
  }

  setResearchSpeedBonus(bonus: number): void {
    this.researchSpeedBonus = bonus;
  }

  /**
   * Queue a technology and all its prerequisites.
   * Preserves progress for all techs. Starts researching the first
   * unresearched tech in the chain.
   */
  queueResearch(techId: string, resources: ResourceManager): boolean {
    const chain = this.getPrerequisiteChain(techId);
    if (chain.length === 0) return false;

    // Update queue to new chain
    this.researchQueue = chain;

    // Find first unresearched tech in chain to start
    const firstTech = chain[0];

    // If we're not already researching the first tech, switch to it
    if (this.currentResearchId !== firstTech) {
      // Don't clear progress - it's preserved in the map
      this.currentResearchId = null;

      // Start the first tech (will deduct resources if needed)
      const tech = this.technologies.get(firstTech);
      if (tech) {
        // Only deduct resources if not already in progress
        if (!this.researchProgress.has(firstTech)) {
          if (tech.cost.resources) {
            if (!resources.canAfford(tech.cost.resources)) {
              // Can't afford - queue is set but nothing starts yet
              return true;
            }
            resources.deduct(tech.cost.resources);
          }
          this.researchProgress.set(firstTech, 0);
        }
        this.currentResearchId = firstTech;
      }
    }

    return true;
  }

  /**
   * Returns all unresearched prerequisites in topological order,
   * ending with the target tech.
   */
  getPrerequisiteChain(techId: string): string[] {
    const tech = this.technologies.get(techId);
    if (!tech) return [];
    if (this.researched.has(techId)) return [];

    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (id: string) => {
      if (visited.has(id)) return;
      if (this.researched.has(id)) return;

      visited.add(id);

      const t = this.technologies.get(id);
      if (!t) return;

      // Visit prerequisites first (topological sort)
      for (const prereq of t.prerequisites) {
        visit(prereq);
      }

      result.push(id);
    };

    visit(techId);
    return result;
  }

  toJSON() {
    return {
      researched: Array.from(this.researched),
      researchProgress: Object.fromEntries(this.researchProgress),
      currentResearchId: this.currentResearchId,
      researchQueue: this.researchQueue,
      researchSpeedBonus: this.researchSpeedBonus,
    };
  }

  static fromJSON(
    data: {
      researched: string[];
      researchProgress?: Record<string, number>;
      currentResearchId?: string | null;
      researchQueue?: string[];
      // Legacy field
      currentResearch?: TechResearch | null;
      researchSpeedBonus: number;
    },
    techs: Technology[],
  ): TechnologyTree {
    const tree = new TechnologyTree(techs);
    tree.researched = new Set(data.researched);
    tree.researchSpeedBonus = data.researchSpeedBonus || 0;

    // Handle new format
    if (data.researchProgress) {
      tree.researchProgress = new Map(Object.entries(data.researchProgress));
    }
    tree.currentResearchId = data.currentResearchId ?? null;
    tree.researchQueue = data.researchQueue ?? [];

    // Legacy migration: convert old currentResearch to new format
    if (!data.researchProgress && data.currentResearch) {
      tree.currentResearchId = data.currentResearch.techId;
      tree.researchProgress.set(data.currentResearch.techId, data.currentResearch.progress);
      tree.researchQueue = [data.currentResearch.techId];
    }

    return tree;
  }
}

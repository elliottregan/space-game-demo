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

  tick(): GameEvent[] {
    const events: GameEvent[] = [];

    if (this.currentResearch) {
      const speedMultiplier = 1.0 + this.researchSpeedBonus;
      this.currentResearch.progress += speedMultiplier;

      // Keep researchProgress map in sync with currentResearch
      this.researchProgress.set(
        this.currentResearch.techId,
        this.currentResearch.progress,
      );

      if (this.currentResearch.progress >= this.currentResearch.requiredSols) {
        const tech = this.technologies.get(this.currentResearch.techId);
        if (!tech) {
          this.currentResearch = null;
          return events;
        }
        this.researched.add(this.currentResearch.techId);

        events.push({
          type: "RESEARCH_COMPLETE",
          techId: this.currentResearch.techId,
          techName: tech.name,
          severity: "info",
          message: `Research complete: ${tech.name}!`,
        });

        this.currentResearch = null;
      }
    }

    return events;
  }

  canResearch(techId: string): boolean {
    const tech = this.technologies.get(techId);
    if (!tech || this.researched.has(techId)) return false;

    return tech.prerequisites.every((prereq) => this.researched.has(prereq));
  }

  startResearch(techId: string, resources: ResourceManager): boolean {
    if (!this.canResearch(techId)) return false;
    if (this.currentResearch) return false;

    const tech = this.technologies.get(techId);
    if (!tech) return false;

    if (tech.cost.resources && !resources.canAfford(tech.cost.resources)) {
      return false;
    }

    if (tech.cost.resources) {
      resources.deduct(tech.cost.resources);
    }

    this.currentResearch = {
      techId,
      progress: 0,
      requiredSols: tech.cost.sols,
    };

    return true;
  }

  cancelResearch(): void {
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
    return this.currentResearch ? { ...this.currentResearch } : null;
  }

  getResearchedCount(): number {
    return this.researched.size;
  }

  setResearchSpeedBonus(bonus: number): void {
    this.researchSpeedBonus = bonus;
  }

  toJSON() {
    return {
      researched: Array.from(this.researched),
      currentResearch: this.currentResearch,
      researchSpeedBonus: this.researchSpeedBonus,
    };
  }

  static fromJSON(
    data: {
      researched: string[];
      currentResearch: TechResearch | null;
      researchSpeedBonus: number;
    },
    techs: Technology[],
  ): TechnologyTree {
    const tree = new TechnologyTree(techs);
    tree.researched = new Set(data.researched);
    tree.currentResearch = data.currentResearch;
    tree.researchSpeedBonus = data.researchSpeedBonus || 0;
    return tree;
  }
}

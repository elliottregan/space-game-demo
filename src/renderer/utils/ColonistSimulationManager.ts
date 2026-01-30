import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { type Colonist, ColonistRole } from "../../core/models/Colonist";

export interface PositionedColonist {
  id: string;
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  role: ColonistRole;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  weight: number;
}

export class ColonistSimulationManager {
  private simulation: Simulation<SimNode, SimLink> | null = null;
  private nodes: SimNode[] = [];
  private links: SimLink[] = [];
  private width: number;
  private height: number;
  private positions: Map<string, { x: number; y: number }> = new Map();
  private animationFrame: number | null = null;
  private onTickCallback: (() => void) | null = null;
  private _isAnimating = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  setOnTick(callback: (() => void) | null): void {
    this.onTickCallback = callback;
  }

  isAnimating(): boolean {
    return this._isAnimating;
  }

  startAnimation(): void {
    if (this._isAnimating || !this.simulation) return;
    this._isAnimating = true;
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  stopAnimation(): void {
    this._isAnimating = false;
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  private animate = (): void => {
    if (!this._isAnimating || !this.simulation) return;

    this.simulation.tick(1);

    // Update stored positions
    for (const node of this.nodes) {
      this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    }

    this.onTickCallback?.();

    // Check if simulation has settled
    if (this.simulation.alpha() < 0.001) {
      this.stopAnimation();
      return;
    }

    this.animationFrame = requestAnimationFrame(this.animate);
  };

  update(colonists: Colonist[], relationships: Map<string, number>): void {
    // Track existing vs new colonist IDs
    const currentIds = new Set(colonists.map((c) => c.id));
    const existingIds = new Set(this.positions.keys());
    const newIds = new Set([...currentIds].filter((id) => !existingIds.has(id)));

    // Clean up positions for departed colonists
    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        this.positions.delete(id);
      }
    }

    // Create nodes, spawning new colonists near their strongest relationship
    this.nodes = colonists.map((c) => {
      const existingPos = this.positions.get(c.id);
      if (existingPos) {
        return { id: c.id, role: c.role, x: existingPos.x, y: existingPos.y };
      }

      // New colonist - find spawn position near strongest relationship
      const spawnPos = this.findSpawnPosition(c.id, relationships);
      return { id: c.id, role: c.role, x: spawnPos.x, y: spawnPos.y };
    });

    // Create links
    const nodeById = new Map(this.nodes.map((n) => [n.id, n]));
    this.links = [];
    for (const [key, weight] of relationships) {
      if (weight < 0.05) continue;
      const [id1, id2] = key.split(":");
      const node1 = id1 ? nodeById.get(id1) : undefined;
      const node2 = id2 ? nodeById.get(id2) : undefined;
      if (node1 && node2) {
        this.links.push({ source: id1, target: id2, weight });
      }
    }

    // Create or update simulation
    this.initSimulation();

    if (this._isAnimating) {
      // When animating, just set alpha and let animation loop handle ticks
      const alpha = newIds.size > 0 ? 0.3 : 0.1;
      this.simulation?.alpha(alpha).restart();
    } else {
      // Run fewer ticks when just warming from existing positions
      const tickCount = newIds.size > 0 || this.positions.size === 0 ? 100 : 30;
      this.simulation?.tick(tickCount);

      // Store positions
      for (const node of this.nodes) {
        this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
      }
    }
  }

  private findSpawnPosition(
    newId: string,
    relationships: Map<string, number>,
  ): { x: number; y: number } {
    // Find the strongest relationship with an existing colonist
    let strongestRelation: { id: string; weight: number } | null = null;

    for (const [key, weight] of relationships) {
      const [id1, id2] = key.split(":");
      const otherId = id1 === newId ? id2 : id2 === newId ? id1 : null;

      if (otherId && this.positions.has(otherId)) {
        if (!strongestRelation || weight > strongestRelation.weight) {
          strongestRelation = { id: otherId, weight };
        }
      }
    }

    if (strongestRelation) {
      const relatedPos = this.positions.get(strongestRelation.id);
      if (relatedPos) {
        // Add small random offset so they don't spawn exactly on top
        const angle = Math.random() * Math.PI * 2;
        const distance = 30 + Math.random() * 30;
        return {
          x: relatedPos.x + Math.cos(angle) * distance,
          y: relatedPos.y + Math.sin(angle) * distance,
        };
      }
    }

    // No existing relationship - spawn at center with small random offset
    return {
      x: this.width / 2 + (Math.random() - 0.5) * 50,
      y: this.height / 2 + (Math.random() - 0.5) * 50,
    };
  }

  private initSimulation(): void {
    this.simulation?.stop();

    this.simulation = forceSimulation(this.nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(this.links)
          .id((d) => d.id)
          .distance((link) => 220 - link.weight * 160)
          .strength((link) => 0.1 + link.weight * 0.3),
      )
      .force("charge", forceManyBody().strength(-500).distanceMax(300))
      .force("center", forceCenter(this.width / 2, this.height / 2))
      .force("collide", forceCollide(50).strength(0.8))
      .alphaDecay(0.02)
      .velocityDecay(0.4);
  }

  getPositions(): PositionedColonist[] {
    const padding = 40;
    return this.nodes.map((node) => ({
      id: node.id,
      x: Math.max(padding, Math.min(this.width - padding, node.x ?? this.width / 2)),
      y: Math.max(padding, Math.min(this.height - padding, node.y ?? this.height / 2)),
    }));
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (this.simulation) {
      this.simulation.force("center", forceCenter(width / 2, height / 2));
    }
  }

  destroy(): void {
    this.stopAnimation();
    this.simulation?.stop();
    this.simulation = null;
  }
}

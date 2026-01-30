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
  private visibilityHandler: (() => void) | null = null;
  private pendingAlpha = 0; // Alpha to use when animation starts

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Pause animation when tab is hidden
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.stopAnimation();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.visibilityHandler);
    }
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
    // Apply pending alpha from recent update
    if (this.pendingAlpha > 0) {
      this.simulation.alpha(this.pendingAlpha).restart();
      this.pendingAlpha = 0;
    }
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
    const existingNodeMap = new Map(this.nodes.map((n) => [n.id, n]));
    const hasNewColonists = colonists.some((c) => !existingNodeMap.has(c.id));
    const hasRemovedColonists = this.nodes.some((n) => !currentIds.has(n.id));

    // Clean up positions for departed colonists
    for (const node of this.nodes) {
      if (!currentIds.has(node.id)) {
        this.positions.delete(node.id);
      }
    }

    // Update nodes, preserving existing node objects to maintain velocity
    this.nodes = colonists.map((c) => {
      const existingNode = existingNodeMap.get(c.id);
      if (existingNode) {
        // Preserve the existing node object (keeps vx, vy, x, y)
        existingNode.role = c.role;
        return existingNode;
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

    // Initialize simulation if it doesn't exist, otherwise update in place
    if (!this.simulation) {
      this.initSimulation();
    } else {
      // Update existing simulation with new nodes and links
      this.simulation.nodes(this.nodes);
      const linkForce = this.simulation.force("link") as
        | ReturnType<typeof forceLink<SimNode, SimLink>>
        | undefined;
      if (linkForce) {
        linkForce.links(this.links);
      }
    }

    // Determine how much to reheat based on changes
    const hasStructuralChanges = hasNewColonists || hasRemovedColonists;
    const isFirstRender = this.positions.size === 0;
    const alpha = hasStructuralChanges ? 0.15 : 0.05;

    if (isFirstRender) {
      // First render - run sync ticks to get initial layout
      this.simulation?.tick(100);
      for (const node of this.nodes) {
        this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
      }
    } else if (this._isAnimating) {
      // Apply alpha immediately when already animating
      this.simulation?.alpha(alpha).restart();
    } else {
      // Store alpha for when animation starts
      this.pendingAlpha = alpha;
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

    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
    }
  }
}

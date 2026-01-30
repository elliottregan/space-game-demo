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

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  update(colonists: Colonist[], relationships: Map<string, number>): void {
    // Create nodes
    this.nodes = colonists.map((c) => ({
      id: c.id,
      role: c.role,
      x: this.positions.get(c.id)?.x ?? this.width / 2,
      y: this.positions.get(c.id)?.y ?? this.height / 2,
    }));

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

    // Run simulation synchronously for initial positions
    this.simulation?.tick(100);

    // Store positions
    for (const node of this.nodes) {
      this.positions.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    }
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
    this.simulation?.stop();
    this.simulation = null;
  }
}

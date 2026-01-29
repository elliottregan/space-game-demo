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

export interface ColonistLayoutInput {
  colonists: Colonist[];
  relationships: Map<string, number>; // "id1:id2" -> strength
  width: number;
  height: number;
}

export interface PositionedColonist {
  id: string;
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  role: ColonistRole;
  housingId?: string;
  x?: number;
  y?: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
  weight: number;
}

// Deterministic initial positions based on role (for consistent layouts)
function getInitialPosition(
  role: ColonistRole,
  index: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const roleOffsets: Record<ColonistRole, { x: number; y: number }> = {
    [ColonistRole.UNASSIGNED]: { x: 0.5, y: 0.5 },
    [ColonistRole.RESEARCH]: { x: 0.2, y: 0.25 },
    [ColonistRole.ENGINEERING]: { x: 0.8, y: 0.25 },
    [ColonistRole.CIVIL_SCIENCE]: { x: 0.2, y: 0.75 },
    [ColonistRole.FARMING]: { x: 0.8, y: 0.75 },
  };
  const offset = roleOffsets[role] ?? { x: 0.5, y: 0.5 };
  // Add small deterministic offset per colonist to avoid exact overlap
  const jitter = (index * 17) % 40;
  return {
    x: offset.x * width + jitter - 20,
    y: offset.y * height + jitter * 0.5 - 10,
  };
}

export function computeColonistForceLayout(input: ColonistLayoutInput): PositionedColonist[] {
  const { colonists, relationships, width, height } = input;

  if (colonists.length === 0) {
    return [];
  }

  const padding = 40;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  // Create simulation nodes with deterministic initial positions
  const nodes: SimNode[] = colonists.map((colonist, i) => {
    const pos = getInitialPosition(colonist.role, i, effectiveWidth, effectiveHeight);
    return {
      id: colonist.id,
      role: colonist.role,
      housingId: colonist.housingId,
      x: pos.x + padding,
      y: pos.y + padding,
    };
  });

  // Create node lookup
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  // Create links from relationships
  const links: SimLink[] = [];
  for (const [key, weight] of relationships) {
    if (weight < 0.05) continue;

    const [id1, id2] = key.split(":");
    const node1 = nodeById.get(id1!);
    const node2 = nodeById.get(id2!);

    if (node1 && node2) {
      links.push({
        source: node1,
        target: node2,
        weight,
      });
    }
  }

  // Add implicit same-housing links for clustering
  for (let i = 0; i < colonists.length; i++) {
    const colonistI = colonists[i];
    const nodeI = nodes[i];
    if (!colonistI || !nodeI || !colonistI.housingId) continue;

    for (let j = i + 1; j < colonists.length; j++) {
      const colonistJ = colonists[j];
      const nodeJ = nodes[j];
      if (!colonistJ || !nodeJ) continue;

      if (colonistI.housingId === colonistJ.housingId) {
        // Check if link already exists
        const exists = links.some(
          (l) =>
            (l.source === nodeI && l.target === nodeJ) ||
            (l.source === nodeJ && l.target === nodeI),
        );
        if (!exists) {
          links.push({
            source: nodeI,
            target: nodeJ,
            weight: 0.3, // Implicit housing attraction
          });
        }
      }
    }
  }

  // Create and configure simulation
  const simulation: Simulation<SimNode, SimLink> = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d: SimNode) => d.id)
        .strength((link: SimLink) => 0.05 + link.weight * 0.4)
        .distance(100),
    )
    .force("charge", forceManyBody().strength(-300))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide(40).strength(1))
    .alphaDecay(0.02)
    .velocityDecay(0.4);

  // Run simulation until settled
  simulation.tick(300);
  simulation.stop();

  // Extract final positions, clamped to bounds
  return nodes.map((node) => ({
    id: node.id,
    x: Math.max(padding, Math.min(width - padding, node.x ?? width / 2)),
    y: Math.max(padding, Math.min(height - padding, node.y ?? height / 2)),
  }));
}

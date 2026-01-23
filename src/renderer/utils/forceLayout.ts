import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import type { NPC, NPCFaction } from "../../core/models/NPCInfluence";

export interface LayoutInput {
  npcs: NPC[];
  relationshipMatrix: number[][];
  width: number;
  height: number;
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  faction: NPCFaction;
  x?: number;
  y?: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
  weight: number;
}

// Deterministic initial positions based on faction (for consistent layouts)
function getInitialPosition(
  faction: NPCFaction,
  index: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const factionOffsets: Record<NPCFaction, { x: number; y: number }> = {
    futurist: { x: 0.5, y: 0.2 },
    progressive: { x: 0.25, y: 0.7 },
    traditionalist: { x: 0.75, y: 0.7 },
  };
  const offset = factionOffsets[faction];
  // Add small deterministic offset per NPC to avoid exact overlap
  const jitter = (index * 17) % 50;
  return {
    x: offset.x * width + jitter,
    y: offset.y * height + jitter * 0.5,
  };
}

export function computeForceLayout(input: LayoutInput): PositionedNode[] {
  const { npcs, relationshipMatrix, width, height } = input;

  if (npcs.length === 0) {
    return [];
  }

  const padding = 40;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;

  // Create simulation nodes with deterministic initial positions
  const nodes: SimNode[] = npcs.map((npc, i) => {
    const pos = getInitialPosition(npc.faction, i, effectiveWidth, effectiveHeight);
    return {
      id: npc.id,
      faction: npc.faction,
      x: pos.x + padding,
      y: pos.y + padding,
    };
  });

  // Create links from relationship matrix
  const links: SimLink[] = [];
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      const weight = (relationshipMatrix[i]?.[j] ?? 0) + (relationshipMatrix[j]?.[i] ?? 0);
      if (weight > 0.1) {
        links.push({
          source: nodes[i]!,
          target: nodes[j]!,
          weight: weight / 2,
        });
      }
    }
  }

  // Add implicit same-faction links for clustering
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      if (npcs[i]!.faction === npcs[j]!.faction) {
        // Check if link already exists
        const exists = links.some(
          (l) =>
            (l.source === nodes[i]! && l.target === nodes[j]!) ||
            (l.source === nodes[j]! && l.target === nodes[i]!),
        );
        if (!exists) {
          links.push({
            source: nodes[i]!,
            target: nodes[j]!,
            weight: 0.5, // Implicit faction attraction
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
        .strength((link: SimLink) => 0.05 + link.weight * 0.5)
        .distance(140),
    )
    .force("charge", forceManyBody().strength(-400))
    .force("center", forceCenter(width / 2, height / 2))
    .force("collide", forceCollide(50).strength(1))
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

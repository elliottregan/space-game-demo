import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceX,
  forceY,
  forceCenter,
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
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number;
}

// Faction anchor positions (triangle layout)
const FACTION_ANCHORS: Record<NPCFaction, { x: number; y: number }> = {
  futurist: { x: 0.5, y: 0.15 },      // top center
  progressive: { x: 0.2, y: 0.75 },   // bottom left
  traditionalist: { x: 0.8, y: 0.75 }, // bottom right
};

export function computeForceLayout(input: LayoutInput): PositionedNode[] {
  const { npcs, relationshipMatrix, width, height } = input;

  if (npcs.length === 0) {
    return [];
  }

  // Create simulation nodes with initial positions at faction anchors
  const nodes: SimNode[] = npcs.map((npc) => {
    const anchor = FACTION_ANCHORS[npc.faction];
    return {
      id: npc.id,
      faction: npc.faction,
      x: anchor.x * width,
      y: anchor.y * height,
    };
  });

  // Create links from relationship matrix
  const links: SimLink[] = [];
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      const weight = (relationshipMatrix[i]?.[j] ?? 0) + (relationshipMatrix[j]?.[i] ?? 0);
      if (weight > 0.1) {
        links.push({
          source: nodes[i],
          target: nodes[j],
          weight: weight / 2, // Average of bidirectional
        });
      }
    }
  }

  // Create and configure simulation
  const simulation: Simulation<SimNode, SimLink> = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .strength((link) => 0.1 + link.weight * 0.7)
        .distance(80)
    )
    .force("charge", forceManyBody().strength(-200))
    .force("center", forceCenter(width / 2, height / 2).strength(0.05))
    .force(
      "factionX",
      forceX<SimNode>((d) => FACTION_ANCHORS[d.faction].x * width).strength(0.3)
    )
    .force(
      "factionY",
      forceY<SimNode>((d) => FACTION_ANCHORS[d.faction].y * height).strength(0.3)
    )
    .alphaDecay(0.02)
    .velocityDecay(0.4);

  // Run simulation until settled
  simulation.tick(300);
  simulation.stop();

  // Extract final positions
  return nodes.map((node) => ({
    id: node.id,
    x: node.x ?? 0,
    y: node.y ?? 0,
  }));
}

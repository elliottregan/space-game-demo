import type { AxisPosition } from "../models/NPCInfluence.ts";
import type { ResourceDelta } from "../models/Resources.ts";

export interface Policy {
  id: string;
  name: string;
  description: string;
  /** Which axis this policy pushes */
  axis: keyof AxisPosition;
  /** Direction: positive = toward +1, negative = toward -1 */
  direction: number;
  /** Pressure strength per sol */
  strength: number;
  /** Duration in sols */
  duration: number;
  /** Resource cost to declare */
  cost: ResourceDelta;
}

export const POLICIES: readonly Policy[] = [
  {
    id: "rationing_protocol",
    name: "Rationing Protocol",
    description: "Mandate communal resource sharing during scarcity",
    axis: "solidarity",
    direction: 1,
    strength: 0.04,
    duration: 30,
    cost: { materials: 50 },
  },
  {
    id: "free_market_decree",
    name: "Free Market Decree",
    description: "Deregulate trade and allow private enterprise",
    axis: "solidarity",
    direction: -1,
    strength: 0.04,
    duration: 30,
    cost: { materials: 50 },
  },
  {
    id: "earth_communication_priority",
    name: "Earth Communication Priority",
    description: "Prioritize Earth contact and cultural exchange",
    axis: "sovereignty",
    direction: -1,
    strength: 0.04,
    duration: 30,
    cost: { materials: 40 },
  },
  {
    id: "mars_self_sufficiency",
    name: "Mars Self-Sufficiency Program",
    description: "Focus on local production and independence",
    axis: "sovereignty",
    direction: 1,
    strength: 0.04,
    duration: 30,
    cost: { materials: 70 },
  },
  {
    id: "open_research_mandate",
    name: "Open Research Mandate",
    description: "Fund radical research and experimental technologies",
    axis: "transformation",
    direction: 1,
    strength: 0.04,
    duration: 30,
    cost: { materials: 80 },
  },
  {
    id: "heritage_preservation_act",
    name: "Heritage Preservation Act",
    description: "Protect traditions and established practices",
    axis: "transformation",
    direction: -1,
    strength: 0.04,
    duration: 30,
    cost: { materials: 60 },
  },
];

export function getPolicy(policyId: string): Policy | undefined {
  return POLICIES.find((p) => p.id === policyId);
}

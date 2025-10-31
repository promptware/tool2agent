import {
  AgentName,
  Place,
  Time,
  KnowledgeBase,
  KnowledgeEntry,
  type AgentConstraints,
  agentNameSchema,
  placeSchema,
  timeSchema,
} from './types.js';

// Helper function to format knowledge base for printing
export function formatKnowledgeBase(agentName: AgentName, knowledgeBase: KnowledgeBase): string {
  const allAgents: AgentName[] = agentNameSchema.options as AgentName[];
  const allPlaces: Place[] = placeSchema.options as Place[];
  const allTimes: Time[] = timeSchema.options as Time[];

  const lines: string[] = [];
  lines.push(`${agentName}'s Knowledge Base:`);

  for (const agent of allAgents) {
    lines.push(`  ${agent}:`);
    const agentMap = knowledgeBase.get(agent);
    if (agentMap) {
      for (const place of allPlaces) {
        const timeMap = agentMap.get(place);
        if (timeMap) {
          const statuses: string[] = [];
          for (const time of allTimes) {
            const status = timeMap.get(time);
            if (status === undefined) {
              statuses.push(`${time}: unknown`);
            } else {
              statuses.push(`${time}: ${status}`);
            }
          }
          lines.push(`    ${place}: ${statuses.join(', ')}`);
        }
      }
    }
  }

  return lines.join('\n');
}

// Initialize knowledge base with agent's own constraints
export function initializeKnowledgeBase(
  agentName: AgentName,
  agentConstraints: AgentConstraints,
): KnowledgeBase {
  const kb: KnowledgeBase = new Map();
  const allAgents: AgentName[] = agentNameSchema.options as AgentName[];
  const allPlaces: Place[] = placeSchema.options as Place[];
  const allTimes: Time[] = timeSchema.options as Time[];

  // Initialize all agents, places, times as undefined (unknown)
  for (const agent of allAgents) {
    const agentMap = new Map<Place, Map<Time, KnowledgeEntry>>();
    for (const place of allPlaces) {
      const timeMap = new Map<Time, KnowledgeEntry>();
      for (const time of allTimes) {
        timeMap.set(time, undefined);
      }
      agentMap.set(place, timeMap);
    }
    kb.set(agent, agentMap);
  }

  // Set this agent's own constraints from single source of truth
  const selfMap = kb.get(agentName)!;
  const constraints = agentConstraints[agentName];

  for (const place of allPlaces) {
    for (const time of allTimes) {
      const status = constraints[place][time];
      selfMap.get(place)!.set(time, status);
      console.log(
        `🧠 ${agentName} initialized knowledge: ${agentName} ${status} attend ${place} at ${time}`,
      );
    }
  }

  return kb;
}

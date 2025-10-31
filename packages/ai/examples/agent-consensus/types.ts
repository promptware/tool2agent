import { z } from 'zod';

// Schemas
export const placeSchema = z.enum(['bar', 'museum']);
export const timeSchema = z.enum(['morning', 'evening']);
export const agentNameSchema = z.enum(['Alice', 'Bob', 'Carol', 'Dave']);

export const messageSchema = z.object({
  from: agentNameSchema,
  content: z.string(),
});

// Types derived from schemas
export type Place = z.infer<typeof placeSchema>;
export type Time = z.infer<typeof timeSchema>;
export type AgentName = z.infer<typeof agentNameSchema>;
export type Message = z.infer<typeof messageSchema>;

// Knowledge base types
export type KnowledgeEntry = 'can' | 'cannot' | undefined;
export type KnowledgeBase = Map<AgentName, Map<Place, Map<Time, KnowledgeEntry>>>;

// Agent constraints type
export type AgentConstraints = Record<AgentName, Record<Place, Record<Time, 'can' | 'cannot'>>>;

// Custom exception for when an agent gives up
export class AgentGaveUpError extends Error {
  constructor(public agent: AgentName) {
    super(`${agent} gave up`);
    this.name = 'AgentGaveUpError';
  }
}

// Custom exception for when all agents confirm successfully
export class AllAgentsConfirmedError extends Error {
  constructor(public meeting: { place: Place; time: Time }) {
    super(`All agents confirmed: ${meeting.place} at ${meeting.time}`);
    this.name = 'AllAgentsConfirmedError';
  }
}

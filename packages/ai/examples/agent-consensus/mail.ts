import {
  AgentName,
  Message,
  Place,
  Time,
  agentNameSchema,
  AllAgentsConfirmedError,
  AgentGaveUpError,
} from './types.js';

// Mail system - shared state across all agents
export class MailSystem {
  private queues: Map<AgentName, Message[]> = new Map();
  confirmations: Map<AgentName, { place: Place; time: Time }> = new Map();
  givenUp: Set<AgentName> = new Set();
  private allMessages: Message[] = [];

  constructor() {
    const agents: AgentName[] = agentNameSchema.options as AgentName[];
    for (const agent of agents) {
      this.queues.set(agent, []);
    }
  }

  broadcastMessage(from: AgentName, content: string): void {
    const message: Message = {
      from,
      content,
    };
    this.allMessages.push(message);

    // Add message to all agents' queues (except the sender)
    const allAgents: AgentName[] = agentNameSchema.options as AgentName[];
    for (const agent of allAgents) {
      if (agent !== from) {
        const queue = this.queues.get(agent);
        if (queue) {
          queue.push(message);
        }
      }
    }

    console.log(`📢 ${from}: ${content}`);
  }

  getMessages(agent: AgentName): Message[] {
    const queue = this.queues.get(agent);
    if (!queue) return [];
    const messages = [...queue];
    queue.length = 0; // Clear the queue after reading
    return messages;
  }

  // Wait for new messages with polling
  async waitForMessages(agent: AgentName, timeoutMs: number = 2000): Promise<Message[]> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const queue = this.queues.get(agent);
      if (queue && queue.length > 0) {
        // Return messages and clear the queue
        const messages = [...queue];
        queue.length = 0;
        return messages;
      }
      // Small delay before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return [];
  }

  confirm(agent: AgentName, place: Place, time: Time): void {
    this.confirmations.set(agent, { place, time });
    console.log(`✅ ${agent} confirmed: ${place} at ${time}`);
    this.broadcastMessage(agent, `I confirm: ${place} at ${time}`);
  }

  giveUp(agent: AgentName): void {
    const isFirstGiveUp = this.givenUp.size === 0;
    this.givenUp.add(agent);
    console.log(`❌ ${agent} gave up`);
    this.broadcastMessage(
      agent,
      `I'm giving up - I don't think we can find a time that works for everyone.`,
    );

    // Throw exception on first give up to end the experiment
    if (isFirstGiveUp) {
      throw new AgentGaveUpError(agent);
    }
  }

  hasAllConfirmed(): boolean {
    return this.confirmations.size === 4;
  }

  getConfirmedMeeting(): { place: Place; time: Time } | null {
    if (!this.hasAllConfirmed()) return null;
    const first = Array.from(this.confirmations.values())[0];
    // Check if all confirmations match
    for (const confirmation of this.confirmations.values()) {
      if (confirmation.place !== first.place || confirmation.time !== first.time) {
        return null;
      }
    }
    return first;
  }

  hasAnyoneGivenUp(): boolean {
    return this.givenUp.size > 0;
  }

  getAllMessages(): Message[] {
    return [...this.allMessages];
  }
}

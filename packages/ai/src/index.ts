// Re-export all tool2agent types
export type * from '@tool2agent/types';

// Export tool2agent functionality
export { tool2agent, type Tool2AgentOptions, type Tool2Agent } from './tool2agent.js';

// Export builder functionality
export { mkTool, type FieldConfig, HiddenSpecSymbol } from './builder.js';

export {
  defineToolSpec,
  toposortFields,
  compileFixup,
  type DomainType,
  type FieldSpec,
  type ToolSpec,
  type ToolCallAccepted,
  type ToolCallRejected,
  type ToolCallResult as ValidationToolCallResult,
} from './validation.js';

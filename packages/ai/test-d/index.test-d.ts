import { type Expect, type Equal } from './expect.js';
import { type Tool2Agent, type Tool2AgentOptions, tool2agent } from '../src/index.js';
import type {
  ToolCallResult,
  ToolCallAccepted,
  ToolCallRejected,
  ToolInputType,
} from '@tool2agent/types';
import { z } from 'zod';

// The purpose of this file is to assert compile-time types only (no runtime).

// ==================== Test Input Type ====================
const testInputSchema = z.object({
  name: z.string(),
});

type TestInputType = z.infer<typeof testInputSchema>;

const outputSchema = z.never();
type OutputType = z.infer<typeof outputSchema>;

// ==================== Test: OutputType = never should not allow value field ====================

// Invalid: When outputSchema is omitted (defaults to never), providing value field should fail
const toolWithNeverOutput = tool2agent({
  type: 'function',
  description: 'Tool with never output type',
  inputSchema: testInputSchema,
  outputSchema: z.never(),
  // @ts-expect-error - value field should be omitted
  execute: async (params: Partial<TestInputType>) => {
    return {
      ok: true,
      value: { something: 'invalid' },
    };
  },
});

const toolWithNeverOutput2 = tool2agent<typeof testInputSchema, typeof outputSchema>({
  type: 'function',
  description: 'Tool with never output type',
  inputSchema: testInputSchema,
  outputSchema: z.never(),
  // @ts-expect-error - value field should be omitted
  execute: async (params: Partial<TestInputType>) => {
    return {
      ok: true,
      value: { something: 'invalid' },
    };
  },
});

const toolWithNeverOutput3 = tool2agent<typeof testInputSchema>({
  type: 'function',
  description: 'Tool with never output type',
  inputSchema: testInputSchema,
  outputSchema: z.never(),
  // @ts-expect-error - value field should be omitted
  execute: async (params: Partial<TestInputType>) => {
    return {
      ok: true,
      value: { something: 'invalid' },
    };
  },
});

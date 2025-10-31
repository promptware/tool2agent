import { generateObject, ToolCallOptions } from 'ai';
import { tool2agent, Tool2AgentOptions } from '../src/index.js';
import { z } from 'zod';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { ToolCallResult } from '@tool2agent/types';
import * as readline from 'node:readline/promises';
import 'dotenv/config';

const inputSchema = z.object({ query: z.string() });
const outputSchema = z.object({ results: z.array(z.string()) });

type InputSchema = typeof inputSchema;
type OutputSchema = typeof outputSchema;

type SearchToolInput = z.infer<typeof inputSchema>;
type SearchToolOutput = z.infer<typeof outputSchema>;

const toolParameters: Tool2AgentOptions<InputSchema, OutputSchema> = {
  inputSchema,
  outputSchema,
  execute: async (params: Partial<SearchToolInput>) => {
    if (!params.query) {
      return { ok: false, rejectionReasons: ['the query is required'] };
    }
    return {
      ok: true,
      value: {
        results: ['Query reversed: ' + params.query.split('').reverse().join('')],
      },
    };
  },
};

// Forbids "evil" queries from being processed by the tool
const evilFilterMiddleware = (
  params: Tool2AgentOptions<InputSchema, OutputSchema>,
): Tool2AgentOptions<InputSchema, OutputSchema> => {
  return {
    ...params,
    execute: async (input: Partial<SearchToolInput>, options?: ToolCallOptions) => {
      const query = input.query ?? '';
      const isEvil = await generateObject({
        model: openrouter('openai/gpt-4o-mini'),
        schema: z.object({ isEvil: z.boolean() }),
        prompt: `Is the object or notion "${query}" considered evil?`,
      });
      if (isEvil.object.isEvil) {
        return {
          ok: false,
          validationResults: {
            query: {
              valid: false,
              refusalReasons: ['the query you provided is evil which is not allowed'],
            },
          },
        };
      }
      return (await params.execute(input, options)) as ToolCallResult<
        SearchToolInput,
        SearchToolOutput
      >;
    },
  };
};

// Prevents secrets from being fed to the LLM
const secrets = ['secret1', 'password1'];

const secretsFilterMiddleware = (
  params: Tool2AgentOptions<InputSchema, OutputSchema>,
): Tool2AgentOptions<InputSchema, OutputSchema> => {
  return {
    ...params,
    execute: async (input: Partial<SearchToolInput>, options?: ToolCallOptions) => {
      let result = await params.execute(input, options);
      // If the result is rejected, return it as-is
      if (!result.ok) {
        return result;
      }
      // Check the output for secrets
      const resultString = JSON.stringify(result.value);
      if (secrets.some(secret => resultString.includes(secret))) {
        return {
          ok: false,
          rejectionReasons: ['the output contains a secret which is not allowed'],
        };
      }
      return result as ToolCallResult<SearchToolInput, SearchToolOutput>;
    },
  };
};

const tool = tool2agent({
  description: 'Query something somewhere',
  ...evilFilterMiddleware(secretsFilterMiddleware(toolParameters)),
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('This example demonstrates how middlewares can be composed together.');
console.log('The tool reverses the string you enter.');
console.log('tool2agent applies the following middlewares:');
console.log(
  "- evilFilterMiddleware: filters out evil queries via llm-powered validation (try 'satan')",
);
console.log(
  '- secretsFilterMiddleware: filters out secrets from the output. Secrets are: ' +
    secrets.join(', ') +
    ' (try entering them in reverse)',
);
console.log('The tool is then executed with the composed middleware.');

while (true) {
  const query = await rl.question('Enter a query: ');
  const result = await tool.execute!({ query }, { toolCallId: crypto.randomUUID(), messages: [] });
  console.log(JSON.stringify(result, null, 2));
}

# @tool2agent/ai

[tool2agent](https://github.com/promptware/tool2agent) interface for AI SDK.

```bash
pnpm install @tool2agent/ai
```

```typescript
import { tool2agent } from '@tool2agent/ai';
```

## Motivation

[tool2agent](https://github.com/promptware/tool2agent) is a protocol that enables LLM agents to navigate complex business constraints via trial and error by communicating rich and structured feedback data from tools.

[Read more about tool2agent](https://github.com/promptware/tool2agent?tab=readme-ov-file#about)

## About

This interface wires together tool2agent types and AI SDK by translating tool2agent tool parameters to AI SDK `Tool` parameters:

```typescript
export type Tool2Agent<InputType extends ToolInputType, OutputType> = Tool<
  // the input type becomes a partial record (all fields optional) to allow the LLM
  // to attempt calling the tool without providing the required parameters
  // just to get some feedback, like suggested values.
  Partial<InputType>,
  // output is always a ToolCallResult that can be either accepted (with output value),
  // or rejected (with mandatory feedback)
  ToolCallResult<InputType, OutputType>
>;
```

`tool2agent()`, the main function of the package, allows defining AI SDK LLM tools using a single `execute()` method that handles both validation and execution, returning structured feedback via `ToolCallResult`.

- `execute()` accepts a partial (with all fields optional) tool payload, and returns a `ToolCallResult` that can either succeed (`ok: true`) with the output value, or fail (`ok: false`) with structured feedback info.

```typescript
// Parameters of tool2agent() function:
export type Tool2AgentOptions<
  InputType extends ToolInputType,
  OutputType extends unknown,
  InputSchema extends z.ZodType<InputType> = z.ZodType<InputType>,
  OutputSchema extends z.ZodType<OutputType> = z.ZodType<OutputType>,
> = {
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  execute: (
    params: Partial<InputType>,
    options?: ToolCallOptions,
  ) => Promise<ToolCallResult<InputType, OutputType>>;
};

export function tool2agent<
  InputType extends ToolInputType,
  OutputType extends unknown,
  InputSchema extends z.ZodType<InputType> = z.ZodType<InputType>,
  OutputSchema extends z.ZodType<OutputType> = z.ZodType<OutputType>,
>(
  // accepts anything tool() from AI SDK accepts
  params: Tool2AgentOptions<InputType, OutputType, InputSchema, OutputSchema>, // this type is simplified for clarity
): Tool2Agent<InputType, OutputType>;
```

### Differences between `tool()` and `tool2agent()`

- AI SDK `tool()` does not do anything, and exists only for type checking, while `tool2agent()` builds tool's `execute()` method
- `tool()` passes exceptions through, while `tool2agent()` catches exceptions and returns them formatted nicely to the LLM as tool2agent `rejectionReasons`
- `tool2agent()` mandates input and output schemas
- `tool2agent()` expects a json-serializable output type, and for this reason it does not support providing custom `toModelOutput`
- `tool2agent()` input type is `Partial<InputType>` instead of `InputType`, allowing the LLM to call the tool with incomplete parameters to get validation feedback.

## Examples

- [censorship-bypass](./examples/censorship-bypass.ts) - shows how tool feedback can be used to guide the LLM towards its goal in the presence of an obstacle (word filter for search queries)
- [middleware](./examples/middleware.ts) - demonstrates how middleware can be composed to add validation and execution logic around tool calls
- [chat-room](./examples/chat-room.ts) - multiple agents reaching consensus using a knowledge base that keeps track of each other's constraints. tool2agent is used to provide feedback from that knowledge base.

## See also

- [tool2agent type definitions](https://github.com/promptware/tool2agent/blob/master/src/tool2agent.ts)

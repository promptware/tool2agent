# @tool2agent/ai

[tool2agent](https://github.com/promptware/tool2agent) interface for AI SDK.

```bash
pnpm install @tool2agent/ai
```

```typescript
import { tool2agent, mkTool } from '@tool2agent/ai';
```

## Motivation

[tool2agent](https://github.com/promptware/tool2agent) is a protocol that enables LLM agents to navigate complex business constraints via trial and error by communicating rich and structured feedback data from tools.

[Read more about tool2agent](https://github.com/promptware/tool2agent?tab=readme-ov-file#about)

## About

This package implements tool2agent bindings for AI SDK in two forms:

- `mkTool()` (a.k.a. "tool builder") - a type-safe mini-framework for creating interactive LLM tools with rich feedback.
- `tool2agent()` function is an enriched replacement for AI SDK `tool()` that gives more manual control to the developer than the agent builder. It does not implement any validation logic itself, only providing type-safe interface for that.

### Tool builder

`mkTool()` is the main value proposition of tool2agent so far.

It allows to semi-declaratively define tool feedback flows.

- All tool arguments (input object fields) are made optional.
- The LLM can fill them as it "sees" fit.
- Validation runs for every argument separately. Once it succeeds, a field is marked as valid.
- The developer can specify dependencies between arguments, which delays validation of tool input object fields until their dependencies are validated. This allows to establish ordering of parameter filling, which is very useful for user-facing chat applications.
- During validation, the _values_ of validated fields are also accessible, making it possible to provide more narrow feedback.
- Once all fields are valid, tool call is executed normally.

[Check out a complete usage example](./test/airline.ts)

### `tool2agent()` function

This interface wires together tool2agent types and AI SDK by translating tool2agent tool parameters to AI SDK `tool()` parameters.

<details>
<summary><strong>Show type definition</strong></summary>

```typescript
export type Tool2Agent<InputType extends ToolInputType, OutputType> = Tool<
  // the input type becomes a partial record (all fields optional) to allow the LLM
  // to attempt calling the tool without providing the required parameters
  // just to get some feedback, like suggested values.
  Partial<InputType>,
  // output is always a `ToolCallResult` that can be either accepted (with output value),
  // or rejected (with mandatory feedback)
  ToolCallResult<InputType, OutputType>
>;
```

- See [`ToolCallResult` definition](../types/src/tool2agent.ts)
</details>

`tool2agent()` function allows defining AI SDK LLM tools using an `execute()` method that handles both validation and execution, returning structured feedback via [`ToolCallResult`](../types/src/tool2agent.ts).

<details>
<summary><strong>How to use tool2agent</strong></summary>

- `execute()` accepts a partial (with all fields optional) tool payload, and returns a [`ToolCallResult`](../types/src/tool2agent.ts) that can either succeed (`ok: true`) with the output value, or fail (`ok: false`) with structured feedback info.

```typescript
// Parameters of tool2agent() function:
export type Tool2AgentOptions<
  InputSchema extends z.ZodObject<any>,
  OutputSchema extends z.ZodType<any> = z.ZodNever,
> = {
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  execute: (
    params: Partial<z.infer<InputSchema>>,
    options?: ToolCallOptions,
  ) => Promise<ToolCallResult<z.infer<InputSchema> & ToolInputType, z.infer<OutputSchema>>>;
};

export function tool2agent<
  InputSchema extends z.ZodObject<any>,
  OutputSchema extends z.ZodType<any> = z.ZodNever,
>(
  // accepts anything tool() from AI SDK accepts

  params: Tool2AgentOptions<InputSchema, OutputSchema>, // this type is simplified for clarity
): Tool2Agent<z.infer<InputSchema> & ToolInputType, z.infer<OutputSchema>>;
```

</details>

<details>
<summary><strong>Differences between <code>tool()</code> and <code>tool2agent()</code></strong></summary>

- AI SDK `tool()` does not do anything, and exists only for type checking, while `tool2agent()` builds tool's `execute()` method
- `tool()` passes exceptions through, while `tool2agent()` catches exceptions and returns them formatted nicely to the LLM as tool2agent `rejectionReasons`
- `tool2agent()` mandates input and output schemas. Use `never` / `z.never()` for output schema if it is not needed.
- `tool2agent()` expects a json-serializable output type, and for this reason it does not support providing custom `toModelOutput`
- `tool2agent()` input type is `Partial<InputType>` instead of `InputType`, allowing the LLM to call the tool with incomplete parameters to get validation feedback

</details>

## Examples

- [censorship-bypass](./examples/censorship-bypass.ts) - shows how tool feedback can be used to guide the LLM towards its goal in the presence of an obstacle (word filter for search queries)
- [middleware](./examples/middleware.ts) - demonstrates how middleware can be composed to add validation and execution logic around tool calls
- [agent-consensus](./examples/agent-consensus.ts) - multiple agents reaching consensus using a knowledge base that keeps track of each other's constraints. tool2agent is used to provide feedback from that knowledge base.

## See also

- [tool2agent type definitions](../types/src/tool2agent.ts)

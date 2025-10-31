# @tool2agent/schemas

Zod schema generators for the tool2agent protocol.

This package provides runtime schema generation functions that work with Zod v4.

## Installation

```bash
npm install @tool2agent/schemas @tool2agent/types zod
# or
pnpm add @tool2agent/schemas @tool2agent/types zod
# or
yarn add @tool2agent/schemas @tool2agent/types zod
```

## Usage

```typescript
import { z } from 'zod';
import { mkTool2AgentSchema } from '@tool2agent/schemas';

const inputSchema = z.object({
  name: z.string(),
  age: z.number(),
});

const outputSchema = z.object({
  id: z.string(),
});

const toolCallResultSchema = mkTool2AgentSchema(inputSchema, outputSchema);
```

## Compatibility

- **Zod**: Requires v4 (`^4`)
- **TypeScript**: Requires TypeScript 5.8+

## Related Packages

- [`@tool2agent/types`](https://github.com/promptware/tool2agent/tree/master/packages/types) - Core type definitions for the tool2agent protocol

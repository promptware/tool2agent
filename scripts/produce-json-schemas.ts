import { z } from 'zod';
import { mkTool2AgentSchema } from '../src/schemas.js';

// Note: This script uses Zod v4's native z.toJSONSchema() method
// which provides built-in JSON Schema conversion without external dependencies

// Example input schema - must be a ZodObject
const inputSchema = z.object({
  name: z.string().describe('User name'),
  age: z.number().int().min(0).max(150).describe('User age in years'),
  email: z.string().email().optional().describe('User email address'),
});

// Example output schema
const outputSchema = z.object({
  id: z.string().describe('Generated user ID'),
  createdAt: z.string().describe('ISO timestamp of creation'),
  success: z.boolean().describe('Whether the operation succeeded'),
});

// Generate the ToolCallResult schema using mkTool2AgentSchema
const toolCallResultSchema = mkTool2AgentSchema(inputSchema, outputSchema);

// Convert individual schemas to JSON Schema using Zod v4's native z.toJSONSchema() method
console.log('=== Input Schema JSON Schema ===');
const inputJsonSchema = z.toJSONSchema(inputSchema);
console.log(JSON.stringify(inputJsonSchema, null, 2));

console.log('\n=== Output Schema JSON Schema ===');
const outputJsonSchema = z.toJSONSchema(outputSchema);
console.log(JSON.stringify(outputJsonSchema, null, 2));

// Convert the ToolCallResult schema to JSON Schema
console.log('\n=== ToolCallResult JSON Schema ===');
const jsonSchema = z.toJSONSchema(toolCallResultSchema);
console.log(JSON.stringify(jsonSchema, null, 2));

import { type Expect, type Equal } from './expect.js';
import {
  mkFreeFormFeedbackSchema,
  mkAcceptableValuesSchema,
  mkParameterFeedbackRefusalSchema,
  mkParameterFeedbackSchema,
  mkValidationResultsSchema,
  mkToolCallAcceptedSchema,
  mkToolCallRejectedSchema,
  mkToolCallResultSchema,
  mkTool2AgentSchema,
} from '../src/index.js';
import type {
  FreeFormFeedback,
  AcceptableValues,
  ParameterFeedbackRefusal,
  ParameterFeedback,
  ToolCallAccepted,
  ToolCallRejected,
  ToolCallResult,
  ToolInputType,
} from '@tool2agent/types';
import { z } from 'zod';

// The purpose of this file is to assert compile-time types only (no runtime).
// It verifies that z.infer<typeof schema> matches the corresponding TypeScript types.

// ==================== Test Input Schema ====================
const testInputSchema = z.object({
  name: z.string(),
  age: z.number().int(),
  email: z.string().email().optional(),
});

type TestInputType = z.infer<typeof testInputSchema>;

const testOutputSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
});

type TestOutputType = z.infer<typeof testOutputSchema>;

// Create key enum using z.keyof() (Zod v4+)
const paramKeyEnum = z.keyof(testInputSchema);

// ==================== FreeFormFeedback Schema Tests ====================
const freeFormFeedbackSchema = mkFreeFormFeedbackSchema();
type InferredFreeFormFeedback = z.infer<typeof freeFormFeedbackSchema>;
type _TestFreeFormFeedback1 = Expect<Equal<InferredFreeFormFeedback, FreeFormFeedback>>;

// ==================== AcceptableValues Schema Tests ====================
const acceptableValuesSchema = mkAcceptableValuesSchema(z.string());
type InferredAcceptableValues = z.infer<typeof acceptableValuesSchema>;
type _TestAcceptableValues1 = Expect<Equal<InferredAcceptableValues, AcceptableValues<string>>>;

// ==================== ParameterFeedbackRefusal Schema Tests ====================
const parameterFeedbackRefusalSchema =
  mkParameterFeedbackRefusalSchema<TestInputType>(paramKeyEnum);
type InferredParameterFeedbackRefusal = z.infer<typeof parameterFeedbackRefusalSchema>;
type _TestParameterFeedbackRefusal1 = Expect<
  Equal<InferredParameterFeedbackRefusal, ParameterFeedbackRefusal<TestInputType>>
>;

// ==================== ParameterFeedback Schema Tests ====================
const parameterFeedbackSchema = mkParameterFeedbackSchema<TestInputType, string>(
  testInputSchema.shape.name,
  paramKeyEnum,
);
type InferredParameterFeedback = z.infer<typeof parameterFeedbackSchema>;
type _TestParameterFeedback1 = Expect<
  Equal<InferredParameterFeedback, ParameterFeedback<TestInputType, 'name'>>
>;

// ==================== ValidationResults Schema Tests ====================
const validationResultsSchema = mkValidationResultsSchema<TestInputType>(
  testInputSchema,
  paramKeyEnum,
);
type InferredValidationResults = z.infer<typeof validationResultsSchema>;
type ExpectedValidationResults = {
  [K in keyof TestInputType & string]?: ParameterFeedback<TestInputType, K>;
};
type _TestValidationResults1 = Expect<Equal<InferredValidationResults, ExpectedValidationResults>>;

// ==================== ToolCallAccepted Schema Tests ====================
const toolCallAcceptedSchema = mkToolCallAcceptedSchema<TestOutputType>(testOutputSchema);
type InferredToolCallAccepted = z.infer<typeof toolCallAcceptedSchema>;
type _TestToolCallAccepted1 = Expect<
  Equal<InferredToolCallAccepted, ToolCallAccepted<TestOutputType>>
>;

// Test case: when outputSchema is z.never(), value field should be omitted
const toolCallAcceptedNeverSchema = mkToolCallAcceptedSchema<never>(z.never());
type InferredToolCallAcceptedNever = z.infer<typeof toolCallAcceptedNeverSchema>;
type _TestToolCallAcceptedNever1 = Expect<
  Equal<InferredToolCallAcceptedNever, ToolCallAccepted<never>>
>;

// ==================== ToolCallRejected Schema Tests ====================
const toolCallRejectedSchema = mkToolCallRejectedSchema<TestInputType>(validationResultsSchema);
type InferredToolCallRejected = z.infer<typeof toolCallRejectedSchema>;
type _TestToolCallRejected1 = Expect<
  Equal<InferredToolCallRejected, ToolCallRejected<TestInputType>>
>;

// ==================== ToolCallResult Schema Tests ====================
const toolCallResultSchema = mkToolCallResultSchema<TestInputType, TestOutputType>(
  toolCallAcceptedSchema,
  toolCallRejectedSchema,
);
type InferredToolCallResult = z.infer<typeof toolCallResultSchema>;
type _TestToolCallResult1 = Expect<
  Equal<InferredToolCallResult, ToolCallResult<TestInputType, TestOutputType>>
>;

// ==================== mkTool2AgentSchema Integration Tests ====================
const tool2AgentSchema = mkTool2AgentSchema(testInputSchema, testOutputSchema);
type InferredTool2AgentResult = z.infer<typeof tool2AgentSchema>;
type _TestTool2AgentResult1 = Expect<
  Equal<InferredTool2AgentResult, ToolCallResult<TestInputType, TestOutputType>>
>;

// ==================== Empty Input Schema Tests ====================
const emptyInputSchema = z.object({});
type EmptyInputType = z.infer<typeof emptyInputSchema>;
const emptyTool2AgentSchema = mkTool2AgentSchema(emptyInputSchema, testOutputSchema);
type InferredEmptyTool2AgentResult = z.infer<typeof emptyTool2AgentSchema>;
type _TestEmptyTool2AgentResult1 = Expect<
  Equal<InferredEmptyTool2AgentResult, ToolCallResult<EmptyInputType, TestOutputType>>
>;

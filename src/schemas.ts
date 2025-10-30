import { type ZodType, z } from 'zod';
import type {
  ToolInputType,
  ToolCallResult,
  FreeFormFeedback,
  AcceptableValues,
  ParameterFeedbackCommon,
  ParameterFeedbackVariants,
  ParameterFeedback,
  ToolCallAccepted,
  ToolCallRejected,
  ParameterFeedbackRefusal,
} from './tool2agent.js';
import {
  nonEmptyArray,
  atMostOne,
  atMostOneTagged,
  atLeastOne,
  atLeastOneTagged,
  tagObject,
  tagUnion,
  untag,
  intersectSchemas,
  type TaggedSchema,
  type TaggedUnionSchema,
} from './schema-tools.js';

// Re-export schema tools for convenience
export {
  nonEmptyArray,
  atMostOne,
  atLeastOne,
  tagObject,
  tagUnion,
  untag,
  intersectSchemas,
  type TaggedSchema,
  type TaggedUnionSchema,
} from './schema-tools.js';

// =====================
// Exported schema builders per type
// =====================

export function mkFreeFormFeedbackSchema(): z.ZodType<FreeFormFeedback> {
  return z
    .object({
      feedback: nonEmptyArray(z.string())
        .describe('Freeform feedback for the tool call. Cannot be empty.')
        .optional(),
      instructions: nonEmptyArray(z.string())
        .describe(
          'Freeform instructions for the agent in response to the tool call. Cannot be empty.',
        )
        .optional(),
    })
    .strict();
}

export function mkAcceptableValuesSchema<T extends ZodType<any>>(
  valueSchema: T,
): z.ZodType<AcceptableValues<z.infer<T>>> {
  return atMostOne({
    allowedValues: z
      .array(valueSchema)
      .describe(
        'Exhaustive list of acceptable values. Empty array indicates no options available.',
      ),
    suggestedValues: nonEmptyArray(valueSchema).describe(
      'Non-exhaustive list of acceptable values. Cannot be empty.',
    ),
  }) as z.ZodType<AcceptableValues<z.infer<T>>>;
}

export function mkParameterFeedbackRefusalSchema<InputType extends ToolInputType>(
  paramKeyEnum: z.ZodEnum<any> | null,
): z.ZodType<ParameterFeedbackRefusal<InputType>> {
  const branches: Record<string, ZodType<any>> = {
    refusalReasons: nonEmptyArray(z.string()).describe(
      'Freeform reasons for why the parameter was not considered valid',
    ),
  };
  if (paramKeyEnum) {
    branches.requiresValidParameters = nonEmptyArray(paramKeyEnum).describe(
      'Parameters that must be valid before this parameter can be validated. Must be valid keys from the input schema.',
    );
  }
  return atLeastOne(branches as any) as z.ZodType<ParameterFeedbackRefusal<InputType>>;
}

/**
 * Tagged version of mkParameterFeedbackRefusalSchema
 */
function mkParameterFeedbackRefusalSchemaTagged<InputType extends ToolInputType>(
  paramKeyEnum: z.ZodEnum<any> | null,
): TaggedUnionSchema<z.ZodUnion<any>> {
  const branches: Record<string, ZodType<any>> = {
    refusalReasons: nonEmptyArray(z.string()).describe(
      'Freeform reasons for why the parameter was not considered valid',
    ),
  };
  if (paramKeyEnum) {
    branches.requiresValidParameters = nonEmptyArray(paramKeyEnum).describe(
      'Parameters that must be valid before this parameter can be validated. Must be valid keys from the input schema.',
    );
  }
  return atLeastOneTagged(branches as any);
}

export function mkParameterFeedbackSchema<InputType extends ToolInputType, ValueT>(
  valueSchema: ZodType<ValueT> | undefined,
  paramKeyEnum: z.ZodEnum<any> | null,
): z.ZodType<ParameterFeedbackCommon<ValueT> & ParameterFeedbackVariants<InputType>> {
  const baseValueSchema = valueSchema ?? z.unknown();

  // Build common schema: normalizedValue, dynamicParameterSchema, feedback, instructions
  // Note: dynamicParameterSchema uses z.any() instead of z.custom() to enable JSON Schema conversion
  // The actual runtime value would be a ZodType, but at serialization time it's represented as any
  const commonSchema = z.object({
    normalizedValue: baseValueSchema.optional(),
    dynamicParameterSchema: z.any().optional(),
    feedback: nonEmptyArray(z.string())
      .describe('Freeform feedback for the tool call. Cannot be empty.')
      .optional(),
    instructions: nonEmptyArray(z.string())
      .describe(
        'Freeform instructions for the agent in response to the tool call. Cannot be empty.',
      )
      .optional(),
  });

  // Build AcceptableValues union schema (AtMostOne) - tagged
  const acceptableValuesSchemaTagged = atMostOneTagged({
    allowedValues: z
      .array(baseValueSchema)
      .describe(
        'Exhaustive list of acceptable values. Empty array indicates no options available.',
      ),
    suggestedValues: nonEmptyArray(baseValueSchema).describe(
      'Non-exhaustive list of acceptable values. Cannot be empty.',
    ),
  });

  // Build ParameterFeedbackRefusal union schema (AtLeastOne) - tagged
  const refusalSchemaTagged = mkParameterFeedbackRefusalSchemaTagged(paramKeyEnum);

  // Branch 1: valid: true
  // Intersect: { valid: true } & common & AcceptableValues union
  // First combine valid discriminator with common schema using extend
  const validTrueBase = tagObject(
    z
      .object({ valid: z.literal(true) })
      .extend(commonSchema.shape)
      .strict(),
  );
  const validTrueTagged = intersectSchemas(validTrueBase, acceptableValuesSchemaTagged);

  // Branch 2: valid: false
  // Intersect: { valid: false } & common & AcceptableValues union & ParameterFeedbackRefusal union
  // First combine valid discriminator with common schema using extend
  const validFalseBase = tagObject(
    z
      .object({ valid: z.literal(false) })
      .extend(commonSchema.shape)
      .strict(),
  );
  const validFalseWithAcceptableTagged = intersectSchemas(
    validFalseBase,
    acceptableValuesSchemaTagged,
  );
  // Now intersect with refusal schema
  const validFalseTagged = intersectSchemas(validFalseWithAcceptableTagged, refusalSchemaTagged);

  // Union of valid: true and valid: false branches
  // Both are unions now (intersectSchemas always returns a union)
  const validTrueBranches = (validTrueTagged as TaggedUnionSchema<z.ZodUnion<any>>).branches;
  const validFalseBranches = (validFalseTagged as TaggedUnionSchema<z.ZodUnion<any>>).branches;
  return z.union([...validTrueBranches, ...validFalseBranches] as [
    any,
    any,
    ...any[],
  ]) as z.ZodType<ParameterFeedbackCommon<ValueT> & ParameterFeedbackVariants<InputType>>;
}

export function mkValidationResultsSchema<InputType extends ToolInputType>(
  inputSchema: z.ZodObject<z.ZodRawShape> & z.ZodType<InputType>,
  paramKeyEnum: z.ZodEnum<any> | null,
): z.ZodType<{
  [K in keyof InputType & string]?: ParameterFeedback<InputType, K>;
}> {
  const shape = inputSchema.shape;
  const keys = Object.keys(shape) as (keyof InputType & string)[];
  if (keys.length === 0)
    return z.object({}).strict() as unknown as z.ZodType<{
      [K in keyof InputType & string]?: ParameterFeedback<InputType, K>;
    }>;
  const perKey: Partial<{
    [K in keyof InputType & string]: z.ZodType<ParameterFeedback<InputType, K>>;
  }> = {};
  for (const key of keys) {
    const valueSchema = shape[key as string] as ZodType<unknown>;
    perKey[key] = mkParameterFeedbackSchema<InputType, unknown>(
      valueSchema,
      paramKeyEnum,
    ) as z.ZodType<ParameterFeedback<InputType, typeof key>>;
  }
  return atLeastOne(
    perKey as {
      [K in keyof InputType & string]: z.ZodType<ParameterFeedback<InputType, K>>;
    },
  ) as unknown as z.ZodType<{
    [K in keyof InputType & string]?: ParameterFeedback<InputType, K>;
  }>;
}

export function mkToolCallAcceptedSchema<OutputT>(
  outputSchema: ZodType<OutputT>,
): z.ZodType<ToolCallAccepted<OutputT>> {
  return z
    .object({
      ok: z.literal(true),
      value: outputSchema,
      feedback: nonEmptyArray(z.string()).optional(),
      instructions: nonEmptyArray(z.string()).optional(),
    })
    .strict() as z.ZodType<ToolCallAccepted<OutputT>>;
}

export function mkToolCallRejectedSchema<InputType extends ToolInputType>(
  validationResultsSchema: z.ZodType<any>,
): z.ZodType<ToolCallRejected<InputType>> {
  // Build common schema: ok: false & FreeFormFeedback
  const commonSchema = z
    .object({
      ok: z.literal(false),
      feedback: nonEmptyArray(z.string())
        .describe('Freeform feedback for the tool call. Cannot be empty.')
        .optional(),
      instructions: nonEmptyArray(z.string())
        .describe(
          'Freeform instructions for the agent in response to the tool call. Cannot be empty.',
        )
        .optional(),
    })
    .strict();

  // Build AtLeastOne union schema for validationResults/rejectionReasons - tagged
  const atLeastOneSchemaTagged = atLeastOneTagged({
    validationResults: validationResultsSchema.describe(
      'Validation feedback for individual parameters. At least one parameter must be present.',
    ),
    rejectionReasons: nonEmptyArray(z.string()).describe(
      'High-level reasons why the tool call was rejected. Cannot be empty.',
    ),
  });

  // Intersect: common & AtLeastOne union
  const commonSchemaTagged = tagObject(commonSchema);
  const resultTagged = intersectSchemas(commonSchemaTagged, atLeastOneSchemaTagged);

  // Extract the final schema (result is always a union from intersectSchemas)
  return untag(resultTagged) as z.ZodType<ToolCallRejected<InputType>>;
}

export function mkToolCallResultSchema<InputType extends ToolInputType, OutputT>(
  accepted: z.ZodType<ToolCallAccepted<OutputT>>,
  rejected: z.ZodType<ToolCallRejected<InputType>>,
): z.ZodType<ToolCallResult<InputType, OutputT>> {
  return z.union([accepted, rejected]) as z.ZodType<ToolCallResult<InputType, OutputT>>;
}

/**
 * Constructs a Zod schema for ToolCallResult that matches the TypeScript types
 * defined in tool2agent.ts.
 *
 * @param inputSchema - ZodObject schema for the tool input type
 * @param outputSchema - Zod schema for the tool output type
 * @returns Zod schema for ToolCallResult<InputType, OutputType>
 */
export function mkTool2AgentSchema<InputType extends ToolInputType, OutputType>(
  inputSchema: z.ZodObject<z.ZodRawShape> & z.ZodType<InputType>,
  outputSchema: ZodType<OutputType>,
): ZodType<ToolCallResult<InputType, OutputType>> {
  const shape = inputSchema.shape;
  const keys = Object.keys(shape);
  const paramKeyEnum = keys.length > 0 ? z.keyof(inputSchema as any) : null;

  const validationResults = mkValidationResultsSchema<InputType>(inputSchema, paramKeyEnum);
  const accepted = mkToolCallAcceptedSchema<OutputType>(outputSchema);
  const rejected = mkToolCallRejectedSchema<InputType>(validationResults);
  return mkToolCallResultSchema<InputType, OutputType>(accepted, rejected);
}

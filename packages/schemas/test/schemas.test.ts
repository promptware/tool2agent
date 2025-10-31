import test from 'node:test';
import assert from 'node:assert/strict';
import { z, type ZodType } from 'zod';

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
import { nonEmptyArray } from '../src/schema-tools.js';

// Helper to create key enum using z.keyof() (Zod v4+)
function createKeyEnum(inputSchema: z.ZodObject<any>): z.ZodEnum<any> | null {
  const keys = Object.keys(inputSchema.shape);
  if (keys.length === 0) return null;
  return z.keyof(inputSchema) as z.ZodEnum<any>;
}

const expectParseOK = <T>(schema: ZodType<T>, value: unknown): void => {
  assert.doesNotThrow(() => schema.parse(value));
};

const expectParseFail = <T>(schema: ZodType<T>, value: unknown): void => {
  assert.throws(() => schema.parse(value));
};

// Base input/output schemas
const inputSchema = z.object({
  name: z.string(),
  age: z.number().int(),
  email: z.string().email().optional(),
});

const outputSchema = z.object({ id: z.string(), createdAt: z.string() });

// Quick smoke test
const toolCallResultSchema = mkTool2AgentSchema(inputSchema, outputSchema);
type ToolCallResultType = z.infer<typeof toolCallResultSchema>;
const toolCallResult: ToolCallResultType = {
  ok: true,
  id: '1',
  createdAt: 'now',
};
expectParseOK(toolCallResultSchema, toolCallResult);

test('helper functions', async t => {
  await t.test('nonEmptyArray - positive and negative', () => {
    const ne = nonEmptyArray(z.string());
    expectParseOK(ne, ['a']);
    expectParseOK(ne, ['a', 'b']);
    expectParseFail(ne, []);
  });
});

test('basic schema builders', async t => {
  await t.test('mkFreeFormFeedbackSchema', () => {
    const s = mkFreeFormFeedbackSchema();
    expectParseOK(s, {});
    expectParseOK(s, { feedback: ['x'] });
    expectParseOK(s, { instructions: ['do Y'] });
    expectParseFail(s, { feedback: [] });
    expectParseFail(s, { instructions: [] });
  });

  await t.test('mkAcceptableValuesSchema (AtMostOne)', () => {
    const s = mkAcceptableValuesSchema(z.string());
    expectParseOK(s, {});
    expectParseOK(s, { allowedValues: [] });
    expectParseOK(s, { allowedValues: ['a', 'b'] });
    expectParseOK(s, { suggestedValues: ['a'] });
    expectParseFail(s, { allowedValues: ['a'], suggestedValues: ['b'] });
  });
});

test('parameter feedback schemas', async t => {
  await t.test('mkParameterFeedbackRefusalSchema (AtLeastOne of reasons/required)', () => {
    const keyEnum = createKeyEnum(inputSchema);
    const s = mkParameterFeedbackRefusalSchema(keyEnum);
    expectParseOK(s, { refusalReasons: ['bad format'] });
    expectParseOK(s, { requiresValidParameters: ['name'] });
    expectParseOK(s, { refusalReasons: ['x'], requiresValidParameters: ['age'] });
    expectParseFail(s, {});
    expectParseFail(s, { refusalReasons: [] });
    expectParseFail(s, { requiresValidParameters: [] });
  });

  await t.test(
    'mkParameterFeedbackRefusalSchema - requiresValidParameters only accepts valid keys',
    () => {
      const keyEnum = createKeyEnum(inputSchema);
      const s = mkParameterFeedbackRefusalSchema(keyEnum);
      // Valid keys from inputSchema
      expectParseOK(s, { requiresValidParameters: ['name'] });
      expectParseOK(s, { requiresValidParameters: ['age'] });
      expectParseOK(s, { requiresValidParameters: ['email'] });
      expectParseOK(s, { requiresValidParameters: ['name', 'age'] });
      // Invalid keys should be rejected
      expectParseFail(s, { requiresValidParameters: ['invalidKey'] });
      expectParseFail(s, { requiresValidParameters: ['name', 'invalidKey'] });
      expectParseFail(s, { requiresValidParameters: ['unknown'] });
    },
  );

  await t.test('mkParameterFeedbackSchema valid and invalid branches', () => {
    const keyEnum = createKeyEnum(inputSchema);
    const namePf = mkParameterFeedbackSchema(inputSchema.shape.name, keyEnum);

    // valid: true branches
    expectParseOK(namePf, { valid: true });
    expectParseOK(namePf, {
      valid: true,
      normalizedValue: 'John',
      feedback: ['ok'],
      allowedValues: ['John', 'Jane'],
    });
    expectParseOK(namePf, {
      valid: true,
      suggestedValues: ['John', 'Jane'],
    });
    expectParseOK(namePf, {
      valid: true,
      normalizedValue: 'John',
      instructions: ['good'],
    });

    // valid: false branches with refusalReasons
    expectParseOK(namePf, { valid: false, refusalReasons: ['too short'] });
    expectParseOK(namePf, {
      valid: false,
      refusalReasons: ['bad'],
      allowedValues: ['John'],
    });
    expectParseOK(namePf, {
      valid: false,
      refusalReasons: ['bad'],
      suggestedValues: ['John'],
    });

    // valid: false branches with requiresValidParameters
    expectParseOK(namePf, { valid: false, requiresValidParameters: ['age'] });
    expectParseOK(namePf, {
      valid: false,
      requiresValidParameters: ['age'],
      allowedValues: ['John'],
    });
    expectParseOK(namePf, {
      valid: false,
      requiresValidParameters: ['age'],
      suggestedValues: ['John'],
    });

    // valid: false branches with both refusal fields
    expectParseOK(namePf, {
      valid: false,
      refusalReasons: ['bad'],
      requiresValidParameters: ['age'],
    });
    expectParseOK(namePf, {
      valid: false,
      refusalReasons: ['bad'],
      requiresValidParameters: ['age'],
      allowedValues: ['John'],
    });
    expectParseOK(namePf, {
      valid: false,
      refusalReasons: ['bad'],
      requiresValidParameters: ['age'],
      suggestedValues: ['John'],
    });

    // Negative tests
    expectParseFail(namePf, { valid: false }); // requires at least one refusal field
    // AtMostOne on acceptable values
    expectParseFail(namePf, {
      valid: true,
      allowedValues: ['x'],
      suggestedValues: ['y'],
    });
    expectParseFail(namePf, {
      valid: false,
      refusalReasons: ['bad'],
      allowedValues: ['x'],
      suggestedValues: ['y'],
    });
    // requiresValidParameters only accepts valid keys
    expectParseFail(namePf, {
      valid: false,
      requiresValidParameters: ['invalidKey'],
    });
    expectParseFail(namePf, {
      valid: false,
      requiresValidParameters: ['name', 'invalidKey'],
    });
    expectParseFail(namePf, {
      valid: false,
      refusalReasons: ['bad'],
      requiresValidParameters: ['unknown'],
    });
  });
});

test('validation results schemas', async t => {
  await t.test('mkValidationResultsSchema with specific keys only and non-empty', () => {
    const keyEnum = createKeyEnum(inputSchema);
    const vr = mkValidationResultsSchema(inputSchema, keyEnum);
    // at least one key present - need full ParameterFeedback structure
    expectParseOK(vr, {
      name: {
        valid: true,
        normalizedValue: 'John',
      },
    });
    expectParseOK(vr, {
      age: {
        valid: false,
        refusalReasons: ['neg'],
      },
    });
    expectParseOK(vr, {
      email: {
        valid: false,
        requiresValidParameters: ['name'],
      },
    });
    expectParseOK(vr, {
      name: {
        valid: false,
        refusalReasons: ['bad'],
        requiresValidParameters: ['age'],
      },
    });
    // Can have multiple keys (other keys are optional in branches)
    expectParseOK(vr, {
      name: { valid: true },
      age: { valid: true },
    });
    expectParseOK(vr, {
      name: { valid: false, refusalReasons: ['bad'] },
      age: { valid: false, requiresValidParameters: ['email'] },
    });
    // empty object not allowed (no branches match AtLeastOne)
    expectParseFail(vr, {});
  });
});

test('tool call schemas', async t => {
  await t.test('mkToolCallAcceptedSchema', () => {
    const acc = mkToolCallAcceptedSchema(outputSchema);
    // Objects with keys are merged directly (no value wrapper)
    expectParseOK(acc, { ok: true, id: '1', createdAt: 'now' });
    expectParseOK(acc, {
      ok: true,
      id: '1',
      createdAt: 'now',
      feedback: ['done'],
    });
    expectParseFail(acc, { ok: true });
    expectParseFail(acc, { ok: true, id: '1' });
    expectParseFail(acc, { ok: true, id: '1', createdAt: 'now', feedback: [] });
  });

  await t.test('mkToolCallAcceptedSchema with z.never() - value field omitted', () => {
    const accNever = mkToolCallAcceptedSchema(z.never());
    // Should accept objects without value field
    expectParseOK(accNever, { ok: true });
    expectParseOK(accNever, { ok: true, feedback: ['done'] });
    expectParseOK(accNever, { ok: true, instructions: ['do something'] });
    expectParseOK(accNever, { ok: true, feedback: ['done'], instructions: ['do something'] });
    // Should reject objects with value field (strict schema doesn't allow extra fields)
    expectParseFail(accNever, { ok: true, value: { id: '1' } });
    expectParseFail(accNever, { ok: true, value: null });
    expectParseFail(accNever, { ok: true, value: 'anything' });
    expectParseFail(accNever, { ok: true, value: 123 });
    expectParseFail(accNever, { ok: true, value: [] });
    expectParseFail(accNever, { ok: true, value: undefined });
  });

  await t.test('mkToolCallAcceptedSchema with z.object({}) - value field omitted', () => {
    const accEmpty = mkToolCallAcceptedSchema(z.object({}));
    // Should accept objects without value field (same as z.never())
    expectParseOK(accEmpty, { ok: true });
    expectParseOK(accEmpty, { ok: true, feedback: ['done'] });
    expectParseOK(accEmpty, { ok: true, instructions: ['do something'] });
    expectParseOK(accEmpty, { ok: true, feedback: ['done'], instructions: ['do something'] });
    // Should reject objects with value field (strict schema doesn't allow extra fields)
    expectParseFail(accEmpty, { ok: true, value: { id: '1' } });
    expectParseFail(accEmpty, { ok: true, value: null });
    expectParseFail(accEmpty, { ok: true, value: 'anything' });
    expectParseFail(accEmpty, { ok: true, value: 123 });
    expectParseFail(accEmpty, { ok: true, value: [] });
    expectParseFail(accEmpty, { ok: true, value: {} });
    expectParseFail(accEmpty, { ok: true, value: undefined });
  });

  await t.test('mkToolCallAcceptedSchema with object with keys - keys merged directly', () => {
    const accWithKeys = mkToolCallAcceptedSchema(outputSchema);
    // Should accept objects with keys merged directly (no value wrapper)
    expectParseOK(accWithKeys, { ok: true, id: '1', createdAt: 'now' });
    expectParseOK(accWithKeys, {
      ok: true,
      id: '1',
      createdAt: 'now',
      feedback: ['done'],
    });
    expectParseOK(accWithKeys, {
      ok: true,
      id: '1',
      createdAt: 'now',
      instructions: ['do something'],
    });
    // Should reject objects without required keys
    expectParseFail(accWithKeys, { ok: true });
    expectParseFail(accWithKeys, { ok: true, id: '1' });
    expectParseFail(accWithKeys, { ok: true, createdAt: 'now' });
    // Should reject objects with value field (keys should be at top level)
    expectParseFail(accWithKeys, { ok: true, value: { id: '1', createdAt: 'now' } });
    // Should reject objects with invalid keys
    expectParseFail(accWithKeys, { ok: true, id: '1', createdAt: 'now', feedback: [] });
  });

  await t.test('mkToolCallRejectedSchema', () => {
    const keyEnum = createKeyEnum(inputSchema);
    const vr = mkValidationResultsSchema(inputSchema, keyEnum);
    const rej = mkToolCallRejectedSchema(vr);

    // valid with validationResults - need full ParameterFeedback structure
    expectParseOK(rej, {
      ok: false,
      validationResults: {
        name: { valid: true, normalizedValue: 'John' },
      },
    });
    expectParseOK(rej, {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['bad'] },
      },
    });
    expectParseOK(rej, {
      ok: false,
      validationResults: {
        name: { valid: false, requiresValidParameters: ['age'] },
      },
    });
    expectParseOK(rej, {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['bad'], requiresValidParameters: ['age'] },
      },
    });
    // valid with rejectionReasons
    expectParseOK(rej, { ok: false, rejectionReasons: ['system down'] });
    // valid with both
    expectParseOK(rej, {
      ok: false,
      validationResults: { name: { valid: true } },
      rejectionReasons: ['also rejected'],
    });
    expectParseOK(rej, {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['bad'] },
      },
      rejectionReasons: ['also rejected'],
    });
    // invalid: neither provided
    expectParseFail(rej, { ok: false });
    // invalid: empty rejectionReasons
    expectParseFail(rej, { ok: false, rejectionReasons: [] });
  });

  await t.test('mkToolCallResultSchema union', () => {
    const acc = mkToolCallAcceptedSchema(outputSchema);
    const keyEnum = createKeyEnum(inputSchema);
    const vr = mkValidationResultsSchema(inputSchema, keyEnum);
    const rej = mkToolCallRejectedSchema(vr);
    const res = mkToolCallResultSchema(acc, rej);

    expectParseOK(res, { ok: true, id: '1', createdAt: 'now' });
    expectParseOK(res, { ok: false, rejectionReasons: ['x'] });
    expectParseFail(res, { ok: true });
  });
});

test('end-to-end integration', async t => {
  await t.test('mkTool2AgentSchema end-to-end', () => {
    const toolSchema = mkTool2AgentSchema(inputSchema, outputSchema);

    // accepted branch
    expectParseOK(toolSchema, { ok: true, id: '1', createdAt: 'now' });

    // rejected: validationResults with various refusal combinations
    expectParseOK(toolSchema, {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['bad'] },
      },
    });
    expectParseOK(toolSchema, {
      ok: false,
      validationResults: {
        name: { valid: false, requiresValidParameters: ['age'] },
      },
    });
    expectParseOK(toolSchema, {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['bad'], requiresValidParameters: ['age'] },
      },
    });
    expectParseOK(toolSchema, {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['bad'], allowedValues: ['John'] },
      },
    });
    expectParseOK(toolSchema, {
      ok: false,
      validationResults: {
        name: { valid: false, requiresValidParameters: ['age'], suggestedValues: ['John'] },
      },
    });

    // rejected: rejectionReasons
    expectParseOK(toolSchema, { ok: false, rejectionReasons: ['rate limit'] });

    // rejected: both
    expectParseOK(toolSchema, {
      ok: false,
      validationResults: { name: { valid: true } },
      rejectionReasons: ['also rejected'],
    });
    expectParseOK(toolSchema, {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['bad'], requiresValidParameters: ['age'] },
      },
      rejectionReasons: ['also rejected'],
    });

    // negatives
    expectParseFail(toolSchema, { ok: false });
    expectParseFail(toolSchema, { ok: true });
  });
});

test('type inference tests', async t => {
  await t.test('ToolCallAccepted with type inference', () => {
    const acceptedSchema = mkToolCallAcceptedSchema(outputSchema);
    type AcceptedType = z.infer<typeof acceptedSchema>;

    const accepted: AcceptedType = {
      ok: true,
      id: 'test-id',
      createdAt: '2024-01-01',
      feedback: ['Success'],
      instructions: ['Follow up'],
    };

    expectParseOK(acceptedSchema, accepted);

    // Negative: typed value violating schema constraints
    const invalidAcceptedTyped: AcceptedType = {
      ok: true,
      id: 'test-id',
      createdAt: '2024-01-01',
      // @ts-expect-error - Empty array violates NonEmptyArray constraint
      feedback: [], // Empty array violates NonEmptyArray constraint
    };

    expectParseFail(acceptedSchema, invalidAcceptedTyped);
  });

  await t.test('ToolCallRejected with type inference', () => {
    const keyEnum = createKeyEnum(inputSchema);
    const vrSchema = mkValidationResultsSchema(inputSchema, keyEnum);
    const rejectedSchema = mkToolCallRejectedSchema(vrSchema);
    type RejectedType = z.infer<typeof rejectedSchema>;

    const rejectedWithValidation: RejectedType = {
      ok: false,
      validationResults: {
        name: { valid: false, refusalReasons: ['Invalid format'] },
        age: { valid: true },
      },
      feedback: ['Please correct the errors'],
    };

    expectParseOK(rejectedSchema, rejectedWithValidation);

    const rejectedWithReasons: RejectedType = {
      ok: false,
      rejectionReasons: ['Rate limit exceeded', 'Service unavailable'],
      instructions: ['Try again later'],
    };

    expectParseOK(rejectedSchema, rejectedWithReasons);

    // Negative: typed value violating AtLeastOne constraint
    // @ts-expect-error - Missing both validationResults and rejectionReasons
    const invalidRejected: RejectedType = {
      ok: false,
      // Missing both validationResults and rejectionReasons
    };

    expectParseFail(rejectedSchema, invalidRejected);
  });

  await t.test('ParameterFeedback with type inference', () => {
    const keyEnum = createKeyEnum(inputSchema);
    const paramSchema = mkParameterFeedbackSchema(inputSchema.shape.name, keyEnum);
    type ParamFeedbackType = z.infer<typeof paramSchema>;

    const validParam: ParamFeedbackType = {
      valid: true,
      normalizedValue: 'John Doe',
      allowedValues: ['John Doe', 'Jane Doe'],
      feedback: ['Value normalized'],
    };

    expectParseOK(paramSchema, validParam);

    const invalidParam: ParamFeedbackType = {
      valid: false,
      refusalReasons: ['Too short', 'Invalid characters'],
      requiresValidParameters: ['email'],
      suggestedValues: ['John', 'Johnny'],
    };

    expectParseOK(paramSchema, invalidParam);

    // Negative: typed value violating AtMostOne constraint
    // @ts-expect-error - Both allowedValues and suggestedValues violates AtMostOne
    const invalidBothValues: ParamFeedbackType = {
      valid: true,
      allowedValues: ['a'],
      suggestedValues: ['b'], // Violates AtMostOne
    };

    expectParseFail(paramSchema, invalidBothValues);
  });

  await t.test('ValidationResults with type inference', () => {
    const keyEnum = createKeyEnum(inputSchema);
    const vrSchema = mkValidationResultsSchema(inputSchema, keyEnum);
    type ValidationResultsType = z.infer<typeof vrSchema>;

    const singleParam: ValidationResultsType = {
      name: {
        valid: false,
        refusalReasons: ['Invalid'],
        requiresValidParameters: ['age'],
      },
    };

    expectParseOK(vrSchema, singleParam);

    const multipleParams: ValidationResultsType = {
      name: { valid: true, normalizedValue: 'John' },
      age: { valid: false, refusalReasons: ['Must be positive'] },
      email: { valid: true },
    };

    expectParseOK(vrSchema, multipleParams);

    // Negative: empty object violates AtLeastOne (runtime constraint, not type-level)
    const emptyValidation: Record<string, never> = {};
    const emptyValidationTyped = emptyValidation as ValidationResultsType;
    expectParseFail(vrSchema, emptyValidationTyped);
  });

  await t.test('empty input schema', () => {
    const emptyInputSchema = z.object({});
    const emptyToolSchema = mkTool2AgentSchema(emptyInputSchema, outputSchema);
    type EmptyToolResultType = z.infer<typeof emptyToolSchema>;

    const accepted: EmptyToolResultType = {
      ok: true,
      id: '1',
      createdAt: 'now',
    };

    expectParseOK(emptyToolSchema, accepted);

    // Rejected with rejectionReasons (empty input has no validationResults)
    const rejected: EmptyToolResultType = {
      ok: false,
      rejectionReasons: ['No input provided'],
    } as EmptyToolResultType;

    expectParseOK(emptyToolSchema, rejected);

    // Empty validationResults is actually valid when input schema is empty
    // because atLeastOne constraint is satisfied by presence of validationResults field
    const rejectedWithEmptyValidation: EmptyToolResultType = {
      ok: false,
      validationResults: {},
    } as EmptyToolResultType;

    expectParseOK(emptyToolSchema, rejectedWithEmptyValidation);

    // Negative: missing both validationResults and rejectionReasons
    // @ts-expect-error - Missing both validationResults and rejectionReasons
    const invalidRejected: EmptyToolResultType = {
      ok: false,
      // Missing both required fields
    };

    expectParseFail(emptyToolSchema, invalidRejected);
  });

  await t.test('complex nested structures', () => {
    const complexInputSchema = z.object({
      user: z.object({ name: z.string(), age: z.number() }),
      settings: z.object({ theme: z.string(), notifications: z.boolean() }),
    });

    const complexOutputSchema = z.object({
      result: z.array(z.object({ id: z.string(), score: z.number() })),
      metadata: z.object({ timestamp: z.string(), version: z.string() }),
    });

    const complexToolSchema = mkTool2AgentSchema(complexInputSchema, complexOutputSchema);
    type ComplexToolResultType = z.infer<typeof complexToolSchema>;

    const complexAccepted: ComplexToolResultType = {
      ok: true,
      result: [
        { id: '1', score: 95 },
        { id: '2', score: 87 },
      ],
      metadata: { timestamp: '2024-01-01', version: '1.0' },
      feedback: ['Processing complete'],
    };

    expectParseOK(complexToolSchema, complexAccepted);

    const complexRejected: ComplexToolResultType = {
      ok: false,
      validationResults: {
        user: {
          valid: false,
          refusalReasons: ['Invalid user data'],
          requiresValidParameters: ['settings'],
        },
        settings: {
          valid: true,
          normalizedValue: { theme: 'dark', notifications: true },
        },
      },
      rejectionReasons: ['Additional validation failed'],
    } as ComplexToolResultType;

    expectParseOK(complexToolSchema, complexRejected);

    // Negative: invalid nested structure
    const invalidComplexTyped: ComplexToolResultType = {
      ok: true,
      // @ts-expect-error - Missing required 'score' field in result array items
      result: [{ id: '1' }], // Missing required 'score' field
      metadata: { timestamp: '2024-01-01', version: '1.0' },
    };

    expectParseFail(complexToolSchema, invalidComplexTyped);
  });
});

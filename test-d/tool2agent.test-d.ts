import {
  type ToolCallResult,
  type ToolCallAccepted,
  type ToolCallRejected,
  type ParameterFeedback,
  type FreeFormFeedback,
  type AcceptableValues,
  ParameterFeedbackCommon,
} from '../src/tool2agent.js';
import * as z from 'zod';

// The purpose of this file is to assert compile-time types only (no runtime).

type TestParams = {
  name: string;
  age: number;
  email?: string;
};

// ==================== ToolCallAccepted Tests ====================

// Valid: Accepted tool call with all required fields
const validAccepted: ToolCallAccepted<TestParams> = {
  ok: true,
  value: { name: 'John', age: 30 },
};

// Valid: Accepted with optional feedback
const validAcceptedWithFeedback: ToolCallAccepted<TestParams> = {
  ok: true,
  value: { name: 'John', age: 30 },
  feedback: ['Good input'],
};

// Valid: Accepted with instructions
const validAcceptedWithInstructions: ToolCallAccepted<TestParams> = {
  ok: true,
  value: { name: 'John', age: 30 },
  instructions: ['Please continue'],
};

// Invalid: Missing value field - demonstrate via function parameter
function expectAccepted(x: ToolCallAccepted<TestParams>) {}
// @ts-expect-error - value is required
expectAccepted({ ok: true });

// Valid: Empty feedback can't be assigned directly but TypeScript catches it at array level
// We demonstrate that NonEmptyArray type prevents empty arrays
function checkFeedback(x: ToolCallAccepted<TestParams>) {}
const emptyFeedback: [] = [];
// @ts-expect-error - empty array cannot be NonEmptyArray
checkFeedback({ ok: true, value: { name: 'John', age: 30 }, feedback: emptyFeedback });

// ==================== ToolCallRejected Tests ====================

// Valid: Rejected with validation results
const validRejectedWithValidation: ToolCallRejected<TestParams> = {
  ok: false,
  validationResults: {
    name: {
      valid: false,
      refusalReasons: ['Name is too short'],
    },
  },
};

// Valid: Rejected with validation results
const invalidRejectedWithValidation: ToolCallRejected<TestParams> = {
  ok: false,
  // @ts-expect-error - need at least one key here
  validationResults: {},
};

// @ts-expect-error - need at least one key here
const invalidRejectedWithValidation2: ToolCallRejected<TestParams> = {
  ok: false,
};

// Valid: Rejected with rejection reasons
const validRejectedWithReasons: ToolCallRejected<TestParams> = {
  ok: false,
  rejectionReasons: ['System unavailable'],
};

// Valid: Rejected with both validation results and rejection reasons
const validRejectedWithBoth: ToolCallRejected<TestParams> = {
  ok: false,
  validationResults: {
    age: {
      valid: false,
      refusalReasons: ['Age is out of range'],
    },
  },
  rejectionReasons: ['Additional system error'],
};

// Invalid: Rejected with neither validation results nor rejection reasons (violates AtLeastOne)
// Demonstrated via function parameter
function expectRejected(x: ToolCallRejected<TestParams>) {}
// @ts-expect-error - at least one of validationResults or rejectionReasons is required
expectRejected({ ok: false });

// Demonstrate empty rejectionReasons detection
function checkRejected(x: ToolCallRejected<TestParams>) {}
const emptyReasons: [] = [];
// @ts-expect-error - empty array cannot be NonEmptyArray
checkRejected({ ok: false, rejectionReasons: emptyReasons });

// ==================== ParameterFeedback Tests ====================

// Valid: Parameter feedback with valid status
const validParamFeedbackValid: ParameterFeedback<TestParams, 'name'> = {
  valid: true,
};

// Valid: Parameter feedback with valid status and normalized value
const validParamFeedbackNormalized: ParameterFeedback<TestParams, 'name'> = {
  valid: true,
  normalizedValue: 'JOHN',
};

// Valid: Parameter feedback with valid status and allowed values
const validParamFeedbackAllowed: ParameterFeedback<TestParams, 'name'> = {
  valid: true,
  allowedValues: ['John', 'Jane', 'Bob'],
};

// Valid: Parameter feedback with invalid status and refusal reasons
const validParamFeedbackInvalid: ParameterFeedback<TestParams, 'name'> = {
  valid: false,
  refusalReasons: ['Name contains invalid characters'],
};

// Valid: Parameter feedback with invalid status and requires valid parameters
const validParamFeedbackRequires: ParameterFeedback<TestParams, 'email'> = {
  valid: false,
  requiresValidParameters: ['name'],
};

// Invalid: Parameter feedback with invalid status but no refusal info (violates AtLeastOne)
// Demonstrated via function parameter
function expectParamFeedbackInvalid(x: ParameterFeedback<TestParams, 'name'>) {}
// @ts-expect-error - invalid feedback must have refusalReasons or requiresValidParameters
expectParamFeedbackInvalid({ valid: false });

// Demonstrate empty array detection for parameter feedback
function checkParamFeedback(x: ParameterFeedback<TestParams, 'name'>) {}
const emptyRefusalReasons: [] = [];
// @ts-expect-error - empty array cannot be NonEmptyArray
checkParamFeedback({ valid: false, refusalReasons: emptyRefusalReasons });

const emptyRequires: [] = [];
// @ts-expect-error - empty array cannot be NonEmptyArray
checkParamFeedback({ valid: false, requiresValidParameters: emptyRequires });

// ==================== AcceptableValues Tests ====================

// Valid: No acceptable values specified
const validAcceptableNone: AcceptableValues<string> = {};

// Valid: Only allowedValues provided
const validAcceptableAllowed: AcceptableValues<string> = {
  allowedValues: ['option1', 'option2'],
};

// Valid: Only suggestedValues provided
const validAcceptableSuggested: AcceptableValues<string> = {
  suggestedValues: ['suggestion1', 'suggestion2'],
};

// Valid: Empty allowedValues array (indicates no options available)
const validAcceptableEmptyAllowed: AcceptableValues<string> = {
  allowedValues: [],
};

// Invalid: Both allowedValues and suggestedValues (violates AtMostOne)
// @ts-expect-error - at most one of allowedValues or suggestedValues can be provided
const invalidAcceptableBoth: AcceptableValues<string> = {
  allowedValues: ['option1'],
  suggestedValues: ['suggestion1'],
};

// Demonstrate empty suggestedValues detection
function checkAcceptable(x: AcceptableValues<string>) {}
const emptySuggested: [] = [];
// @ts-expect-error - empty array cannot be NonEmptyArray
checkAcceptable({ suggestedValues: emptySuggested });

// ==================== FreeFormFeedback Tests ====================

// Valid: No feedback
const validFeedbackNone: FreeFormFeedback = {};

// Valid: With feedback array
const validFeedbackWithFeedback: FreeFormFeedback = {
  feedback: ['Message 1', 'Message 2'],
};

// Valid: With instructions array
const validFeedbackWithInstructions: FreeFormFeedback = {
  instructions: ['Instruction 1'],
};

// Demonstrate empty feedback/instructions detection
function checkFreeForm(x: FreeFormFeedback) {}
const emptyFeedbackArray: [] = [];
// @ts-expect-error - empty array cannot be NonEmptyArray
checkFreeForm({ feedback: emptyFeedbackArray });

const emptyInstructions: [] = [];
// @ts-expect-error - empty array cannot be NonEmptyArray
checkFreeForm({ instructions: emptyInstructions });

// =========================== Dynamic parameter schema ================

const schema = z.object({
  field: z.enum(['a', 'b']),
  another: z.string(),
});

type SchemaType = z.infer<typeof schema>;

type JustType = {
  field: string;
};

// Valid: schema type is a subtype of JustType:
// - 'a' | 'b' < string
// - `another` field is not present in the type, but present in the schema
const paramFeedback: ParameterFeedbackCommon<JustType> = {
  dynamicParameterSchema: schema,
};

const paramFeedbackWrongSchema: ParameterFeedbackCommon<JustType> = {
  // @ts-expect-error `field` is not provided in the schema
  dynamicParameterSchema: z.object({
    someOtherField: z.enum(['a', 'b']),
  }),
};

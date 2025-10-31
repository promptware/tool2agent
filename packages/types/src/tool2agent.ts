import { type ZodType } from 'zod';
import { AtLeastOne, AtMostOne, NonEmptyArray } from './types.js';

/**
 * We enforce that the tool input type is a record of values.
 * The motivation for this is that we should be able to provide structured feedback
 * for each field.
 */
export type ToolInputType = Record<string, unknown>;

/** The outermost type that characterizes the outcome of a tool call.
 */
export type ToolCallResult<InputType extends ToolInputType, OutputType> =
  | ToolCallAccepted<OutputType>
  | ToolCallRejected<InputType>;

/**
 * Accepted tool call.
 * Must contain ok: true, the rest of the fields, and (optionally) feedback and instructions.
 */
export type ToolCallAccepted<OutputType> = {
  ok: true;
} &
  // If OutputType is never, we don't allow value fields at all.
  ([OutputType] extends [never]
    ? {
        value?: never; // Explicitly disallow value property
      }
    : // If OutputType is Record<string, never> (empty object from z.object({})), treat it like never (we do not add any value fields)
      [OutputType] extends [Record<string, never>]
      ? {
          value?: never; // Explicitly disallow value property
        }
      : // If OutputType is {} (plain empty object), treat it like never
        [OutputType] extends [{}]
        ? // If OutputType has keys, use it directly (i.e. object keys are placed alongside ok:true)
          FlattenOrWrapInValueField<OutputType>
        : // If OutputType is a record, we use it directly
          FlattenOrWrapInValueField<OutputType>) &
  FreeFormFeedback;

type FlattenOrWrapInValueField<T> = [T] extends [Record<string, unknown>]
  ? T
  : {
      value: T;
    };

export type FreeFormFeedback = {
  /** Freeform feedback for the tool call. */
  feedback?: NonEmptyArray<string>;
  /** Freeform instructions for the agent in response to the tool call.
   * The developer may instruct the agent to follow these instructions via the system prompt,
   * or filter them out.
   */
  instructions?: NonEmptyArray<string>;
};

/**
 * Rejected tool call.
 * Mandates at least one feedback item.
 */
export type ToolCallRejected<InputType extends ToolInputType> = {
  ok: false;
} & AtLeastOne<{
  /**
   * not every parameter in the input type is required to be present,
   * but we require at least one to ensure the LLM can make some progress
   * on refining input.
   */
  validationResults: AtLeastOne<{
    [ParamKey in keyof InputType]?: ParameterFeedback<InputType, ParamKey>;
  }>;
  rejectionReasons: NonEmptyArray<string>;
}> &
  FreeFormFeedback;

export type ParameterFeedback<
  InputType extends ToolInputType,
  ParamKey extends keyof InputType,
> = ParameterFeedbackCommon<InputType[ParamKey]> & ParameterFeedbackVariants<InputType>;

/**
 * Feedback for a single tool call parameter.
 */
export type ParameterFeedbackCommon<T> = {
  /** The tooling may normalize values to a canonical form */
  normalizedValue?: T;
  /**
   * The tooling may dynamically validate the parameter based on the context
   * This is useful for parameters whose shape is not statically known at design time
   */
  dynamicParameterSchema?: ZodType<T>;
} & AcceptableValues<T> &
  FreeFormFeedback;

/** Provides feedback that suggests acceptable values for the parameter. */
export type AcceptableValues<T> = AtMostOne<{
  /**
   * Exhaustive list of acceptable values.
   * Empty indicates that there are no options available.
   */
  allowedValues: T[];
  /** Non-exhaustive list of acceptable values */
  suggestedValues: NonEmptyArray<T>;
}>;

/** Validation result for a single tool call input object field. */
export type ParameterFeedbackVariants<InputType extends ToolInputType> =
  | {
      valid: true;
    }
  | ({
      valid: false;
    } & ParameterFeedbackRefusal<InputType>);

/** Refusal result for a single tool call input object field. Mandates at least one justification for the refusal. */
export type ParameterFeedbackRefusal<InputType extends ToolInputType> = AtLeastOne<{
  /** Freeform reasons for why the parameter was not considered valid. */
  refusalReasons?: NonEmptyArray<string>;
  /**
   * Sometimes it is not possible to validate a parameter without knowing the values of other parameters.
   * In this case, the developer may specify the parameters that are required to validate this parameter.
   */
  requiresValidParameters?: NonEmptyArray<keyof InputType>;
}>;

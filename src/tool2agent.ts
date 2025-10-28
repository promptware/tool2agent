import z from 'zod';
import { AtLeastOne, AtMostOne, NonEmptyArray } from './types.js';

// We enforce that the tool input type is a record of values.
export type ToolInputType = Record<string, unknown>;

// The outermost type that characterizes the outcome of a tool call.
export type ToolCallResult<Params extends ToolInputType> =
  | ToolCallAccepted<Params>
  | ToolCallRejected<Params>;

/* Accepted tool call */

export type ToolCallAccepted<Params extends ToolInputType> = {
  ok: true;
  value: Params;
  // We include free form feedback for the whole tool call.
} & FreeFormFeedback;

export type FreeFormFeedback = {
  // Freeform feedback for the tool call.
  feedback?: NonEmptyArray<string>;
  // Freeform instructions for the agent in response to the tool call.
  // The developer may instruct the agent to follow these instructions via the system prompt,
  // or filter them out.
  instructions?: NonEmptyArray<string>;
};

/* Rejected tool call */

export type ToolCallRejected<Params extends ToolInputType> = {
  ok: false;
  // We force the developer to provide at least one feedback item.
} & AtLeastOne<{
  // not every parameter in the input type is required to be present,
  // but we require at least one.
  validationResults: AtLeastOne<{
    [ParamKey in keyof Params]?: ParameterFeedback<Params, ParamKey>;
  }>;
  rejectionReasons: NonEmptyArray<string>;
}> &
  FreeFormFeedback;

export type ParameterFeedback<
  Params extends ToolInputType,
  ParamKey extends keyof Params,
> = ParameterFeedbackCommon<Params[ParamKey]> & ParameterFeedbackVariants<Params>;

// Feedback for a single tool call parameter in a single tool call invocation
export type ParameterFeedbackCommon<T, SchemaType extends T = T> = {
  // The tooling may normalize values to a canonical form
  normalizedValue?: T;
  // The tooling may dynamically validate the parameter based on the context
  // This is useful for parameters the shape of which is not statically known at design time
  dynamicParameterSchema?: z.ZodType<SchemaType>;
} & AcceptableValues<T> &
  // We include free form feedback for the parameter specifically.
  FreeFormFeedback;

export type AcceptableValues<T> = AtMostOne<{
  // Exhaustive list of acceptable values.
  // Empty indicates that there are no options available.
  allowedValues: T[];
  // Non-exhaustive list of acceptable values
  suggestedValues: NonEmptyArray<T>;
}>;

export type ParameterFeedbackVariants<Params extends ToolInputType> =
  | {
      valid: true;
    }
  | ({
      valid: false;
    } & ParameterFeedbackRefusal<Params>);

export type ParameterFeedbackRefusal<Params extends ToolInputType> = AtLeastOne<
  {
    // Freeform reasons for why the parameter was not considered valid.
    refusalReasons?: NonEmptyArray<string>;
    // Sometimes it is not possible to validate a parameter without knowing the values of other parameters.
    // In this case, the developer may specify the parameters that are required to validate the parameter.
    requiresValidParameters?: NonEmptyArray<keyof Params>;
  },
  'refusalReasons' | 'requiresValidParameters'
>;

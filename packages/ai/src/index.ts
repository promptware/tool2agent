import {
  type Tool,
  ToolCallOptions,
  ToolExecuteFunction,
  tool,
  type FlexibleSchema,
  dynamicTool,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import type { ToolCallResult, ToolInputType } from '@tool2agent/types';

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
  ) => Promise<ToolCallResult<InputType, OutputType>> | ToolCallResult<InputType, OutputType>;
};

export type Tool2Agent<InputType extends ToolInputType, OutputType> = Tool<
  Partial<InputType>,
  ToolCallResult<InputType, OutputType>
>;

export function tool2agent<
  InputType extends ToolInputType,
  OutputType extends unknown,
  InputSchema extends z.ZodType<InputType> = z.ZodType<InputType>,
  OutputSchema extends z.ZodType<OutputType> = z.ZodType<OutputType>,
>(
  params: Omit<
    Tool<InputType, OutputType>,
    'execute' | 'inputSchema' | 'outputSchema' | 'toModelOutput'
  > &
    Tool2AgentOptions<InputType, OutputType, InputSchema, OutputSchema>,
): Tool2Agent<InputType, OutputType> {
  const { execute, inputSchema, outputSchema, type, ...rest } = params;
  type PartialInputType = Partial<InputType>;
  type PartialInputSchema = FlexibleSchema<PartialInputType>;
  // .partial() call is safe because InputSchema is z.ZodObject. This is guaranteed because InputType
  // extends an object, and InputSchema is tied to InputType.
  const partialInputSchema: PartialInputSchema = (inputSchema as any).partial();

  const executeFunction = async (
    input: PartialInputType,
    options: ToolCallOptions,
  ): Promise<ToolCallResult<InputType, OutputType>> => {
    // format exception into tool2agent rejection reason
    const handleError = (stage: string, error: unknown) => {
      if (error instanceof Error) {
        if (error.message && error.name) {
          return {
            ok: false,
            rejectionReasons: [
              `Exception occured during ${stage}: ` + error.name + ': ' + error.message,
            ],
          };
        }
        return {
          ok: false,
          rejectionReasons: [`Exception occured during ${stage}: ` + error.stack],
        };
      }
      return {
        ok: false,
        rejectionReasons: [`Exception occured during ${stage}: ` + String(error)],
      };
    };

    // execute the tool with the validated payload
    try {
      return await params.execute(input, options);
    } catch (error: unknown) {
      return handleError('tool call execution', error) as ToolCallResult<InputType, OutputType>;
    }
  };

  if (type === 'function') {
    const theTool: Tool<PartialInputType, ToolCallResult<InputType, OutputType>> = {
      ...rest,
      type: 'function' as const,
      inputSchema: partialInputSchema,
      // We omit outputSchema, but actually it could have been provided.
      // It could have been something like this:
      // outputSchema: outputSchema as unknown as FlexibleSchema<
      //   OutputType | ToolCallRejected<InputType>
      // >,
      // Since it is not checked, it does not matter.
      execute: executeFunction,
      // hack: make the typechecker happy.
      // We don't need toModelOutput because it is assumed that the output is JSON-serializable.
      toModelOutput: undefined,
      // we trigger onInputAvailable above, after the validation phase.
      onInputAvailable: undefined,
    };
    // tool() is an identity function but we call it anyway for the love of the game
    return tool(theTool);
  } else {
    const definition = dynamicTool({
      ...rest,
      inputSchema: partialInputSchema,
      execute: executeFunction as ToolExecuteFunction<unknown, unknown>,
      // hack: make the typechecker happy.
      // We don't need toModelOutput because it is assumed that the output is JSON-serializable.
      toModelOutput: undefined,
    });
    // hack: patch type: dynamic back to the original type
    definition.type = type as any;
    return definition as unknown as Tool2Agent<InputType, OutputType>;
  }
}

import {
  type Tool,
  ToolCallOptions,
  ToolExecuteFunction,
  tool,
  dynamicTool,
} from '@ai-sdk/provider-utils';
import { z } from 'zod';
import type { ToolCallResult, ToolInputType } from '@tool2agent/types';

export type Tool2AgentOptions<
  InputSchema extends z.ZodObject<any>,
  OutputSchema extends z.ZodType<any> = z.ZodNever,
> = {
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
  execute: (
    params: Partial<z.infer<InputSchema>>,
    options?: ToolCallOptions,
  ) =>
    | Promise<ToolCallResult<z.infer<InputSchema> & ToolInputType, z.infer<OutputSchema>>>
    | ToolCallResult<z.infer<InputSchema> & ToolInputType, z.infer<OutputSchema>>;
};

export type Tool2Agent<InputType extends ToolInputType, OutputType> = Tool<
  Partial<InputType>,
  ToolCallResult<InputType, OutputType>
>;

export function tool2agent<
  InputSchema extends z.ZodObject<any>,
  OutputSchema extends z.ZodType<any> = z.ZodNever,
>(
  params: Omit<
    Tool<z.infer<InputSchema> & ToolInputType, z.infer<OutputSchema>>,
    'execute' | 'inputSchema' | 'outputSchema' | 'toModelOutput'
  > &
    Tool2AgentOptions<InputSchema, OutputSchema>,
): Tool2Agent<z.infer<InputSchema> & ToolInputType, z.infer<OutputSchema>> {
  const { execute, inputSchema, outputSchema, type, ...rest } = params;
  type InputType = z.infer<InputSchema> & ToolInputType;
  type OutputType = z.infer<OutputSchema>;
  type PartialInputType = Partial<InputType>;
  type PartialInputSchema = z.ZodType<PartialInputType>;
  // .partial() call is safe because InputSchema extends z.ZodObject<any>
  // We cast to satisfy TypeScript's type checker, but this is safe at runtime.
  const partialInputSchema = inputSchema.partial() as any as PartialInputSchema;

  const executeFunction = async (
    input: PartialInputType,
    options: ToolCallOptions,
  ): Promise<ToolCallResult<InputType, OutputType>> => {
    // format exception into tool2agent rejection reason
    const handleError = (error: unknown) => {
      const errorMessage = `Exception occured during tool call execution: `;
      if (error instanceof Error) {
        if (error.message && error.name) {
          return {
            ok: false,
            rejectionReasons: [errorMessage + error.name + ': ' + error.message],
          };
        }
        return {
          ok: false,
          rejectionReasons: [errorMessage + error.stack],
        };
      }
      return {
        ok: false,
        rejectionReasons: [errorMessage + String(error)],
      };
    };

    // execute the tool with the validated payload
    try {
      return (await params.execute(input, options)) as ToolCallResult<InputType, OutputType>;
    } catch (error: unknown) {
      return handleError(error) as ToolCallResult<InputType, OutputType>;
    }
  };

  // We have to branch on the presence of type: 'function' to let the typechecker
  // catch up with us
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
    return tool(theTool) as Tool2Agent<InputType & ToolInputType, OutputType>;
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
    return definition as unknown as Tool2Agent<InputType & ToolInputType, OutputType>;
  }
}

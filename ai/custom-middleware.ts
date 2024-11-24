import {
    LanguageModelV1,
    LanguageModelV1CallOptions,
    LanguageModelV1FunctionToolCall,
    LanguageModelV1StreamPart
} from "@ai-sdk/provider";
import { Experimental_LanguageModelV1Middleware } from "ai";

import { executePythonCode, InterpreterArgs, pythonInterpreterTool } from "./python-interpreter";

export const customMiddleware: Experimental_LanguageModelV1Middleware = {
    transformParams: (options: {
        type: 'generate' | 'stream';
        params: LanguageModelV1CallOptions;
    }): PromiseLike<LanguageModelV1CallOptions> => {
        return Promise.resolve({
            ...options.params,
            mode: {
                type: 'regular',
                tools: [pythonInterpreterTool],
                toolChoice: { type: 'auto' }
            }
        });
    },

    wrapStream: async ({ doStream, params: _params, model: _model }) => {
        const streamResponse = await doStream();
        let currentToolCall: Partial<LanguageModelV1FunctionToolCall> | null = null;
        let accumulatedArgs = '';
        let isInToolCall = false;

        return {
            stream: new ReadableStream<LanguageModelV1StreamPart>({
                async start(controller) {
                    const reader = streamResponse.stream.getReader();

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) {
                                if (currentToolCall && accumulatedArgs) {
                                    try {
                                        const args = JSON.parse(accumulatedArgs) as InterpreterArgs;

                                        // Emit tool call start
                                        controller.enqueue({
                                            type: 'tool-call',
                                            toolCallId: currentToolCall.toolCallId!,
                                            toolName: 'executePythonCode',
                                            toolCallType: 'function',
                                            args: accumulatedArgs
                                        });

                                        // Execute the tool
                                        const result = await executePythonCode(args);

                                        // Emit tool result
                                        controller.enqueue({
                                            type: 'text-delta',
                                            textDelta: '\n```\n' +
                                                (result.success ?
                                                    (result.output || 'Code executed successfully.') :
                                                    `Error: ${result.error?.message}`) +
                                                '\n```\n'
                                        });

                                        // Emit metadata about the tool execution
                                        controller.enqueue({
                                            type: 'response-metadata',
                                            id: currentToolCall.toolCallId,
                                            timestamp: new Date(),
                                            modelId: 'python-interpreter'
                                        });
                                    } catch (e) {
                                        console.error('Tool execution error:', e);
                                        controller.enqueue({
                                            type: 'error',
                                            error: e as Error
                                        });
                                    }
                                }

                                controller.enqueue({
                                    type: 'finish',
                                    finishReason: 'stop',
                                    usage: {
                                        promptTokens: 0,
                                        completionTokens: 0,
                                    }
                                });
                                break;
                            }

                            if (value.type === 'tool-call' || value.type === 'tool-call-delta') {
                                if (!isInToolCall) {
                                    isInToolCall = true;
                                    currentToolCall = {
                                        toolCallId: `call_${Date.now()}`,
                                        toolCallType: 'function',
                                        toolName: 'executePythonCode',
                                        args: ''
                                    };
                                }

                                if (value.type === 'tool-call-delta' && value.argsTextDelta) {
                                    accumulatedArgs += value.argsTextDelta;

                                    // Try to parse accumulated args to see if we have complete JSON
                                    try {
                                        const parsedArgs = JSON.parse(accumulatedArgs);
                                        if (parsedArgs.code) {
                                            // Emit the code as text
                                            controller.enqueue({
                                                type: 'text-delta',
                                                textDelta: '\n```python\n' + parsedArgs.code + '\n```\n'
                                            });
                                        }
                                    } catch (e) {
                                        // Continue accumulating if JSON is incomplete
                                    }
                                }
                            } else if (value.type === 'text-delta' && !isInToolCall) {
                                controller.enqueue(value);
                            }
                        }
                    } catch (error) {
                        console.error('Stream error:', error);
                        controller.enqueue({
                            type: 'error',
                            error: error as Error
                        });
                    } finally {
                        reader.releaseLock();
                        controller.close();
                    }
                }
            }),
            rawCall: streamResponse.rawCall,
            rawResponse: streamResponse.rawResponse || {},
            warnings: streamResponse.warnings || []
        };
    },

    wrapGenerate: async ({
        doGenerate,
        params: _params,
        model: _model
    }: {
        doGenerate: () => ReturnType<LanguageModelV1['doGenerate']>;
        params: LanguageModelV1CallOptions;
        model: LanguageModelV1;
    }) => {
        const response = await doGenerate();

        if (response.toolCalls?.length) {
            const updatedToolCalls = await Promise.all(response.toolCalls.map(async (toolCall) => {
                if (toolCall.toolCallType === 'function' && toolCall.toolName === 'executePythonCode') {
                    const args = JSON.parse(toolCall.args) as InterpreterArgs;
                    const result = await executePythonCode(args);
                    return {
                        ...toolCall,
                        function: {
                            ...toolCall,
                            output: JSON.stringify(result)
                        }
                    };
                }
                return toolCall;
            }));

            return {
                ...response,
                toolCalls: updatedToolCalls as LanguageModelV1FunctionToolCall[]
            };
        }

        return response;
    }
};

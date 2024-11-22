import {
    LanguageModelV1,
    LanguageModelV1CallOptions,
    LanguageModelV1FunctionToolCall,
    LanguageModelV1StreamPart
} from "@ai-sdk/provider";
import {Experimental_LanguageModelV1Middleware} from "ai";

import {executePythonCode, InterpreterArgs, pythonInterpreterTool} from "./python-interpreter";

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
                toolChoice: {type: 'auto'}
            }
        });
    },

    wrapStream: async ({doStream, params: _params, model: _model}) => {
        const streamResponse = await doStream();
        let currentToolCall: Partial<LanguageModelV1FunctionToolCall> | null = null;
        let accumulatedArgs = '';
        let isInToolCall = false;
        let hasShownCodeBlock = false;

        return {
            stream: new ReadableStream<LanguageModelV1StreamPart>({
                async start(controller) {
                    const reader = streamResponse.stream.getReader();

                    try {
                        while (true) {
                            const {done, value} = await reader.read();

                            if (done) {
                                if (currentToolCall && accumulatedArgs) {
                                    try {
                                        if (!hasShownCodeBlock) {
                                            controller.enqueue({
                                                type: 'text-delta',
                                                textDelta: '\n```\n'
                                            });
                                        }
                                        const args = JSON.parse(accumulatedArgs) as InterpreterArgs;
                                        const result = await executePythonCode(args);
                                        controller.enqueue({
                                            type: 'text-delta',
                                            textDelta: '\nExecution Result:\n```\n' +
                                                (result.success ? (result.output || 'Code executed successfully.') :
                                                    `Error: ${result.error?.message}`) +
                                                '\n```\n'
                                        });
                                    } catch (e) {
                                        console.error('Final execution error:', e);
                                        controller.enqueue({
                                            type: 'text-delta',
                                            textDelta: `\nError executing code: ${e}\n`
                                        });
                                    }
                                }
                                controller.enqueue({
                                    type: 'finish',
                                    finishReason: 'stop',
                                    usage: {promptTokens: 0, completionTokens: 0}
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
                                    controller.enqueue({
                                        type: 'text-delta',
                                        textDelta: '\nHere\'s the Python code:\n```python\n'
                                    });
                                }

                                if (value.type === 'tool-call-delta' && value.argsTextDelta) {
                                    accumulatedArgs += value.argsTextDelta;
                                    try {
                                        const partialArgs = JSON.parse(accumulatedArgs);
                                        if (partialArgs.code && !hasShownCodeBlock) {
                                            controller.enqueue({
                                                type: 'text-delta',
                                                textDelta: partialArgs.code
                                            });
                                            hasShownCodeBlock = true;
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
                            error: error
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

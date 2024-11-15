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
    },

    wrapStream: async ({
                           doStream,
                           params: _params,
                           model: _model
                       }) => {
        const streamResponse = await doStream();

        return {
            stream: new ReadableStream<LanguageModelV1StreamPart>({
                async start(controller) {
                    const reader = streamResponse.stream.getReader();

                    try {
                        while (true) {
                            const {done, value} = await reader.read();

                            if (done) {
                                // Ensure we send a proper finish event before closing
                                controller.enqueue({
                                    type: 'finish',
                                    finishReason: 'stop',
                                    usage: {
                                        promptTokens: 0,
                                        completionTokens: 0
                                    }
                                });
                                break;
                            }

                            if (value.type === 'tool-call' &&
                                value.toolCallType === 'function' &&
                                value.toolName === 'executePythonCode') {
                                const args = JSON.parse(value.args) as InterpreterArgs;
                                const result = await executePythonCode(args);

                                // Ensure all required fields are defined
                                controller.enqueue({
                                    type: 'tool-call',
                                    toolCallType: "function",
                                    toolCallId: value.toolCallId || `call_${Date.now()}`,
                                    toolName: value.toolName,
                                    args: JSON.stringify({
                                        code: args.code || '',
                                        result: result || ''
                                    })
                                });

                                // Send result as text
                                controller.enqueue({
                                    type: 'text-delta',
                                    textDelta: `\nResult: ${JSON.stringify(result || '', null, 2)}`
                                });
                            } else {
                                // Ensure we don't pass undefined values
                                controller.enqueue({
                                    ...value,
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Stream error:', error);
                        // Ensure we send an error event
                        controller.enqueue({
                            type: 'error',
                            error: error || new Error('Unknown error occurred')
                        });
                    } finally {
                        reader.releaseLock();
                        controller.close();
                    }
                }
            }),
            rawCall: {
                rawPrompt: streamResponse.rawCall?.rawPrompt || '',
                rawSettings: streamResponse.rawCall?.rawSettings || {}
            },
            rawResponse: streamResponse.rawResponse || {},
            warnings: streamResponse.warnings || []
        };
    }
};

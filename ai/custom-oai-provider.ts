import {createOpenAI} from "@ai-sdk/openai";
import {LanguageModelV1} from '@ai-sdk/provider';

import {executePythonCode, pythonInterpreterTool} from './python-interpreter';

const localOpenAI = createOpenAI({
    baseURL: 'http://localhost:4000',
    compatibility: 'compatible',
    headers: {
        'Content-Type': 'application/json'
    }
});

const customOpenAIProvider = {
    ...localOpenAI,
    languageModel: (modelId: string, settings?: any): LanguageModelV1 => {
        const model = localOpenAI.languageModel(modelId, {
            ...settings,
        });

        const originalDoGenerate = model.doGenerate.bind(model);
        model.doGenerate = async (options) => {
            console.log('Starting function call with options:', JSON.stringify(options, null, 2));
            const response = await originalDoGenerate({
                ...options,
                mode: {
                    type: 'regular',
                    tools: [pythonInterpreterTool],
                    toolChoice: {type: 'auto'}
                }
            });
            console.log('Received response:', JSON.stringify(response, null, 2));
            if (response.toolCalls?.length) {
                console.log('Tool calls detected:', JSON.stringify(response.toolCalls, null, 2));
                const toolCall = response.toolCalls[0];
                if (toolCall.toolName === 'executePythonCode') {
                    try {
                        const args = JSON.parse(toolCall.args);
                        console.log('Executing Python code with args:', args);
                        const result = await executePythonCode(args);
                        console.log('Python execution result:', result);

                        // Format the response to include both the code and its result
                        return {
                            ...response,
                            text: `I'll execute this Python code:\n\`\`\`python\n${args.code}\n\`\`\`\n\nResult:\n${JSON.stringify(result, null, 2)}`
                        };
                    } catch (err: any) {
                        console.error('Error executing Python code:', err);
                        return {
                            ...response,
                            text: `Error executing Python code: ${err.message}`
                        };
                    }
                }
            }

            return response;
        };

        const originalDoStream = model.doStream.bind(model);
        model.doStream = async (options: any) => {
            const streamResponse = await originalDoStream({
                ...options,
                mode: {
                    type: 'regular',
                    tools: [pythonInterpreterTool],
                    toolChoice: {type: 'auto'}
                }
            });

            // Return both the stream and rawCall information
            return {
                stream: streamResponse.stream,
                rawCall: {
                    rawPrompt: streamResponse.rawCall?.rawPrompt || '',
                    rawSettings: streamResponse.rawCall?.rawSettings || {}
                },
                rawResponse: streamResponse.rawResponse || {},
                warnings: streamResponse.warnings || []
            };
        };

        return model;
    }
};

export default customOpenAIProvider;

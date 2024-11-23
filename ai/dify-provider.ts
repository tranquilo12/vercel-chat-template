import {
    LanguageModelV1FinishReason,
    LanguageModelV1FunctionToolCall,
    LanguageModelV1ProviderMetadata
} from "@ai-sdk/provider";
import {
    JSONValue,
    LanguageModelV1,
    LanguageModelV1CallOptions,
    LanguageModelV1StreamPart,
    NoSuchModelError,
    Provider
} from 'ai';

// Add proper type definitions for Dify's response format
interface DifyMetadata {
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        total_price: string;
        currency: string;
        latency: number;
    };
    retriever_resources?: Array<{
        position: number;
        dataset_id: string;
        dataset_name: string;
        document_id: string;
        document_name: string;
        segment_id: string;
        score: number;
        content: string;
    }>;
}

interface DifyResponse {
    message_id: string;
    conversation_id: string;
    mode: string;
    answer: string;
    metadata:
        {
            usage: {
                prompt_tokens: number;
                completion_tokens: number;
                total_tokens: number;
                total_price: string;
                currency: string;
                latency: number;
            };
            retriever_resources?: Array<{
                position: number;
                dataset_id: string;
                dataset_name: string;
                document_id: string;
                document_name: string;
                segment_id: string;
                score: number;
                content: string;
            }>;
        };
    created_at: number;
}

interface DifyStreamResponse {
    event: 'message' | 'message_end' | 'error' | 'ping';
    task_id?: string;
    message_id?: string;
    conversation_id?: string;
    answer?: string;
    metadata?: DifyMetadata;
    status?: number;
    code?: string;
    message?: string;
    created_at?: number;
}

class CustomOpenAIModel implements LanguageModelV1 {
    readonly specificationVersion = 'v1';
    readonly provider: string;
    readonly modelId: string;
    readonly defaultObjectGenerationMode = 'json' as const;
    readonly supportsImageUrls = true;
    readonly supportsStructuredOutputs = true;

    private baseURL: string;
    private apiKey: string;

    constructor(provider: string, modelId: string, baseURL: string, apiKey: string) {
        this.provider = provider;
        this.modelId = modelId;
        this.baseURL = baseURL;
        this.apiKey = apiKey;
    }

    async doGenerate(options: LanguageModelV1CallOptions): Promise<{
        text?: string;
        toolCalls?: LanguageModelV1FunctionToolCall[];
        finishReason: LanguageModelV1FinishReason;
        usage: {
            promptTokens: number;
            completionTokens: number;
        };
        rawCall: {
            rawPrompt: unknown;
            rawSettings: Record<string, unknown>;
        };
        rawResponse?: {
            headers?: Record<string, string>;
        };
        providerMetadata?: LanguageModelV1ProviderMetadata;
    }> {        // Convert messages to Dify format
        const lastUserMessage = options.prompt.filter(msg => msg.role === 'user').pop();
        if (!lastUserMessage) {
            throw new Error('No user message found in prompt');
        }

        const query = lastUserMessage.content
            .filter(part => part.type === 'text')
            .map(part => (part as { text: string }).text)
            .join('');

        const conversation_id = options.prompt
            .find(msg => msg.providerMetadata?.dify?.conversation_id)
            ?.providerMetadata?.dify?.conversation_id;

        const requestBody = {
            query,
            conversation_id,
            response_mode: 'blocking',
            model: this.modelId,
            inputs: {},
            user: options.prompt.find(msg => msg.providerMetadata?.dify?.user)
                ?.providerMetadata?.dify?.user || 'default-user'
        };

        const response = await fetch(`${this.baseURL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                ...options.headers
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: DifyResponse = await response.json();

        return {
            text: data.answer,
            finishReason: 'stop',
            usage: {
                promptTokens: data.metadata.usage.prompt_tokens,
                completionTokens: data.metadata.usage.completion_tokens,
            },
            rawCall: {
                rawPrompt: requestBody,
                rawSettings: options
            },
            rawResponse: {
                headers: Object.fromEntries(response.headers.entries())
            },
            providerMetadata: {
                dify: {
                    conversation_id: data.conversation_id,
                    message_id: data.message_id,
                    created_at: data.created_at
                }
            }
        };
    }

    async doStream(options: LanguageModelV1CallOptions) {
        const lastUserMessage = options.prompt.filter(msg => msg.role === 'user').pop();
        if (!lastUserMessage) {
            throw new Error('No user message found in prompt');
        }

        const query = lastUserMessage.content
            .filter(part => part.type === 'text')
            .map(part => (part as { text: string }).text)
            .join('');

        const conversation_id = options.prompt
            .find(msg => msg.providerMetadata?.dify?.conversation_id)
            ?.providerMetadata?.dify?.conversation_id;

        const requestBody = {
            query,
            conversation_id,
            response_mode: 'streaming',
            model: this.modelId,
            inputs: {},
            user: options.prompt.find(msg => msg.providerMetadata?.dify?.user)
                ?.providerMetadata?.dify?.user || 'default-user'
        };

        const response = await fetch(`${this.baseURL}/chat-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
                'Accept': 'text/event-stream',
                ...options.headers
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const stream = new ReadableStream<LanguageModelV1StreamPart>({
            async start(controller) {
                const reader = response.body!.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const {done, value} = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, {stream: true});
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                const data = line.slice(6);
                                try {
                                    const parsed: DifyStreamResponse = JSON.parse(data);

                                    switch (parsed.event) {
                                        case 'message':
                                            if (parsed.answer) {
                                                controller.enqueue({
                                                    type: 'text-delta',
                                                    textDelta: parsed.answer
                                                });
                                            }
                                            break;

                                        case 'message_end':
                                            if (parsed.metadata) {
                                                const difyMetadata: Record<string, JSONValue> = {
                                                    retriever_resources: parsed.metadata.retriever_resources || {},
                                                    usage: parsed.metadata.usage
                                                };

                                                // Only add optional fields if they exist
                                                if (parsed.message_id) {
                                                    difyMetadata.message_id = parsed.message_id;
                                                }

                                                if (parsed.conversation_id) {
                                                    difyMetadata.conversation_id = parsed.conversation_id;
                                                }

                                                if (parsed.created_at !== undefined) {
                                                    difyMetadata.created_at = parsed.created_at;
                                                }

                                                const providerMetadata: LanguageModelV1ProviderMetadata = {
                                                    dify: difyMetadata
                                                };

                                                controller.enqueue({
                                                    type: 'finish',
                                                    finishReason: 'stop',
                                                    usage: {
                                                        promptTokens: parsed.metadata.usage.prompt_tokens,
                                                        completionTokens: parsed.metadata.usage.completion_tokens
                                                    },
                                                    providerMetadata
                                                });
                                            } else {
                                                controller.enqueue({
                                                    type: 'finish',
                                                    finishReason: 'stop',
                                                    usage: {
                                                        promptTokens: 0,
                                                        completionTokens: 0
                                                    }
                                                });
                                            }
                                            break;
                                        case 'error':
                                            controller.enqueue({
                                                type: 'error',
                                                error: new Error(parsed.message)
                                            });
                                            break;
                                    }
                                } catch (e) {
                                    console.error('Failed to parse SSE message:', e);
                                }
                            }
                        }
                    }
                } catch (error) {
                    controller.enqueue({
                        type: 'error',
                        error
                    });
                } finally {
                    controller.close();
                }
            }
        });

        return {
            stream,
            rawCall: {
                rawPrompt: requestBody,
                rawSettings: options
            },
            rawResponse: {
                headers: Object.fromEntries(response.headers.entries())
            }
        };
    }
}

export class DifyProvider implements Provider {
    private baseURL: string;
    private apiKey: string;

    constructor(config: { baseURL: string; apiKey: string }) {
        this.baseURL = config.baseURL;
        this.apiKey = config.apiKey;
    }

    languageModel(modelId: string): CustomOpenAIModel {
        return new CustomOpenAIModel('dify', modelId, this.baseURL, this.apiKey);
    }

    textEmbeddingModel(): never {
        throw new NoSuchModelError({
            modelId: 'embedding',
            modelType: 'textEmbeddingModel'
        });
    }
}

export const createCustomOpenAI = (config: { baseURL: string; apiKey: string }) => {
    const provider = new DifyProvider(config);
    return (modelId: string) => provider.languageModel(modelId);
};

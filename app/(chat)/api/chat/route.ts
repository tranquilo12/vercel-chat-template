/* eslint-disable import/order */
import { convertToCoreMessages, CoreMessage, JSONValue, StreamData, streamText } from 'ai';

import { openaiModel } from '@/ai';
import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById, saveChat } from '@/db/queries';
import { z } from 'zod';

// Define InterpreterArgs
export interface InterpreterArgs {
    code: string;
    output_format: 'plain' | 'rich' | 'json';
    timeout?: number;
}

// Type for our interpreter response
export interface InterpreterResponse {
    success: boolean;
    output?: string;
    error?: {
        type: string;
        message: string;
    };
}


export async function POST(req: Request) {
    const body = await req.json();
    const { chatId, messages } = body;

    const session = await auth();
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    const coreMessages: CoreMessage[] = convertToCoreMessages(messages);
    const data = new StreamData();

    const result = await streamText({
        model: openaiModel,
        messages: coreMessages,
        experimental_toolCallStreaming: true,
        tools: {
            executePythonCode: {
                description: 'Execute Python code and return the output',
                parameters: z.object({
                    code: z.string().describe('The Python code to execute'),
                    output_format: z.enum(['plain', 'rich', 'json']).describe('The format of the output'),
                    timeout: z.number().optional().describe('Timeout in seconds for code execution')
                }),
                execute: async ({ code, output_format, timeout }: InterpreterArgs): Promise<InterpreterResponse> => {
                    try {
                        const response = await fetch('http://localhost:8000/api/v1/execute', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ code, output_format, timeout })
                        }).then(res => {
                            if (!res.ok) {
                                throw new Error(`HTTP error! status: ${res.status}`);
                            }
                            return res.json();
                        });

                        return await response.json();
                    } catch (error) {
                        return {
                            success: false,
                            error: {
                                type: 'ExecutionError',
                                message: error instanceof Error ? error.message : 'Unknown error occurred'
                            }
                        };
                    }
                }
            },
        },
        onChunk: async ({ chunk }) => {
            data.append(chunk as JSONValue);
        },
        onFinish: async ({ steps, responseMessages }) => {
            if (session.user && session.user.id) {
                try {
                    // Ensure tool invocations are included in the messages
                    const messagesWithTools = messages.map((msg: { toolInvocations: any; }) => ({
                        ...msg,
                        toolInvocations: msg.toolInvocations || []
                    }));

                    const responseWithTools = responseMessages.map((msg: CoreMessage) => ({
                        ...msg,
                        toolInvocations: 'toolInvocations' in msg ? msg.toolInvocations : []
                    }));

                    await saveChat({
                        id: chatId,
                        messages: [...messagesWithTools, ...responseWithTools],
                        userId: session.user.id,
                    });

                } catch (error) {
                    console.error('Failed to save chat:', error);
                    data.append({
                        type: 'error',
                        message: 'Failed to save chat',
                    });
                }
            }
            await data.close();
        },
    });

    return result.toDataStreamResponse({ data });
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);

    const id = searchParams.get("id");
    if (!id) {
        return new Response("Not Found", { status: 404 });
    }

    const session = await auth();
    if (!session || !session.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const chat = await getChatById({ id });
        if (chat.userId !== session.user.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        await deleteChatById({ id });
        return new Response("Chat deleted", { status: 200 });
    } catch (error) {
        return new Response("An error occurred while processing your request", {
            status: 500,
        });
    }
}

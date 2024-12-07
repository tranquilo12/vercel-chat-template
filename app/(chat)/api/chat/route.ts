/* eslint-disable import/order */
import { convertToCoreMessages, CoreMessage, generateId, JSONValue, StreamData, streamText, ToolCall, ToolResultPart } from 'ai';

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

// Define the shape of a step from the AI SDK
interface Step {
    id: string;
    messageId?: string;
    toolCalls?: ToolInvocation[];
    toolResults?: ToolResultPart[];
}

// Define the shape of our tool invocation
interface ToolInvocation {
    toolCallId: string;
    toolName: string;
    args: string;
    state: 'call' | 'result';
    result?: ToolResultPart;
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
            pythonInterpreterTool: {
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
                    // Create a map of message ID to tool calls
                    const messageToolCallsMap = new Map<string, ToolInvocation[]>();

                    // Process all steps and associate them with messages
                    (steps as unknown as Step[])?.forEach(step => {
                        if (step.messageId) {
                            if (!messageToolCallsMap.has(step.messageId)) {
                                messageToolCallsMap.set(step.messageId, []);
                            }

                            // Handle tool calls
                            if (step.toolCalls) {
                                step.toolCalls.forEach(toolCall => {
                                    messageToolCallsMap.get(step.messageId as string)?.push({
                                        toolCallId: toolCall.toolCallId,
                                        toolName: toolCall.toolName,
                                        args: typeof toolCall.args === 'string' ? toolCall.args : JSON.stringify(toolCall.args),
                                        state: 'call',
                                    });
                                });
                            }

                            // Handle tool results
                            if (step.toolResults) {
                                step.toolResults.forEach(result => {
                                    const existingCalls = messageToolCallsMap.get(step.messageId as string) || [];
                                    const callIndex = existingCalls.findIndex(
                                        call => call.toolCallId === result.toolCallId
                                    );

                                    if (callIndex !== -1) {
                                        existingCalls[callIndex] = {
                                            ...existingCalls[callIndex],
                                            state: 'result',
                                            result: result.result as ToolResultPart
                                        };
                                    } else {
                                        // If we receive a tool result without a previous call, create a new entry
                                        existingCalls.push({
                                            toolCallId: result.toolCallId,
                                            toolName: result.toolName || '',
                                            args: result.result as string,
                                            state: 'result',
                                            result: result.result as ToolResultPart
                                        });
                                    }
                                    messageToolCallsMap.set(step.messageId as string, existingCalls);
                                });
                            }
                        }
                    });

                    // Map response messages with their corresponding tool calls and results
                    const messagesWithTools = responseMessages.map(msg => {
                        const toolInvocations = messageToolCallsMap.get((msg as any).id || '') || [];

                        // Process tool results and associate them with their calls
                        toolInvocations.forEach(invocation => {
                            if (invocation.state === 'result' && invocation.result) {
                                // Store the result properly
                                invocation.result = invocation.result as ToolResultPart;
                            }
                        });

                        return {
                            ...msg,
                            content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                            toolInvocations: toolInvocations
                        };
                    });

                    // Create tool result messages
                    const toolResultMessages = Array.from(messageToolCallsMap.entries())
                        .flatMap(([messageId, toolCalls]) =>
                            toolCalls
                                .filter(call => call.state === 'result')
                                .map(call => ({
                                    id: generateId(),
                                    role: 'tool' as const,
                                    content: JSON.stringify([{
                                        type: 'tool-result',
                                        toolCallId: call.toolCallId,
                                        toolName: call.toolName,
                                        result: call.result
                                    }]),
                                    toolInvocations: []
                                }))
                        );

                    await saveChat({
                        id: chatId as string,
                        messages: [...coreMessages, ...messagesWithTools, ...toolResultMessages] as CoreMessage[],
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

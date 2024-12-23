import { StreamData, streamText, convertToCoreMessages, JSONValue } from 'ai';
import { z } from 'zod';

import { openaiModel } from "@/ai";
import { auth } from "@/app/(auth)/auth";
import { upsertFork, getForkById } from "@/db/queries";
import { getForkChain, getForkMessages } from "@/lib/forkUtils";
import { ExtendedMessage } from '@/types/tools';

export async function POST(
	req: Request,
	{ params }: { params: { id: string; forkId: string } }
) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const { messages, editPoint, parentMessageId } = await req.json();
		const data = new StreamData();

		// Convert messages to core format directly, matching main chat route
		const coreMessages = convertToCoreMessages(messages);

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
					execute: async ({ code, output_format, timeout }) => {
						try {
							const response = await fetch('http://localhost:8000/api/v1/execute', {
								method: 'POST',
								headers: { 'Content-Type': 'application/json' },
								body: JSON.stringify({ code, output_format, timeout })
							});
							if (!response.ok) {
								throw new Error(`HTTP error! status: ${response.status}`);
							}
							return response.json();
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
				}
			},
			onChunk: async ({ chunk }) => {
				data.append(chunk as JSONValue);
			},
			onFinish: async ({ steps, responseMessages }) => {
				try {
					const messagesWithTools = messages.map((msg: any) => ({
						...msg,
						toolInvocations: msg.toolInvocations || []
					}));

					const responseWithTools = (responseMessages as ExtendedMessage[]).map(msg => ({
						...msg,
						toolInvocations: 'toolInvocations' in msg ? msg.toolInvocations : []
					}));

					// Get base messages for fork context
					const fork = await getForkById({ id: params.forkId });
					const baseMessages = fork?.baseMessages || [];

					await upsertFork({
						id: params.forkId,
						chatId: params.id,
						parentMessageId: parentMessageId || messages[messages.length - 1]?.id,
						messages: [...messagesWithTools, ...responseWithTools],
						baseMessages,
						editPoint,
						status: 'draft'
					});
				} catch (error) {
					console.error('Failed to save fork:', error);
					data.append({
						type: 'error',
						message: 'Failed to save fork',
					});
				}
				await data.close();
			}
		});

		return result.toDataStreamResponse({ data });
	} catch (error) {
		console.error("Error in fork continuation:", error);
		return new Response("Failed to continue fork", { status: 500 });
	}
} 
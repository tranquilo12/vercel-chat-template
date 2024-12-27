import { StreamData, streamText, convertToCoreMessages, JSONValue } from 'ai';
import { z } from 'zod';

import { openaiModel } from "@/ai";
import { auth } from "@/app/(auth)/auth";
import { upsertFork, getForkById } from "@/db/queries";
import { mergeToolResults } from '@/lib/forkUtils';
import { getForkMessages } from "@/lib/server/forkUtils.server";
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
		const { messages, chatID, editedMessageId, parentMessageId, editPoint } = await req.json();

		// WE need to fetch the parent fork messages and merge them with the messages
		const parentFork = await getForkMessages(params.forkId);
		const parentMessages = parentFork || [];
		// const mergedMessages = [...parentMessages, ...messages];

		// Convert messages to core format directly, matching main chat route
		const coreMessages = convertToCoreMessages(messages);
		const data = new StreamData();

		let updatedMessages: ExtendedMessage[] = messages.map((msg: ExtendedMessage) => ({
			...msg,
			toolInvocations: msg.toolInvocations || [],
		}));

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

				try {
					const parsed = JSON.parse(data.toString());
					if (parsed.type === 'tool_result') {
						updatedMessages = mergeToolResults(updatedMessages);
					}
				} catch (e) {
					// Skip if chunk not valid JSON
				}
			},
			onFinish: async ({ steps, responseMessages }) => {
				try {
					// Convert response messages to ExtendedMessage format, matching main route
					const extendedResponseMessages = (responseMessages as ExtendedMessage[]).map(msg => ({
						...msg,
						toolInvocations: Array.isArray(msg.toolInvocations)
							? msg.toolInvocations
							: Array.isArray(msg.content) && msg.content.some(c => c.type === 'tool-call')
								? msg.content
									.filter(c => c.type === 'tool-call')
									.map(c => ({
										toolCallId: c.toolCallId,
										toolName: c.toolName,
										args: c.args,
										state: 'call' as const,
									}))
								: []
					}));

					updatedMessages = mergeToolResults([
						...updatedMessages,
						...extendedResponseMessages,
					]);

					// Get base messages for fork context
					const fork = await getForkById({ id: params.forkId });
					const baseMessages = fork?.baseMessages || [];

					await upsertFork({
						id: params.forkId,
						chatId: params.id,
						parentMessageId: parentMessageId || messages[messages.length - 1]?.id,
						messages: updatedMessages,
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
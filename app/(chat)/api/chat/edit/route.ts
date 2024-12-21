import { Message } from "ai";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { updateChatMessage, getForkById, upsertFork, getChatById } from "@/db/queries";
import { MessageDiff } from "@/types/fork";
import { ExtendedMessage } from "@/types/tools";

export async function PATCH(req: Request) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const { chatId, messageId, newContent, isFork, forkId } = await req.json();

		if (!chatId || !messageId || !newContent) {
			return new Response("Missing required fields", { status: 400 });
		}

		if (isFork && forkId) {
			// Handle fork edit
			const fork = await getForkById({ id: forkId });
			if (!fork) {
				return new Response("Fork not found", { status: 404 });
			}

			// Get base chat messages
			const baseChat = await getChatById({ id: fork.parentChatId as string });
			const baseMessages = baseChat.messages as ExtendedMessage[];
			// Combine base messages with any message diffs and appended messages
			const messages = [
				...baseMessages,
				...(fork.messageDiffs || []),
				...(fork.appendedMessages || [])
			];

			// Update the specific message
			const updatedMessages = messages.map((msg: ExtendedMessage | MessageDiff) =>
				msg.id === messageId
					? { ...msg, content: newContent } as ExtendedMessage
					: msg
			);

			// Update fork with new messages
			const updatedFork = await upsertFork({
				...fork,
				messages: updatedMessages.filter((msg: ExtendedMessage | MessageDiff) =>
					!baseMessages.find((baseMsg: ExtendedMessage | MessageDiff) => baseMsg.id === msg.id)
				) as ExtendedMessage[],
				editPoint: {
					id: messageId,
					role: (messages.find((m: ExtendedMessage | MessageDiff) => m.id === messageId)?.role || 'user') as 'user' | 'assistant' | 'system',
					content: messages.find((m: ExtendedMessage | MessageDiff) => m.id === messageId)?.content || '',
					newContent,
					timestamp: new Date().toISOString()
				}
			});

			return NextResponse.json(updatedFork);
		} else {
			// Handle regular chat edit
			const updatedChat = await updateChatMessage({
				chatId,
				messageId,
				content: newContent
			});

			return NextResponse.json(updatedChat);
		}
	} catch (error) {
		console.error("Error updating message:", error);
		return new Response("Failed to update message", { status: 500 });
	}
}
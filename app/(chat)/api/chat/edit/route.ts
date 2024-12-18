import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { ExtendedMessage } from "@/components/custom/useCustomChat";
import { updateChatMessage, saveFork } from "@/db/queries";

export async function PATCH(req: Request) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const { chatId, messageId, newContent, isFork, forkId, messages } = await req.json();

		if (isFork && forkId) {
			// Handle fork edits
			const updatedFork = await saveFork({
				id: forkId,
				chatId,
				messages: messages,
				editedMessageId: messageId,
				editPoint: {
					messageId,
					originalContent: messages.find((m: ExtendedMessage) => m.id === messageId)?.content || '',
					newContent,
					timestamp: new Date().toISOString()
				},
			});
			return NextResponse.json(updatedFork);
		} else {
			// Handle regular chat edits
			const updatedChat = await updateChatMessage({
				chatId,
				messageId,
				content: newContent,
			});
			return NextResponse.json(updatedChat);
		}
	} catch (error) {
		console.error("Error updating message:", error);
		return new Response("Failed to update message", { status: 500 });
	}
} 
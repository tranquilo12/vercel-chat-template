import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { saveFork } from "@/db/queries";

export async function POST(
	req: Request,
	{ params }: { params: { id: string; forkId: string } }
) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const body = await req.json();
		const { messages, editedMessageId, editPoint } = body;

		// Get the last message ID if editedMessageId isn't provided
		const lastMessageId = !editedMessageId && messages.length > 0
			? messages[messages.length - 1].id
			: editedMessageId;

		// Ensure editPoint has all required fields
		const normalizedEditPoint = {
			messageId: editPoint?.messageId || lastMessageId,
			originalContent: editPoint?.originalContent || messages[messages.length - 1]?.content || '',
			newContent: editPoint?.newContent || messages[messages.length - 1]?.content || '',
			timestamp: editPoint?.timestamp || new Date().toISOString()
		};

		const updatedFork = await saveFork({
			id: params.forkId,
			chatId: params.id,
			messages: messages,
			editedMessageId: lastMessageId,
			editPoint: normalizedEditPoint,
			title: body.title
		});

		return NextResponse.json(updatedFork);
	} catch (error) {
		console.error("Error updating fork chat:", error);
		return new Response(`Failed to update fork chat: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
	}
} 
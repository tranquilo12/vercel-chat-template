import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { upsertFork } from "@/db/queries";
import { MessageDiff } from "@/types/fork";

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

		if (!messages || !Array.isArray(messages)) {
			throw new Error('Messages array is required');
		}

		const lastMessageId = !editedMessageId && messages.length > 0
			? messages[messages.length - 1].id
			: editedMessageId;

		const normalizedEditPoint = {
			id: editPoint?.id || lastMessageId,
			role: editPoint?.role || messages[messages.length - 1]?.role || 'user' as 'user' | 'assistant' | 'system',
			content: editPoint?.content || messages[messages.length - 1]?.content || '',
			timestamp: editPoint?.timestamp || new Date().toISOString()
		};

		const updatedFork = await upsertFork({
			id: params.forkId,
			chatId: params.id,
			parentMessageId: lastMessageId,
			messages: messages,
			baseMessages: messages.slice(0, -1),
			editPoint: normalizedEditPoint as MessageDiff,
			title: body.title,
			status: 'draft'
		});

		return NextResponse.json(updatedFork);
	} catch (error) {
		console.error("Error updating fork chat:", error);
		return new Response(`Failed to update fork chat: ${error instanceof Error ? error.message : 'Unknown error'}`, { status: 500 });
	}
} 
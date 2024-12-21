import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { upsertFork, getForkById } from "@/db/queries";

export async function POST(
	req: Request,
	{ params }: { params: { id: string } }
) {
	console.log('Fork creation initiated for chat:', params.id);

	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const body = await req.json();
		console.log('Received fork creation data:', {
			chatId: params.id,
			forkId: body.id,
			parentMessageId: body.parentMessageId,
			messagesCount: body.messages?.length,
			baseMessagesCount: body.baseMessages?.length
		});

		// Validate required fields
		if (!body.id || !body.parentMessageId) {
			console.error('Missing required fields:', { id: body.id, parentMessageId: body.parentMessageId });
			return new Response("Missing required fields", { status: 400 });
		}

		// Check if fork already exists
		const existingFork = await getForkById({ id: body.id });
		if (existingFork) {
			console.log('Fork already exists, updating:', existingFork.id);
		}

		const fork = await upsertFork({
			id: body.id,
			chatId: params.id,
			parentMessageId: body.parentMessageId,
			messages: body.messages || [],
			baseMessages: body.baseMessages || [],
			editPoint: body.editPoint,
			status: 'draft',
			title: `Fork of ${params.id}`,
			parentChatId: params.id
		});

		console.log('Fork created/updated successfully:', {
			id: fork.id,
			chatId: fork.chatId,
			status: fork.status,
			messageDiffsCount: fork.messageDiffs.length,
			appendedMessagesCount: fork.appendedMessages.length
		});

		// Create a JSON response with explicit headers
		return new Response(JSON.stringify(fork), {
			headers: {
				'Content-Type': 'application/json',
				'Connection': 'close'
			},
			status: 200
		});
	} catch (error) {
		console.error("Error in fork creation:", {
			error,
			chatId: params.id,
			stack: error instanceof Error ? error.stack : undefined
		});
		return new Response(
			`Failed to create fork: ${error instanceof Error ? error.message : 'Unknown error'}`,
			{ status: 500, headers: { 'Connection': 'close' } }
		);
	}
}

// Also handle GET to check fork status
export async function GET(
	req: Request,
	{ params }: { params: { id: string } }
) {
	console.log('Checking forks for chat:', params.id);

	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		// Implementation for listing forks if needed
		return NextResponse.json({ status: 'ok' });
	} catch (error) {
		console.error("Error checking forks:", error);
		return new Response("Failed to check forks", { status: 500 });
	}
}
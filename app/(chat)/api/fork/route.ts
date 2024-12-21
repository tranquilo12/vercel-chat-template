import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { upsertFork, getForkById } from "@/db/queries";
import { MessageDiff } from "@/types/fork";

export async function POST(req: Request) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const body = await req.json();
		console.log('Creating new fork with data:', {
			id: body.id,
			chatId: body.chatId,
			messageCount: body.messages?.length
		});

		const { id, chatId, parentChatId, parentMessageId, messages, baseMessages, editPoint } = body;

		// Ensure we create a new fork with all required fields
		const fork = await upsertFork({
			id,
			chatId,
			parentChatId,
			parentMessageId,
			messages: messages || [],
			baseMessages: baseMessages || [],
			editPoint: editPoint as MessageDiff || undefined,
			status: 'draft',
			title: `Fork of ${chatId}`,
		});

		console.log('Fork created successfully:', {
			id: fork.id,
			chatId: fork.chatId,
			status: fork.status,
			messageCount: fork.messages?.length
		});

		return NextResponse.json(fork);
	} catch (error) {
		console.error("Error creating fork:", {
			error,
			stack: error instanceof Error ? error.stack : undefined
		});
		return new Response("Failed to create fork", { status: 500 });
	}
}

export async function PATCH(req: Request) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const body = await req.json();
		console.log('Attempting to update fork:', { id: body.id });

		// First check if fork exists
		const existingFork = await getForkById({ id: body.id });
		if (!existingFork) {
			console.error('Fork not found for update:', { id: body.id });
			return new Response("Fork not found", { status: 404 });
		}

		const { messages, editPoint } = body;

		const updatedFork = await upsertFork({
			...existingFork,
			baseMessages: existingFork.baseMessages,
			messages: messages || existingFork.messages,
			editPoint: editPoint || existingFork.editPoint,
			status: 'draft'
		});

		console.log('Fork updated successfully:', {
			id: updatedFork.id,
			status: updatedFork.status,
			messageCount: updatedFork.messages?.length
		});

		return NextResponse.json(updatedFork);
	} catch (error) {
		console.error("Error updating fork:", {
			error,
			stack: error instanceof Error ? error.stack : undefined
		});
		return new Response("Failed to update fork", { status: 500 });
	}
}

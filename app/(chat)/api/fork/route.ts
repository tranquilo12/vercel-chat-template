import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { upsertFork, getForkById, deleteForkById, getChatForks } from "@/db/queries";
import { getForkMessages } from "@/lib/server/forkUtils.server";
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

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const forkId = searchParams.get('id');
	const chatId = searchParams.get('chatId');

	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		if (forkId) {
			const messages = await getForkMessages(forkId);
			return new Response(JSON.stringify(messages), {
				headers: { 'Content-Type': 'application/json' },
			});
		} else if (chatId) {
			const forks = await getChatForks({ chatId });
			return new Response(JSON.stringify({ forks }), {
				headers: { 'Content-Type': 'application/json' },
			});
		}
		return new Response('Either fork ID or chat ID is required', { status: 400 });
	} catch (error) {
		console.error('Error getting fork data:', error);
		return new Response('Internal Server Error', { status: 500 });
	}
}

export async function DELETE(req: Request) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const requestBody = await req.text();
		console.log("Raw request body:", requestBody);

		const { id } = JSON.parse(requestBody);

		if (!id) {
			return new Response("Missing fork ID", { status: 400 });
		}
		console.log('Deleting fork:', { id });
		await deleteForkById({ id });
		const response = {
			status: "ok",
			message: `Fork ${id} deleted.`,
		};
		console.log('Sending response:', response);
		return NextResponse.json(response);
	} catch (error) {
		console.error("Error deleting fork:", error);
		const response = {
			status: "error",
			message: "Failed to delete fork",
		};
		console.log('Sending error response:', response);
		return NextResponse.json(response, { status: 500 });
	}
}

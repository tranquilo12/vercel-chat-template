import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { upsertFork } from "@/db/queries";

export async function POST(
	req: Request,
	{ params }: { params: { id: string } }
) {
	const session = await auth();
	if (!session) return new Response("Unauthorized", { status: 401 });

	try {
		const body = await req.json();
		const { id, parentMessageId, messages, baseMessages, editPoint } = body;

		// If we're forking from another fork, use the fork's ID as parentChatId
		// Otherwise, use the original chat ID
		const parentChatId = body.forkId || params.id;

		const fork = await upsertFork({
			id,
			chatId: params.id,
			parentChatId,
			parentMessageId,
			messages: messages || [],
			baseMessages: baseMessages || [],
			editPoint: editPoint,
			status: 'draft',
			title: `Fork of ${parentChatId}`,
		});

		return NextResponse.json(fork);
	} catch (error) {
		console.error("Error creating fork:", error);
		return new Response("Failed to create fork", { status: 500 });
	}
}

// Also handle GET to check fork status
export async function GET(
	req: Request,
	{ params }: { params: { id: string } }
) {
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
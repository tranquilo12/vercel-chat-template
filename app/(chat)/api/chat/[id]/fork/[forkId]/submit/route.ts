import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { upsertFork, getForkById } from "@/db/queries";
import { ExtendedMessage } from "@/types/tools";

export async function PATCH(
	req: Request,
	{ params }: { params: { id: string; forkId: string; parentMessageId: string } }
) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const { status, messages, parentMessageId } = await req.json();

		// Retrieve the existing fork to get the base messages
		const existingFork = await getForkById({ id: params.forkId });
		if (!existingFork) {
			return new Response("Fork not found", { status: 404 });
		}

		// Use the existing fork's base messages for the update
		const baseMessages = existingFork.baseMessages;

		const updatedFork = await upsertFork({
			id: params.forkId,
			chatId: params.id,
			status: status || 'submitted',
			parentMessageId: parentMessageId || '',
			messages: messages as ExtendedMessage[] || [],
			baseMessages: baseMessages, // Use existing base messages
			title: existingFork.title, // Keep the existing title
			editPoint: existingFork.editPoint || undefined, // Keep the existing edit point
			parentFork: existingFork // Pass the existing fork as the parent
		});

		return NextResponse.json(updatedFork);
	} catch (error) {
		console.error("Error submitting fork:", error);
		return new Response("Failed to submit fork", { status: 500 });
	}
} 
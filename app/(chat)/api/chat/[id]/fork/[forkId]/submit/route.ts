import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { upsertFork } from "@/db/queries";

export async function PATCH(
	req: Request,
	{ params }: { params: { id: string; forkId: string; parentMessageId: string } }
) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const { status, messages } = await req.json();

		const updatedFork = await upsertFork({
			id: params.forkId,
			chatId: params.id,
			status: status || 'submitted',
			parentMessageId: params.parentMessageId || '',
			messages: messages || [],
			baseMessages: messages || [],
			title: '',
			editPoint: undefined,
			parentFork: undefined
		});

		return NextResponse.json(updatedFork);
	} catch (error) {
		console.error("Error submitting fork:", error);
		return new Response("Failed to submit fork", { status: 500 });
	}
} 
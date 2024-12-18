import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { createFork, updateForkStatus } from "@/db/queries";

export async function POST(req: Request) {
	const session = await auth();
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const body = await req.json();
		const fork = await createFork(body);
		return NextResponse.json(fork);
	} catch (error) {
		console.error("Error creating fork:", error);
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
		const { id, status } = body;
		const updatedFork = await updateForkStatus({ id, status });
		return NextResponse.json(updatedFork);
	} catch (error) {
		console.error("Error updating fork:", error);
		return new Response("Failed to update fork", { status: 500 });
	}
} 
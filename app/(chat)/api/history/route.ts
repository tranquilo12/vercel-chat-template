import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getChatsByUserId } from "@/db/queries";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const chats = await getChatsByUserId({ id: session.user?.id! });
    return NextResponse.json(chats);
  } catch (error) {
    console.error("Error fetching history:", error);
    return new Response("Failed to fetch history", { status: 500 });
  }
}

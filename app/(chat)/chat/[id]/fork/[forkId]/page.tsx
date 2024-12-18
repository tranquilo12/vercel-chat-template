import { CoreMessage } from "ai";
import { notFound } from "next/navigation";

import { Chat } from "@/components/custom/chat";
import { getForkById } from "@/db/queries";
import { convertToUIMessages } from "@/lib/utils";
export default async function ForkPage({
	params: { id, forkId },
}: {
	params: { id: string; forkId: string };
}) {
	const fork = await getForkById({ id: forkId });

	if (!fork) {
		notFound();
	}

	// Ensure we're using the correct chat ID hierarchy
	const messages = convertToUIMessages(fork.messages as CoreMessage[]);

	return (
		<Chat
			id={id}  // Use the parent chat ID
			initialMessages={messages}
			parentChatId={id}
			forkedFromMessageId={fork.parentMessageId}
			title={fork.title || undefined}
			isFork={true}
			forkId={forkId}
			editPoint={fork.editPoint as { messageId: string; originalContent: string; newContent: string; timestamp: string } | undefined}
			status={fork.status as 'draft' | 'submitted' | undefined}
			initialEditingMessageId={fork.editPoint?.messageId || undefined}
		/>
	);
}
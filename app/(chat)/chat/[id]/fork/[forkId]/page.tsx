import { CoreMessage } from "ai";
import { notFound } from "next/navigation";

import { Chat } from "@/components/custom/chat";
import { getChatById, getForkById } from "@/db/queries";
import { getForkChain, getForkMessages } from "@/lib/server/forkUtils.server";
import { convertToUIMessages } from "@/lib/utils";

export default async function ForkPage({
	params: { id, forkId },
}: {
	params: { id: string; forkId: string };
}) {
	const [fork, baseChat] = await Promise.all([
		getForkById({ id: forkId }).catch(err => {
			console.error('Failed to get fork:', err);
			return null;
		}),
		getChatById({ id }).catch(err => {
			console.error('Failed to get chat:', err);
			return null;
		})
	]);

	if (!fork || !baseChat) {
		console.error('Not found:', { hasFork: !!fork, hasChat: !!baseChat });
		notFound();
	}

	// Get the complete fork chain
	const forkChain = await getForkChain(forkId);

	// Get base messages
	const baseMessages = typeof baseChat.messages === 'string'
		? JSON.parse(baseChat.messages)
		: baseChat.messages;

	// Reconstruct messages through the fork chain
	const reconstructedMessages = await getForkMessages(forkId);

	return (
		<Chat
			id={id}
			initialMessages={convertToUIMessages(reconstructedMessages as CoreMessage[])}
			parentChatId={id}
			forkedFromMessageId={fork.parentMessageId}
			title={fork.title || undefined}
			isFork={true}
			forkId={forkId}
			editPoint={fork.editPoint || undefined}
			status={fork.status}
			initialEditingMessageId={fork.editPoint?.id}
			forkChain={forkChain}
		/>
	);
}
import { CoreMessage } from "ai";
import { notFound } from "next/navigation";

import { Chat } from "@/components/custom/chat";
import { getChatById, getForkById } from "@/db/queries";
import { getForkChain, reconstructMessages } from "@/lib/forkUtils";
import { convertToUIMessages } from "@/lib/utils";

export default async function ForkPage({
	params: { id, forkId },
}: {
	params: { id: string; forkId: string };
}) {
	console.log('Attempting to fetch fork and chat:', { id, forkId });

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

	console.log('Retrieved data:', {
		fork: fork ? { ...fork, id: fork.id, chatId: fork.chatId } : null,
		baseChat: baseChat ? { id: baseChat.id } : null
	});

	if (!fork || !baseChat) {
		console.error('Not found:', { hasFork: !!fork, hasChat: !!baseChat });
		notFound();
	}

	// Get the complete fork chain
	console.log('Fetching fork chain for:', forkId);
	const forkChain = await getForkChain(forkId);
	console.log('Fork chain length:', forkChain.length);

	// Get base messages
	const baseMessages = typeof baseChat.messages === 'string'
		? JSON.parse(baseChat.messages)
		: baseChat.messages;

	console.log('Base messages count:', baseMessages.length);

	// Reconstruct messages through the fork chain
	const reconstructedMessages = reconstructMessages(baseMessages, forkChain);
	console.log('Reconstructed messages count:', reconstructedMessages.length);

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
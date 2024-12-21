import { getForkById } from "@/db/queries";
import { Fork, ForkAncestry, MessageDiff } from "@/types/fork";
import { ExtendedMessage } from "@/types/tools";

export async function getForkChain(forkId: string): Promise<Fork[]> {
	const forkChain: Fork[] = [];
	let currentForkId = forkId;

	while (currentForkId) {
		const fork = await getForkById({ id: currentForkId });
		if (!fork) break;

		forkChain.unshift(fork);
		currentForkId = fork.parentChatId || '';
	}

	return forkChain;
}

export function reconstructMessages(
	baseMessages: ExtendedMessage[],
	forkChain: Fork[]
): ExtendedMessage[] {
	let currentMessages = [...baseMessages];

	forkChain.forEach(fork => {
		fork.messageDiffs.forEach(diff => {
			const messageIndex = currentMessages.findIndex(msg => msg.id === diff.id);
			if (messageIndex !== -1) {
				currentMessages[messageIndex] = {
					...currentMessages[messageIndex],
					content: diff.newContent,
					toolInvocations: diff.toolInvocations || currentMessages[messageIndex].toolInvocations || []
				};
			}
		});

		currentMessages = [
			...currentMessages,
			...fork.appendedMessages.map(msg => ({
				...msg,
				toolInvocations: msg.toolInvocations || []
			}))
		];
	});

	return currentMessages;
}

export function createForkAncestry(
	parentFork: Fork | null,
	newDiffs: MessageDiff[],
	newMessages: ExtendedMessage[]
): ForkAncestry[] {
	if (!parentFork) return [];

	const ancestry: ForkAncestry[] = [
		...(parentFork.ancestry || []),
		{
			forkId: parentFork.id,
			messageDiffs: parentFork.messageDiffs,
			appendedMessages: parentFork.appendedMessages
		}
	];

	return ancestry;
} 
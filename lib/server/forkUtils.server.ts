import { getForkById } from "@/db/queries";
import { Fork, ForkAncestry } from "@/types/fork";
import { ExtendedMessage } from "@/types/tools";

export async function getForkChain(forkId: string): Promise<Fork[]> {
	const forkChain: Fork[] = [];
	const visited = new Set<string>();
	let currentId = forkId;

	while (currentId && !visited.has(currentId)) {
		visited.add(currentId);
		const fork = await getForkById({ id: currentId });

		if (!fork) break;
		forkChain.unshift(fork);

		// Try to get the parent, whether it's a fork or chat
		currentId = fork.parentChatId || "";
	}

	return forkChain;
}

export async function getForkMessages(forkId: string): Promise<ExtendedMessage[]> {
	const fork = await getForkById({ id: forkId });
	if (!fork) return [];

	// If direct messages array is empty, reconstruct from components
	if (!fork.messages && fork.appendedMessages?.length) {
		const messages = [...(fork.appendedMessages || [])];

		// Apply any diffs if they exist
		if (fork.messageDiffs?.length) {
			fork.messageDiffs.forEach(diff => {
				const msgIndex = messages.findIndex(m => m.id === diff.id);
				if (msgIndex !== -1) {
					messages[msgIndex] = {
						...messages[msgIndex],
						content: diff.newContent,
						toolInvocations: diff.toolInvocations || []
					};
				}
			});
		}
		return messages;
	}

	return fork.messages || [];
}

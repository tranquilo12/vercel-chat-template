import { getForkById } from "@/db/queries";
import { Fork, ForkAncestry, MessageDiff } from "@/types/fork";
import { CustomToolInvocation, ExtendedMessage } from "@/types/tools";

export async function getForkChain(forkId: string): Promise<Fork[]> {
	console.log("getForkChain: Starting with forkId:", forkId);
	const forkChain: Fork[] = [];
	const visited = new Set<string>();
	let currentForkId = forkId;

	while (currentForkId && !visited.has(currentForkId)) {
		visited.add(currentForkId);
		console.log("getForkChain: Fetching fork with id:", currentForkId);
		const fork = await getForkById({ id: currentForkId });
		if (!fork) {
			console.log("getForkChain: No fork found, stopping.");
			break;
		}

		forkChain.unshift(fork);
		currentForkId = fork.parentChatId || "";
	}

	console.log("getForkChain: Final chain length:", forkChain.length);
	return forkChain;
}

function mergeToolCallsAndResults(messages: ExtendedMessage[]): ExtendedMessage[] {
	if (!messages) {
		console.log("mergeToolCallsAndResults: Received undefined messages");
		return [];
	}

	return messages.reduce((acc: ExtendedMessage[], message) => {
		// If the message has toolInvocations with no .result, inject a default empty result
		if (message.toolInvocations) {
			message.toolInvocations = message.toolInvocations.map(inv => {
				if (typeof inv.result === undefined) {
					return { ...inv, result: {} };
				}
				return inv;
			}) as CustomToolInvocation[];
		}

		// If this is a "tool" message, merge its content (the tool-result array) into the last assistant
		if (message.role === "tool") {
			const lastAssistantIndex = acc.findLastIndex(m => m.role === "assistant");
			if (lastAssistantIndex !== -1) {
				let toolResults = [];
				try {
					toolResults = typeof message.content === "string"
						? JSON.parse(message.content)
						: message.content;
				} catch (err) {
					console.error("Error parsing tool result:", err);
					// Skip merging if parse fails, but don’t break the entire loop
					return acc;
				}

				const resultsArray = Array.isArray(toolResults) ? toolResults : [toolResults];
				const updatedAssistant = {
					...acc[lastAssistantIndex],
					toolInvocations: (acc[lastAssistantIndex].toolInvocations || []).map(invocation => {
						const matched = resultsArray.find(r => r.toolCallId === invocation.toolCallId);
						if (matched) {
							return {
								...invocation,
								state: "result" as const,
								toolCallId: matched.toolCallId,
								toolName: matched.toolName,
								args: matched.args,
								result: matched.result || {}
							};
						}
						return invocation;
					})
				};

				// Replace the old assistant with the updated one
				return [
					...acc.slice(0, lastAssistantIndex),
					updatedAssistant,
					message,
					...acc.slice(lastAssistantIndex + 1)
				];
			}
		}

		// Otherwise just push the message through
		return [...acc, message];
	}, []);
}

export async function getForkMessages(forkId: string): Promise<ExtendedMessage[]> {
	console.log("getForkMessages: Starting with forkId:", forkId);
	const fork = await getForkById({ id: forkId });

	if (!fork) {
		console.log("getForkMessages: No fork found");
		return [];
	}

	console.log("getForkMessages: Fork found:", {
		id: fork.id,
		hasMessages: Boolean(fork.messages),
		messageCount: fork.messages?.length,
		appendedCount: fork.appendedMessages?.length,
		diffCount: fork.messageDiffs?.length
	});

	// If direct messages array is empty, reconstruct from components
	if (!fork.messages && fork.appendedMessages?.length) {
		console.log("getForkMessages: Reconstructing from appendedMessages");
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

		return mergeToolCallsAndResults(messages);
	}

	// Return the fork's complete message array with properly merged tool results
	return mergeToolCallsAndResults(fork.messages || []);
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
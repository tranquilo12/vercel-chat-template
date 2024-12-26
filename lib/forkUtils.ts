import { Fork, ForkAncestry, MessageDiff } from "@/types/fork";
import { ExtendedMessage } from "@/types/tools";

export function mergeToolResults(messages: ExtendedMessage[]): ExtendedMessage[] {
	if (!Array.isArray(messages)) {
		console.warn('mergeToolResults received invalid input:', messages);
		return [];
	}

	return messages.reduce((acc: ExtendedMessage[], currentMessage, index) => {
		// Validate current message
		if (!currentMessage || typeof currentMessage !== 'object') {
			return acc;
		}

		// Check if the current message is an assistant with a tool invocation in a 'call' state
		const isWaitingAssistant =
			currentMessage.role === 'assistant' &&
			Array.isArray(currentMessage.toolInvocations) &&
			currentMessage.toolInvocations.some((inv) => inv?.state === 'call');

		// Look ahead to see if the next message is a tool message
		const nextMessage = messages[index + 1];
		const isToolMessage = nextMessage?.role === 'tool';

		if (isWaitingAssistant && isToolMessage) {
			try {
				// Safely parse the tool content
				let toolResults;
				try {
					if (typeof nextMessage.content === 'string') {
						toolResults = nextMessage.content.startsWith('[') || nextMessage.content.startsWith('{')
							? JSON.parse(nextMessage.content)
							: { type: 'tool-result', result: nextMessage.content };
					} else {
						toolResults = nextMessage.content;
					}
				} catch (parseError) {
					console.warn('Failed to parse tool results:', parseError);
					return [...acc, currentMessage];
				}

				const resultsArray = Array.isArray(toolResults) ? toolResults : [toolResults];

				// Merge each tool-result into the matching invocation
				const updatedAssistant = {
					...currentMessage,
					toolInvocations: currentMessage.toolInvocations?.map((inv) => {
						if (!inv) return inv;

						const matching = resultsArray.find(
							(res) => res && res.toolCallId === inv.toolCallId
						);
						if (!matching) return inv;

						return {
							...inv,
							state: 'result' as const,
							result: matching.result ?? matching.output ?? {}
						};
					}) ?? []
				};

				return [...acc, updatedAssistant];
			} catch (err) {
				console.error('Failed to merge tool results:', err);
				return [...acc, currentMessage];
			}
		}

		return [...acc, currentMessage];
	}, []);
}

export function createForkAncestry(
	parentFork: Fork | null,
	newDiffs: MessageDiff[],
	newMessages: ExtendedMessage[]
): ForkAncestry[] {
	if (!parentFork) return [];

	return [
		...(parentFork.ancestry || []),
		{
			forkId: parentFork.id,
			messageDiffs: parentFork.messageDiffs,
			appendedMessages: parentFork.appendedMessages
		}
	];
}
import { CustomToolInvocation, ExtendedMessage } from "@/types/tools";

export interface MessageDiff {
	id: string;
	role: 'user' | 'assistant' | 'system' | 'tool';
	content: string;
	newContent: string;
	timestamp: string;
	toolInvocations?: CustomToolInvocation[];
	toolResults?: Array<{
		toolCallId: string;
		result: string;
	}>;
}

export interface ForkAncestry {
	forkId: string;
	messageDiffs: MessageDiff[];
	appendedMessages: ExtendedMessage[];
}

export interface Fork {
	id: string;
	chatId: string;
	parentChatId?: string;
	parentMessageId: string;
	messageDiffs: MessageDiff[];
	appendedMessages: ExtendedMessage[];
	ancestry: ForkAncestry[];
	title?: string;
	createdAt: Date;
	editPoint: MessageDiff | null;
	status: 'draft' | 'submitted';
	messages: ExtendedMessage[];
	baseMessages: ExtendedMessage[];
}

export type CreateForkParams = Omit<Fork, 'id' | 'createdAt'>; 
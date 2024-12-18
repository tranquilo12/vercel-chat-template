import { Message } from "ai";

export interface Fork {
	id: string;
	chatId: string;
	parentChatId?: string;
	parentMessageId: string;
	messages: Message[];
	title?: string;
	createdAt: Date;
	editPoint: {
		messageId: string;
		originalContent: string;
		newContent: string;
		timestamp: string;
	};
	status: 'draft' | 'submitted';
}

export type CreateForkParams = Omit<Fork, 'id' | 'createdAt'>; 
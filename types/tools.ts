import { Message } from 'ai';


export interface CustomToolInvocation {
	toolCallId: string;
	toolName: string;
	args: string | Record<string, unknown>;
	state: 'call' | 'result' | 'partial-call';
	result?: {
		output?: string;
		error?: {
			type: string;
			message: string;
		};
	};
}

export type ExtendedMessage = Omit<Message, 'toolInvocations'> & {
	toolInvocations?: CustomToolInvocation[];
};
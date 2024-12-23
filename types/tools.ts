import { Message, ToolInvocation } from 'ai';

export interface ToolDefinition {
	name: string;
	description: string;
	parameters: {
		type: string;
		properties: Record<string, {
			type: string;
			description: string;
		}>;
		required: string[];
	};
}

export interface ToolResult {
	output?: string;
	error?: {
		message: string;
		details?: any;
	};
}

// First, define the custom tool state type
export type CustomToolState = 'result' | 'partial-call' | 'call';

// Define the custom tool invocation that matches the AI package structure
export interface CustomToolInvocation {
	toolCallId: string;
	toolName: string;
	args: string;
	state: CustomToolState;
	result: any;
}

// Create a base message type that includes our custom tool invocations
export type ExtendedMessage = Omit<Message, 'toolInvocations'> & {
	toolInvocations?: CustomToolInvocation[];
};
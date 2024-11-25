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

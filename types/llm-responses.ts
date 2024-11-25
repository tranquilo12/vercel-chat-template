// Core Types for Unified Response System
export type ResponseType = 'text' | 'tool-call' | 'tool-result' | 'error';

export interface ResponseMetadata {
	id?: string;
	timestamp?: Date;
	toolCallId?: string;
	toolName?: string;
	state?: 'partial' | 'complete' | 'error';
	parentId?: string; // For linking related responses
}

export interface UnifiedLLMResponse {
	type: ResponseType;
	content: string;
	metadata?: ResponseMetadata;
	raw?: unknown; // Original response data for debugging
}

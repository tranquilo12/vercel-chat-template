import { UnifiedLLMResponse } from '../types/llm-responses';
import { ResponseBuffer } from '../types/response-buffer';

export interface StreamHandlers {
	onResponse?: (response: UnifiedLLMResponse) => void;
	onError?: (error: Error) => void;
	onComplete?: () => void;
}

export class StreamProcessor {
	private buffer: ResponseBuffer;
	private handlers: StreamHandlers;
	private currentToolCall: string | null = null;

	constructor(handlers: StreamHandlers) {
		this.buffer = new ResponseBuffer();
		this.handlers = handlers;
	}

	process(chunk: string): void {
		try {
			const [prefix, content] = this.parseChunk(chunk);

			switch (prefix) {
				case '0': // Text
					this.handleTextChunk(content);
					break;
				case '9': // Tool call
					this.handleToolCallStart(content);
					break;
				case 'c': // Tool call delta
					this.handleToolCallDelta(content);
					break;
				case 'a': // Tool result
					this.handleToolResult(content);
					break;
				// Add other cases as needed
			}
		} catch (error) {
			this.handlers.onError?.(error as Error);
		}
	}

	private parseChunk(chunk: string): [string, string] {
		const match = chunk.match(/^(\w+):(.+)$/);
		if (!match) {
			throw new Error(`Invalid chunk format: ${chunk}`);
		}
		return [match[1], match[2]];
	}

	private handleTextChunk(content: string): void {
		const response: UnifiedLLMResponse = {
			type: 'text',
			content: content.replace(/^"|"$/g, ''),
			metadata: {
				timestamp: new Date(),
				state: 'complete'
			}
		};
		this.handlers.onResponse?.(response);
	}

	private handleToolCallStart(content: string): void {
		const toolCall = JSON.parse(content);
		this.currentToolCall = toolCall.toolCallId;

		const response: UnifiedLLMResponse = {
			type: 'tool-call',
			content: '',
			metadata: {
				toolCallId: toolCall.toolCallId,
				toolName: toolCall.toolName,
				state: 'partial',
				timestamp: new Date()
			}
		};

		this.buffer.append(this.currentToolCall || '', response);
	}

	private handleToolCallDelta(content: string): void {
		if (!this.currentToolCall) return;

		const { argsTextDelta } = JSON.parse(content);
		this.buffer.append(this.currentToolCall, {
			content: argsTextDelta
		});
	}

	private handleToolResult(content: string): void {
		if (!this.currentToolCall) return;

		const buffered = this.buffer.complete(this.currentToolCall);
		if (buffered) {
			const response: UnifiedLLMResponse = {
				...buffered,
				metadata: {
					...buffered.metadata,
					state: 'complete'
				}
			};
			this.handlers.onResponse?.(response);
		}

		this.currentToolCall = null;
	}
}

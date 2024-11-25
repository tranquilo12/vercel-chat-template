import { UnifiedLLMResponse } from "./llm-responses";

export class ResponseBuffer {
	private buffer: Map<string, Partial<UnifiedLLMResponse>>;

	constructor() {
		this.buffer = new Map();
	}

	append(id: string, partial: Partial<UnifiedLLMResponse>): void {
		const existing = this.buffer.get(id);
		this.buffer.set(id, {
			...existing,
			...partial,
			content: (existing?.content || '') + (partial.content || '')
		});
	}

	get(id: string): Partial<UnifiedLLMResponse> | undefined {
		return this.buffer.get(id);
	}

	complete(id: string): UnifiedLLMResponse | undefined {
		const response = this.buffer.get(id);
		this.buffer.delete(id);
		return response as UnifiedLLMResponse;
	}
}

import { CoreMessage, CoreToolMessage, generateId, Message, ToolInvocation, } from "ai";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { Chat } from "@/db/schema";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ApplicationError extends Error {
    info: string;
    status: number;
}

export const fetcher = async (url: string) => {
    const res = await fetch(url);

    if (!res.ok) {
        const error = new Error(
            "An error occurred while fetching the data.",
        ) as ApplicationError;

        error.info = await res.json();
        error.status = res.status;

        throw error;
    }

    return res.json();
};

export function getLocalStorage(key: string) {
    if (typeof window !== "undefined") {
        return JSON.parse(localStorage.getItem(key) || "[]");
    }
    return [];
}

export function generateUUID(): string {
    if (typeof crypto === 'undefined') {
        throw new Error('Crypto API is not available');
    }

    // Get 16 random bytes
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version (4) and variant (2) bits according to RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40;  // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80;  // variant 2

    // Convert to hex string with proper UUID format
    return Array.from(bytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
}

function addToolMessageToChat({
    toolMessage,
    messages,
}: {
    toolMessage: CoreToolMessage;
    messages: Array<Message>;
}): Array<Message> {
    return messages.map((message) => {
        if (message.toolInvocations) {
            return {
                ...message,
                toolInvocations: message.toolInvocations.map((toolInvocation) => {
                    const toolResult = toolMessage.content.find(
                        (tool) => tool.toolCallId === toolInvocation.toolCallId,
                    );

                    if (toolResult) {
                        return {
                            ...toolInvocation,
                            state: "result",
                            result: toolResult.result,
                        };
                    }

                    return toolInvocation;
                }),
            };
        }

        return message;
    });
}

export function convertToUIMessages(messages: Array<CoreMessage>): Array<Message> {
    return messages.reduce((chatMessages: Array<Message>, message) => {
        // Handle tool messages
        if (message.role === "tool") {
            const toolMessage: Message = {
                id: generateId(),
                role: 'tool',
                content: typeof message.content === 'string'
                    ? message.content
                    : JSON.stringify(message.content),
                toolInvocations: [] // Initialize empty array for consistency
            };
            chatMessages.push(toolMessage);
            return chatMessages;
        }

        // Handle regular messages
        let textContent = "";
        let toolInvocations: Array<ToolInvocation> = [];

        if (typeof message.content === "string") {
            textContent = message.content;
        } else if (Array.isArray(message.content)) {
            for (const content of message.content) {
                if (content.type === "text") {
                    textContent += content.text;
                } else if (content.type === "tool-call") {
                    toolInvocations.push({
                        state: "call",
                        toolCallId: content.toolCallId,
                        toolName: content.toolName,
                        args: content.args,
                    });
                }
            }
        }

        // Add the message with its tool invocations
        chatMessages.push({
            id: generateId(),
            role: message.role,
            content: textContent,
            toolInvocations: toolInvocations,
        });

        return chatMessages;
    }, []);
}

export function getTitleFromChat(chat: Chat) {
    const messages = convertToUIMessages(chat.messages as Array<CoreMessage>);
    const firstMessage = messages[0];

    if (!firstMessage) {
        return "Untitled";
    }

    return firstMessage.content;
}

function preprocessMessage(message: any): CoreMessage {
    if (message.role === 'assistant' && Array.isArray(message.content)) {
        // Extract text content
        const textContent = message.content
            .filter((item: any) => item.type === 'text')
            .map((item: any) => item.text)
            .join('');

        // Extract tool calls
        const toolCalls = message.content
            .filter((item: any) => item.type === 'tool-call')
            .map((item: any) => ({
                id: item.toolCallId,
                type: 'function',
                function: {
                    name: item.toolName,
                    arguments: JSON.stringify(item.args)
                }
            }));

        // Return formatted message
        return {
            role: 'assistant',
            content: textContent || JSON.stringify(message.content),
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        } as CoreMessage;
    }

    // Return unchanged for other message types
    return message as CoreMessage;
}

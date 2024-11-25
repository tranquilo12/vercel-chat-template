import { Message, ToolInvocation } from "ai";
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from 'uuid';
import { ChatRequestOptions } from "ai";

// Define a mutable tool call for handling state changes
interface MutableToolCall {
    toolCallId: string;
    toolName: string;
    state: ToolCallState;
    args: string;
}

// Keep the extension minimal and compatible with AI SDK
interface ExtendedMessage extends Message {
    toolInvocations?: ToolInvocation[];
}

// At the top of the file, add this type definition
type ToolCallState = 'partial-call' | 'call' | 'completed';

export function useCustomChat({
    initialMessages,
    id,
}: {
    initialMessages: Array<Message>;
    id: string;
}) {
    const [messages, setMessages] = useState<ExtendedMessage[]>(initialMessages);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState("");
    const inputId = `chat-input-${id}`;
    const abortControllerRef = useRef<AbortController | null>(null);

    const stop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);
    };

    const handleSubmit = async (
        e?: { preventDefault?: () => void },
        chatRequestOptions?: ChatRequestOptions
    ) => {
        e?.preventDefault?.();
        if (!input.trim()) return;

        setIsLoading(true);
        try {
            // Create standard Message for user input, and add it immediately
            const userMessage: Message = {
                id: uuidv4(),
                role: "user",
                content: input
            };
            setMessages(prevMessages => [...prevMessages, userMessage]);

            // Create initial AI message and add it immediately
            const aiMessage: ExtendedMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: '',
                toolInvocations: []
            };
            setMessages(prevMessages => [...prevMessages, aiMessage]);

            const payload = {
                chatId: id,
                messages: [...messages, userMessage].map(msg => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content
                })),
                ...chatRequestOptions,
            };

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current?.signal,
            });

            if (!response.ok) {
                throw new Error(response.statusText);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let currentToolCall: MutableToolCall | null = null;

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (!line) continue;

                        if (line.startsWith('0:')) { // Regular text
                            const content = line.slice(2).replace(/^"|"$/g, '');
                            setMessages(prevMessages => {
                                const lastMessage = prevMessages[prevMessages.length - 1];
                                return lastMessage.id === aiMessage.id
                                    ? [
                                        ...prevMessages.slice(0, -1),
                                        {
                                            ...lastMessage,
                                            content: lastMessage.content + content
                                                .replace(/\\n/g, '\n')  // Replace escaped newlines
                                                .replace(/\\/g, '')     // Remove remaining escapes
                                                .replace(/```$/, '')    // Remove trailing backticks
                                        }
                                    ]
                                    : prevMessages;
                            });
                        } else if (line.startsWith('9:')) { // Tool call start
                            const content = line.slice(2);
                            const toolCall = JSON.parse(content);
                            currentToolCall = {
                                toolCallId: toolCall.toolCallId,
                                toolName: toolCall.toolName,
                                state: 'partial-call' as const,
                                args: ''
                            };
                        } else if (line.startsWith('c:')) { // Tool call delta
                            if (!currentToolCall) continue;
                            const content = line.slice(2);
                            const { argsTextDelta } = JSON.parse(content);
                            currentToolCall.args = (currentToolCall.args || '') + argsTextDelta;
                        } else if (line.startsWith('a:')) { // Tool result
                            if (!currentToolCall) continue;
                            currentToolCall.state = 'completed';

                            // Convert MutableToolCall to ToolInvocation when adding to message
                            const finalToolCall: ToolInvocation = {
                                ...currentToolCall,
                                state: 'result' as const,
                                result: currentToolCall.args
                            };

                            setMessages(prevMessages => {
                                const lastMessage = prevMessages[prevMessages.length - 1];
                                return lastMessage.id === aiMessage.id
                                    ? [
                                        ...prevMessages.slice(0, -1),
                                        {
                                            ...lastMessage,
                                            toolInvocations: [
                                                ...(lastMessage.toolInvocations || []),
                                                finalToolCall
                                            ]
                                        }
                                    ]
                                    : prevMessages;
                            });
                            currentToolCall = null;
                        }
                    }
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error("Error sending message:", error);
            }
        } finally {
            setIsLoading(false);
            setInput("");
            abortControllerRef.current = null;
        }
    };

    const append = async (message: ExtendedMessage) => {
        setMessages((prev) => [...prev, message]);
    };

    useEffect(() => {
        console.debug('Chat ID:', id);
        console.debug('Current messages:', messages);
    }, [id, messages]);

    return {
        messages,
        handleSubmit,
        input,
        setInput,
        isLoading,
        stop,
        append,
        inputId,
    };
}

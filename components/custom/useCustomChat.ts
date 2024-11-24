import { Message } from "ai";
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from 'uuid';
import { ChatRequestOptions } from "ai";
import { readDataStream, StreamPart } from 'ai';

export function useCustomChat({
    initialMessages,
    id,
}: {
    initialMessages: Array<Message>;
    id: string;
}) {
    const [messages, setMessages] = useState<Message[]>(initialMessages);
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

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsLoading(true);
        try {
            const userMessage: Message = { id: uuidv4(), role: "user" as const, content: input };
            setMessages(prevMessages => [...prevMessages, userMessage]);

            const payload = {
                chatId: id,
                messages: [...messages, userMessage],
                ...chatRequestOptions,
            };

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                throw new Error(response.statusText);
            }

            // Create initial AI message
            const aiMessage: Message = {
                id: uuidv4(),
                role: 'assistant',
                content: ''
            };
            setMessages(prevMessages => [...prevMessages, aiMessage]);

            // Handle the stream
            const reader = response.body?.getReader();

            if (reader) {
                // Use readDataStream to parse the stream
                const stream = readDataStream(reader);

                for await (const part of stream) {
                    if (part.type === 'text') {
                        // Handle text updates
                        const textDelta = part.value;
                        // Update the AI message content
                        setMessages(prevMessages => {
                            const lastMessage = prevMessages[prevMessages.length - 1];
                            if (lastMessage.id === aiMessage.id) {
                                return [
                                    ...prevMessages.slice(0, -1),
                                    { ...lastMessage, content: lastMessage.content + textDelta },
                                ];
                            }
                            return prevMessages;
                        });
                    } else if (part.type === 'tool_call') {
                        // Handle tool calls
                        const toolCall = {
                            toolCallId: part.value.toolCallId,
                            toolName: part.value.toolName,
                            args: JSON.parse(part.value.args),
                            state: 'call' as const,
                        };

                        setMessages(prevMessages => {
                            const lastMessage = prevMessages[prevMessages.length - 1];
                            if (lastMessage.id === aiMessage.id) {
                                return [
                                    ...prevMessages.slice(0, -1),
                                    {
                                        ...lastMessage,
                                        toolInvocations: [
                                            ...(lastMessage.toolInvocations || []),
                                            toolCall,
                                        ],
                                    },
                                ];
                            }
                            return prevMessages;
                        });

                        // Optionally, execute the tool and send back the result
                        // This depends on how your application handles tool execution
                    } else if (part.type === 'tool_result') {
                        // Handle tool results
                        const toolResult = {
                            toolCallId: part.value.toolCallId,
                            result: part.value.result,
                            state: 'result' as const,
                        };

                        setMessages(prevMessages => {
                            const lastMessage = prevMessages[prevMessages.length - 1];
                            if (lastMessage && lastMessage.toolInvocations) {
                                const updatedToolInvocations = lastMessage.toolInvocations.map(
                                    invocation => {
                                        if (invocation.toolCallId === toolResult.toolCallId) {
                                            return { ...invocation, ...toolResult };
                                        }
                                        return invocation;
                                    },
                                );

                                return [
                                    ...prevMessages.slice(0, -1),
                                    {
                                        ...lastMessage,
                                        toolInvocations: updatedToolInvocations,
                                    },
                                ];
                            }
                            return prevMessages;
                        });
                    } else if (part.type === 'error') {
                        // Handle errors
                        console.error('Stream error:', part.type);
                    } else if (part.type === 'finish_message') {
                        // Handle finish
                        const { finishReason } = part.value;
                        // Optionally, you can update the state or perform actions based on the finish reason
                    }
                }
            }

        } catch (error: unknown) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error("Error sending message:", error);
            }
        } finally {
            setIsLoading(false);
            setInput("");
            abortControllerRef.current = null;
        }
    };

    const append = async (message: Message) => {
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

import { Message } from "ai";
import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from 'uuid';
import { ChatRequestOptions } from "ai";

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
            const decoder = new TextDecoder();

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    let newContent = '';
                    for (const line of lines) {
                        if (line.startsWith('0:')) {
                            const content = line.slice(2).replace(/^"|"$/g, '');
                            newContent += content;
                        }
                    }

                    // Update the AI message content
                    setMessages(prevMessages => {
                        const lastMessage = prevMessages[prevMessages.length - 1];
                        if (lastMessage.id === aiMessage.id) {
                            // Sanitize newContent to handle markdown properly
                            const sanitizedContent = newContent
                                .replace(/\\n/g, '\n')  // Replace escaped newlines
                                .replace(/\\/g, '')     // Remove remaining escapes
                                .replace(/```$/, '');   // Remove trailing backticks at the end of the stream

                            return [
                                ...prevMessages.slice(0, -1),
                                { ...lastMessage, content: lastMessage.content + sanitizedContent }
                            ];
                        }
                        return prevMessages;
                    });
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

import { Message, ToolInvocation, ChatRequestOptions } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

type ExtendedMessage = Message & {
    toolInvocations?: ToolInvocation[];
};

export function useCustomChat({
    initialMessages,
    id,
}: {
    initialMessages: Array<Message>;
    id: string;
}) {
    const [messages, setMessages] = useState<ExtendedMessage[]>(initialMessages);
    const [isLoading, setIsLoading] = useState(false);
    const [input, setInput] = useState('');
    const inputId = `chat-input-${id}`;
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        // Cleanup function to abort any ongoing requests
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

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
            const userMessage: Message = {
                id: uuidv4(),
                role: 'user',
                content: input,
            };
            setMessages((prevMessages) => [...prevMessages, userMessage]);

            const aiMessage: ExtendedMessage = {
                id: uuidv4(),
                role: 'assistant',
                content: '',
                toolInvocations: [],
            };
            setMessages((prevMessages) => [...prevMessages, aiMessage]);

            const payload = {
                chatId: id,
                messages: [...messages, userMessage].map((msg) => ({
                    id: msg.id,
                    role: msg.role,
                    content: msg.content,
                })),
                ...chatRequestOptions,
            };

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: (abortControllerRef.current = new AbortController()).signal,
            });

            if (!response.ok) {
                throw new Error(response.statusText);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let doneReading = false;
                let buffer = '';

                try {
                    while (!doneReading) {
                        const { done, value } = await reader.read();

                        if (done) {
                            doneReading = true;
                            // Process any remaining buffer before breaking
                            if (buffer.trim()) {
                                const line = buffer.trim();
                                const [prefix, ...rest] = line.split(':');
                                const dataStr = rest.join(':');

                                // Process the final line using the same prefix logic
                                if (prefix === '0') {
                                    setMessages((prevMessages) => {
                                        const lastMessage = prevMessages[prevMessages.length - 1];
                                        return lastMessage.id === aiMessage.id
                                            ? [...prevMessages.slice(0, -1),
                                            { ...lastMessage, content: lastMessage.content + dataStr }]
                                            : prevMessages;
                                    });
                                } else if (prefix === 'b') {
                                    const event = JSON.parse(dataStr);
                                    const newToolInvocation: ToolInvocation = {
                                        toolCallId: event.toolCallId,
                                        toolName: event.toolName,
                                        state: 'call',
                                        args: '',
                                    };
                                    setMessages((prevMessages) => {
                                        const lastMessage = prevMessages[prevMessages.length - 1];
                                        return lastMessage.id === aiMessage.id
                                            ? [...prevMessages.slice(0, -1),
                                            {
                                                ...lastMessage,
                                                toolInvocations: [...(lastMessage.toolInvocations || []), newToolInvocation]
                                            }]
                                            : prevMessages;
                                    });
                                } else if (prefix === 'c') {
                                    const event = JSON.parse(dataStr);
                                    setMessages((prevMessages) => {
                                        const lastMessage = prevMessages[prevMessages.length - 1];
                                        if (lastMessage.id !== aiMessage.id) return prevMessages;

                                        const toolInvocations = lastMessage.toolInvocations || [];
                                        const toolInvocationIndex = toolInvocations.findIndex(
                                            (invocation) => invocation.toolCallId === event.toolCallId
                                        );

                                        if (toolInvocationIndex >= 0) {
                                            const currentInvocation = toolInvocations[toolInvocationIndex];
                                            const updatedArgs = currentInvocation.args + event.argsTextDelta;

                                            const updatedInvocation = {
                                                ...currentInvocation,
                                                argsTextDelta: updatedArgs,
                                                args: JSON.parse(updatedArgs),
                                            };

                                            const updatedToolInvocations = [...toolInvocations];
                                            updatedToolInvocations[toolInvocationIndex] = updatedInvocation;

                                            return [...prevMessages.slice(0, -1),
                                            { ...lastMessage, toolInvocations: updatedToolInvocations }];
                                        }
                                        return prevMessages;
                                    });
                                } else if (prefix === 'e') {
                                    const event = JSON.parse(dataStr);
                                    if (event.finishReason === 'tool-calls') {
                                        setMessages((prevMessages) => {
                                            const lastMessage = prevMessages[prevMessages.length - 1];
                                            if (lastMessage.id !== aiMessage.id) return prevMessages;

                                            // Update all tool invocations in the last message to mark them as complete
                                            const updatedToolInvocations = lastMessage.toolInvocations?.map(invocation => ({
                                                ...invocation,
                                            })) || [];

                                            return [...prevMessages.slice(0, -1),
                                            { ...lastMessage, toolInvocations: updatedToolInvocations }];
                                        });
                                    }
                                } else if (prefix === 'd') {
                                    const event = JSON.parse(dataStr);
                                    setMessages((prevMessages) => {
                                        const lastMessage = prevMessages[prevMessages.length - 1];
                                        return lastMessage.id === aiMessage.id
                                            ? [...prevMessages.slice(0, -1),
                                            { ...lastMessage, content: lastMessage.content + event.textDelta }]
                                            : prevMessages;
                                    });
                                }
                            }
                            break;
                        }

                        buffer += decoder.decode(value || new Uint8Array(), { stream: true });

                        let newlineIndex;
                        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                            const line = buffer.slice(0, newlineIndex).trim();
                            buffer = buffer.slice(newlineIndex + 1);

                            if (!line) continue; // Skip empty lines

                            const [prefix, ...rest] = line.split(':');
                            const dataStr = rest.join(':');

                            // Use the same prefix handling logic as above
                            if (prefix === '0') {
                                setMessages((prevMessages) => {
                                    const lastMessage = prevMessages[prevMessages.length - 1];
                                    return lastMessage.id === aiMessage.id
                                        ? [...prevMessages.slice(0, -1),
                                        { ...lastMessage, content: lastMessage.content + dataStr }]
                                        : prevMessages;
                                });
                            } else if (prefix === 'b') {
                                const event = JSON.parse(dataStr);
                                const newToolInvocation: ToolInvocation = {
                                    toolCallId: event.toolCallId,
                                    toolName: event.toolName,
                                    state: 'call',
                                    args: '',
                                };
                                setMessages((prevMessages) => {
                                    const lastMessage = prevMessages[prevMessages.length - 1];
                                    return lastMessage.id === aiMessage.id
                                        ? [...prevMessages.slice(0, -1),
                                        {
                                            ...lastMessage,
                                            toolInvocations: [...(lastMessage.toolInvocations || []), newToolInvocation]
                                        }]
                                        : prevMessages;
                                });
                            } else if (prefix === 'c') {
                                const event = JSON.parse(dataStr);
                                setMessages((prevMessages) => {
                                    const lastMessage = prevMessages[prevMessages.length - 1];
                                    if (lastMessage.id !== aiMessage.id) return prevMessages;

                                    const toolInvocations = lastMessage.toolInvocations || [];
                                    const toolInvocationIndex = toolInvocations.findIndex(
                                        (invocation) => invocation.toolCallId === event.toolCallId
                                    );

                                    if (toolInvocationIndex >= 0) {
                                        const currentInvocation = toolInvocations[toolInvocationIndex];
                                        const updatedInvocation = {
                                            ...currentInvocation,
                                            argsTextDelta: event.argsTextDelta,
                                        };

                                        const updatedToolInvocations = [...toolInvocations];
                                        updatedToolInvocations[toolInvocationIndex] = updatedInvocation;

                                        return [...prevMessages.slice(0, -1),
                                        { ...lastMessage, toolInvocations: updatedToolInvocations }];
                                    }
                                    return prevMessages;
                                });
                            } else if (prefix === 'e') {
                                const event = JSON.parse(dataStr);
                                if (event.finishReason === 'tool-calls') {
                                    setMessages((prevMessages) => {
                                        const lastMessage = prevMessages[prevMessages.length - 1];
                                        if (lastMessage.id !== aiMessage.id) return prevMessages;

                                        // Update all tool invocations in the last message to mark them as complete
                                        const updatedToolInvocations = lastMessage.toolInvocations?.map(invocation => ({
                                            ...invocation,
                                            state: 'complete' as const
                                        })) || [];

                                        return [...prevMessages.slice(0, -1),
                                        { ...lastMessage, toolInvocations: updatedToolInvocations }];
                                    });
                                }
                            } else if (prefix === 'd') {
                                const event = JSON.parse(dataStr);
                                setMessages((prevMessages) => {
                                    const lastMessage = prevMessages[prevMessages.length - 1];
                                    return lastMessage.id === aiMessage.id
                                        ? [...prevMessages.slice(0, -1),
                                        { ...lastMessage, content: lastMessage.content + event.textDelta }]
                                        : prevMessages;
                                });
                            }
                        }
                    }
                } finally {
                    reader.cancel();
                    buffer = '';
                    abortControllerRef.current = null;
                }
            }
        } catch (error) {
            if (error instanceof Error && error.name !== 'AbortError') {
                console.error('Error sending message:', error);
            }
        } finally {
            setIsLoading(false);
            setInput('');
            abortControllerRef.current = null;
        }
    };

    const append = async (message: ExtendedMessage) => {
        setMessages((prev) => [...prev, message]);
    };

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

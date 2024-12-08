import { Message, ToolInvocation, ChatRequestOptions } from 'ai';
import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

type CustomToolInvocation = {
    toolCallId: string;
    toolName: string;
    args: string;
    state: 'call' | 'result' | 'partial-call';
    result?: string;
};

export type ExtendedMessage = Message & {
    toolInvocations?: CustomToolInvocation[];
};

const cleanStreamText = (text: string | undefined) => {
    // Return empty string if text is undefined or null
    if (!text) return '';

    // Remove excessive quotes and unescape characters
    return text
        .replace(/"{2,}/g, '"')        // Replace multiple quotes with single quote
        .replace(/\\n/g, '\n')         // Replace literal \n with newline
        .replace(/\\"/g, '"')          // Replace escaped quotes with regular quotes
        .replace(/^"|"$/g, '')         // Remove leading/trailing quotes
        .replace(/(?<!\\)\\(?!["\\])/g, ''); // Remove single backslashes not escaping quotes
};

const processStreamLine = (
    line: string,
    aiMessage: ExtendedMessage,
    setMessages: React.Dispatch<React.SetStateAction<ExtendedMessage[]>>
) => {
    if (!line) return;

    const [prefix, ...rest] = line.split(':');
    const dataStr = rest.join(':');

    switch (prefix) {
        case '0': // text
            try {
                setMessages((prevMessages) => {
                    const lastMessage = prevMessages[prevMessages.length - 1];
                    return lastMessage.id === aiMessage.id
                        ? [...prevMessages.slice(0, -1),
                        { ...lastMessage, content: lastMessage.content + cleanStreamText(dataStr) }]
                        : prevMessages;
                });
            } catch (error) {
                console.error('Error processing message:', error);
            }
            break;

        case 'b': // tool_call_streaming_start
            const toolStartEvent = JSON.parse(dataStr);
            const newToolInvocation: ToolInvocation = {
                toolCallId: toolStartEvent.toolCallId,
                toolName: toolStartEvent.toolName,
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
            break;

        case 'c': // tool_call_delta
            const deltaEvent = JSON.parse(dataStr);
            setMessages((prevMessages) => {
                const lastMessage = prevMessages[prevMessages.length - 1];
                if (lastMessage.id !== aiMessage.id) return prevMessages;

                const toolInvocations = lastMessage.toolInvocations || [];
                const toolInvocationIndex = toolInvocations.findIndex(
                    (invocation) => invocation.toolCallId === deltaEvent.toolCallId
                );

                if (toolInvocationIndex >= 0) {
                    const currentInvocation = toolInvocations[toolInvocationIndex];
                    const updatedArgs = (currentInvocation.args as string || '') + deltaEvent.argsTextDelta;

                    const updatedInvocation = {
                        ...currentInvocation,
                        argsTextDelta: updatedArgs,
                        args: updatedArgs,
                    };

                    const updatedToolInvocations = [...toolInvocations];
                    updatedToolInvocations[toolInvocationIndex] = updatedInvocation;

                    return [...prevMessages.slice(0, -1),
                    { ...lastMessage, toolInvocations: updatedToolInvocations }];
                }
                return prevMessages;
            });
            break;

        case 'e': // tool_call_finish
            const finishEvent = JSON.parse(dataStr);
            if (finishEvent.finishReason === 'tool-calls') {
                setMessages((prevMessages) => {
                    const lastMessage = prevMessages[prevMessages.length - 1];
                    if (lastMessage.id !== aiMessage.id) return prevMessages;

                    // Create a new tool message
                    const toolMessage = {
                        id: uuidv4(),
                        role: 'tool' as const,
                        content: JSON.stringify(lastMessage.toolInvocations?.map(invocation => ({
                            type: 'tool-result' as const,
                            toolCallId: invocation.toolCallId,
                            toolName: invocation.toolName,
                            result: invocation.args
                        })) || [])
                    };

                    // Update the assistant message and add the tool message
                    return [
                        ...prevMessages.slice(0, -1),
                        {
                            ...lastMessage,
                            toolInvocations: lastMessage.toolInvocations?.map(invocation => ({
                                ...invocation,
                                state: 'result' as const,
                                result: null as unknown as string
                            }))
                        },
                        toolMessage
                    ];
                });
            }
            break;

        case 'd': // finish_message
            try {
                const messageEvent = JSON.parse(dataStr);
                setMessages((prevMessages) => {
                    const lastMessage = prevMessages[prevMessages.length - 1];
                    return lastMessage.id === aiMessage.id
                        ? [...prevMessages.slice(0, -1),
                        { ...lastMessage, content: lastMessage.content + cleanStreamText(messageEvent?.textDelta) }]
                        : prevMessages;
                });
            } catch (error) {
                console.error('Error processing text delta:', error);
            }
            break;

        case 'a': // tool_result
            try {
                const resultEvent = JSON.parse(dataStr);
                setMessages((prevMessages) => {
                    const lastMessage = prevMessages[prevMessages.length - 1];

                    // Create the tool result message first
                    const toolResultMessage = {
                        id: uuidv4(),
                        role: 'tool' as const,
                        content: JSON.stringify([{
                            type: 'tool-result',
                            toolCallId: resultEvent.toolCallId,
                            toolName: resultEvent.toolName || '',
                            result: resultEvent.result || resultEvent.output // Handle both result and output fields
                        }])
                    };

                    // If the last message is from the assistant, also update its toolInvocations
                    if (lastMessage.role === 'assistant' && lastMessage.toolInvocations) {
                        const updatedToolInvocations = lastMessage.toolInvocations.map(invocation =>
                            invocation.toolCallId === resultEvent.toolCallId
                                ? {
                                    ...invocation,
                                    state: 'result' as const,
                                    result: resultEvent.result || resultEvent.output // Handle both result and output fields
                                }
                                : invocation
                        );

                        // Return both the updated assistant message and the new tool message
                        return [
                            ...prevMessages.slice(0, -1),
                            { ...lastMessage, toolInvocations: updatedToolInvocations },
                            toolResultMessage
                        ];
                    }

                    // If there's no assistant message to update, just add the tool message
                    return [...prevMessages, toolResultMessage];
                });
            } catch (error) {
                console.error('Error processing tool output:', error);
            }
            break;
    }
};

export function useCustomChat({
    initialMessages,
    id,
}: {
    initialMessages: Array<Message>;
    id: string;
}) {
    const [messages, setMessages] = useState<ExtendedMessage[]>(initialMessages as ExtendedMessage[]);
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
        chatRequestOptions?: ChatRequestOptions & { messages?: ExtendedMessage[], allowEmptySubmit?: boolean }
    ) => {
        e?.preventDefault?.();
        
        const messageHistory = chatRequestOptions?.messages || messages;
        
        // Only create new user message if not using custom message history
        const updatedMessages = chatRequestOptions?.messages || [...messages, {
            id: uuidv4(),
            role: 'user',
            content: input,
        } as ExtendedMessage];

        const aiMessage: ExtendedMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: '',
            tool_calls: [],
        };

        setMessages([...updatedMessages, aiMessage]);

        const payload = {
            chatId: id,
            messages: updatedMessages,
            ...chatRequestOptions,
        };

        setIsLoading(true);
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
                signal: (abortControllerRef.current = new AbortController()).signal,
            });

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (reader) {
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        // Append new data to buffer
                        buffer += decoder.decode(value, { stream: !done });

                        // Process complete lines from buffer
                        let newlineIndex;
                        while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
                            const line = buffer.slice(0, newlineIndex).trim();
                            buffer = buffer.slice(newlineIndex + 1);

                            processStreamLine(line, aiMessage, setMessages);
                        }

                        // Break the loop if we're done and process any remaining buffer
                        if (done) {
                            if (buffer.trim()) {
                                processStreamLine(buffer.trim(), aiMessage, setMessages);
                            }
                            break;
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
        setMessages,
        handleSubmit,
        input,
        setInput,
        isLoading,
        stop,
        append,
        inputId,
    };
}

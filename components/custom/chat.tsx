"use client";

import { Attachment, Message, CreateMessage, CoreMessage } from "ai";
import { useState, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";

import { Markdown } from "@/components/custom/markdown";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";
import { cn } from "@/lib/utils";

import { MultimodalInput } from "./multimodal-input";
import { useCustomChat, ExtendedMessage } from "./useCustomChat";

function MessageContent({
  message,
  isEditing,
  onEditComplete,
  onEditStart,
}: {
  message: ExtendedMessage;
  isEditing?: boolean;
  onEditComplete?: (content: string) => void;
  onEditStart?: () => void;
}) {
  const [editedContent, setEditedContent] = useState(message.content);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onEditComplete?.(editedContent);
    }
  };

  // Parse content if it's an array format
  const displayContent = useMemo(() => {
    if (Array.isArray(message.content)) {
      return message.content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");
    }
    return message.content;
  }, [message.content]);

  // Parse tool invocations
  const toolInvocations = useMemo(() => {
    if (!message.toolInvocations) return [];

    return message.toolInvocations.map((tool) => ({
      ...tool,
      args:
        typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args),
      result:
        tool.result ||
        (tool.content && Array.isArray(message.content)
          ? message.content.find(
              (part) =>
                part.type === "tool-result" &&
                part.toolCallId === tool.toolCallId
            )?.result
          : null),
    }));
  }, [message.toolInvocations, message.content]);

  if (isEditing && message.role === "user") {
    return (
      <textarea
        className="w-full bg-transparent resize-none focus:outline-none"
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }

  return (
    <div
      className="prose dark:prose-invert space-y-4"
      onClick={() => message.role === "user" && onEditStart?.()}
    >
      {displayContent && (
        <div className="border-l-2 border-primary/20 pl-4">
          <Markdown>{displayContent}</Markdown>
        </div>
      )}

      {toolInvocations.map((tool) => (
        <div key={tool.toolCallId} className="space-y-2">
          {tool.state === "call" && (
            <div className="text-xs text-muted-foreground/80 italic">
              Executing {tool.toolName}...
            </div>
          )}

          {tool.state === "result" && (
            <div className="space-y-2">
              {/* Code Section */}
              {tool.args && (
                <details className="border rounded-md">
                  <summary className="text-xs font-medium px-4 py-2 cursor-pointer hover:bg-muted/50">
                    Code from {tool.toolName}
                  </summary>
                  <div className="px-4 py-2 bg-muted/30">
                    <Markdown>
                      {`\`\`\`python
${
  typeof tool.args === "string"
    ? JSON.parse(tool.args).code
    : typeof tool.args === "object"
      ? tool.args.code
      : tool.args
}
\`\`\``}
                    </Markdown>
                  </div>
                </details>
              )}

              {/* Output Section */}
              <details className="border rounded-md" open>
                <summary className="text-xs font-medium px-4 py-2 cursor-pointer hover:bg-muted/50">
                  Output from {tool.toolName}
                </summary>
                <div className="px-4 py-2 bg-muted/30">
                  {tool.result?.success === false ? (
                    <div className="text-red-500 text-sm">
                      Error: {tool.result.error.message}
                    </div>
                  ) : tool.result ? (
                    <Markdown>
                      {tool.result.output || "No output provided"}
                    </Markdown>
                  ) : (
                    <div className="text-muted-foreground text-sm italic">
                      No result available
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </div>
      ))}

      {/* Empty State */}
      {!displayContent && !toolInvocations.length && (
        <div className="text-muted-foreground text-sm italic">
          Empty message
        </div>
      )}
    </div>
  );
}

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<ExtendedMessage>;
}) {
  const chatId = id || uuidv4();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    isLoading,
    stop,
    append,
    inputId,
  } = useCustomChat({
    initialMessages,
    id: chatId,
  });

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

  const handleEditComplete = async (messageId: string, newContent: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Create new message array with edited message and remove subsequent messages
    const updatedMessages = messages.slice(0, messageIndex + 1);
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: newContent,
    };

    // Update messages state
    setMessages(updatedMessages);
    setEditingMessageId(null);

    // Trigger new completion
    setInput("");
    await handleSubmit(undefined, {
      allowEmptySubmit: true,
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div
        className="flex-1 overflow-y-auto pb-[200px] pt-16 md:pt-20"
        ref={messagesContainerRef}
      >
        {messages.length > 0 ? (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                "group relative mb-4 flex items-start md:px-4",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex w-full max-w-2xl flex-col gap-2 rounded-lg px-4 py-2",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <div className="text-sm font-semibold">
                  {message.role === "user" ? "You" : "Assistant"}
                </div>
                <MessageContent
                  message={message}
                  isEditing={editingMessageId === message.id}
                  onEditStart={() => setEditingMessageId(message.id)}
                  onEditComplete={(content) =>
                    handleEditComplete(message.id, content)
                  }
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground">
              No messages yet. Start a conversation!
            </p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-b from-muted/30 from-0% to-muted/30 to-50% pb-4 md:pb-[60px]">
        <div className="mx-auto sm:max-w-2xl sm:px-4">
          <div className="flex h-full items-center justify-center">
            {/* Your existing MultimodalInput component */}
            <MultimodalInput
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              stop={stop}
              attachments={attachments}
              setAttachments={setAttachments}
              messages={messages}
              append={async (message: Message | CreateMessage) => {
                await append(message as ExtendedMessage);
                return null;
              }}
              handleSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

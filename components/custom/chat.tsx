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

  // Debug logging
  // console.log("Message:", message);

  // Parse content if it's a JSON string
  const parsedContent = useMemo(() => {
    if (
      typeof message.content === "string" &&
      message.content.startsWith("[")
    ) {
      try {
        return JSON.parse(message.content);
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [message.content]);

  // Extract text content and tool calls/results
  const { textContent, toolInvocations } = useMemo(() => {
    if (!parsedContent) {
      return {
        textContent: message.content,
        toolInvocations: message.toolInvocations || [],
      };
    }

    const text = parsedContent
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .join("");

    const calls = parsedContent
      .filter((part: any) => part.type === "tool-call")
      .map((part: any) => ({
        state: "call",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: part.args,
      }));

    return {
      textContent: text,
      toolInvocations: [...calls, ...(message.toolInvocations || [])],
    };
  }, [parsedContent, message.content, message.toolInvocations]);

  // console.log("Tool Calls:", toolInvocations);

  // Handle tool role messages
  if (message.role === "tool") {
    try {
      const toolContent = JSON.parse(message.content);

      return (
        <div className="space-y-4">
          {Array.isArray(toolContent) ? (
            toolContent.map((tool: any, index: number) => (
              <div
                key={index}
                className="border rounded-lg overflow-hidden bg-muted/50"
              >
                <div className="border-b px-4 py-2">
                  <span className="text-sm font-medium">{tool.toolName}</span>
                </div>
                <div className="p-4">
                  <div className="font-mono text-sm whitespace-pre-wrap">
                    {typeof tool.result === "object"
                      ? JSON.stringify(tool.result, null, 2)
                      : String(tool.result)}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="prose dark:prose-invert">
              <Markdown>
                {String(
                  message.content ||
                    message.toolInvocations ||
                    message.tool_calls
                )}
              </Markdown>
            </div>
          )}
        </div>
      );
    } catch (e) {
      console.error("Error rendering tool message:", e);
      return (
        <div className="prose dark:prose-invert">
          <Markdown>{String(message.content)}</Markdown>
        </div>
      );
    }
  }

  if (isEditing && message.role === "user") {
    return (
      <textarea
        className="w-full bg-transparent resize-none focus:outline-none"
        value={editedContent}
        onChange={(e) => setEditedContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onEditComplete?.(editedContent);
          }
        }}
        autoFocus
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Text Content */}
      {textContent && (
        <div className="prose dark:prose-invert">
          <Markdown>{textContent}</Markdown>
        </div>
      )}

      {/* Tool Calls and Results */}
      {message.role === "assistant" &&
        toolInvocations &&
        toolInvocations.map((tool: any) => (
          <div
            key={tool.toolCallId}
            className="border rounded-lg overflow-hidden bg-muted/50"
          >
            <div className="border-b px-4 py-2 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{tool.toolName}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {tool.state}
                </span>
              </div>
            </div>

            {/* Code Section */}
            <div className="p-4 bg-muted/30">
              <div className="font-mono text-sm overflow-x-auto">
                <Markdown>{`\`\`\`python\n${typeof tool.args === "string" ? tool.args : JSON.stringify(tool.args, null, 2)}\n\`\`\``}</Markdown>
              </div>
            </div>

            {/* Tool Result Section */}
            {tool.state === "result" && tool.result && (
              <div className="border-t">
                <div className="p-4 bg-muted/20">
                  <h4 className="text-sm font-medium mb-2">
                    Result from {tool.toolName}
                  </h4>
                  {typeof tool.result === "object" ? (
                    "success" in tool.result ? (
                      tool.result.success === false ? (
                        <div className="text-red-500 text-sm">
                          Error:{" "}
                          {String(
                            tool.result.error?.message || "Unknown error"
                          )}
                        </div>
                      ) : (
                        <div className="font-mono text-sm whitespace-pre-wrap">
                          {String(tool.result.output || "No output provided")}
                        </div>
                      )
                    ) : (
                      <div className="font-mono text-sm whitespace-pre-wrap">
                        {JSON.stringify(tool.result, null, 2)}
                      </div>
                    )
                  ) : (
                    <div className="font-mono text-sm whitespace-pre-wrap">
                      {String(tool.result)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
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

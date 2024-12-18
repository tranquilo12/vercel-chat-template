"use client";

import { Attachment, Message, CreateMessage, CoreMessage } from "ai";
import {
  Check,
  Copy,
  Code,
  Database,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

import { Markdown } from "@/components/custom/markdown";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";
import { highlightCode } from "@/lib/syntax-highlighting";
import { cn } from "@/lib/utils";

import { JsonFormatter } from "./JsonFormatter";
import { MultimodalInput } from "./multimodal-input";
import { useCustomChat, ExtendedMessage } from "./useCustomChat";

// Instead of redeclaring the Markdown module, create a new interface
interface CustomMarkdownProps {
  children: string;
  components?: {
    pre: React.FC<{ children: React.ReactNode }>;
    code: React.FC<{ children: React.ReactNode; className?: string }>;
  };
}

// Type assertion for Markdown component
const MarkdownComponent = Markdown as React.FC<CustomMarkdownProps>;

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

  // Add ref for code elements
  const codeRef = useRef<HTMLDivElement>(null);

  // Move code highlighting to client-side only
  useEffect(() => {
    if (codeRef.current) {
      const codeBlocks = codeRef.current.querySelectorAll('pre code');
      codeBlocks.forEach((block) => {
        if (block.className.includes('language-')) {
          const language = block.className.split('language-')[1]?.split(' ')[0] || 'plaintext';
          block.innerHTML = highlightCode(block.textContent || '', language);
        }
      });
    }
  }, [message.content]);

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
                <div className="border-b px-4 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{tool.toolName}</span>
                    {tool.result.success === false && (
                      <span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive">
                        Error
                      </span>
                    )}
                    {tool.result.success === true && (
                      <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
                        Success
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  {tool.result.success === false ? (
                    <div className="text-sm text-destructive">
                      {tool.error?.message ||
                        "An error occurred during execution"}
                    </div>
                  ) : (
                    <div className="prose dark:prose-invert">
                      <MarkdownComponent>
                        {typeof tool.result === "object"
                          ? "```json\n" +
                          JSON.stringify(tool.result, null, 2) +
                          "\n```"
                          : String(tool.result)}
                      </MarkdownComponent>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="prose dark:prose-invert">
              <MarkdownComponent>{String(message.content)}</MarkdownComponent>
            </div>
          )}
        </div>
      );
    } catch (e) {
      console.error("Error rendering tool message:", e);
      return (
        <div className="prose dark:prose-invert">
          <MarkdownComponent>{String(message.content)}</MarkdownComponent>
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
    <div className="space-y-4" ref={codeRef}>
      {/* Text Content */}
      {textContent && (
        <div className="prose dark:prose-invert max-w-none break-words">
          <MarkdownComponent>{textContent}</MarkdownComponent>
        </div>
      )}

      {/* Tool Calls and Results */}
      {message.role === "assistant" &&
        toolInvocations &&
        toolInvocations.map((tool: any) => (
          <ToolDisplay key={tool.toolCallId} tool={tool} />
        ))}
    </div>
  );
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      className="p-2 hover:bg-muted/80 rounded-md transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        copy();
      }}
    >
      {copied ? (
        <Check className="size-4 text-green-500" />
      ) : (
        <Copy className="size-4 text-muted-foreground" />
      )}
    </button>
  );
};

const ToolDisplay = ({ tool }: { tool: any }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const parsedArgs = useMemo(() => {
    if (typeof tool.args === "string") {
      try {
        return JSON.parse(tool.args);
      } catch {
        return null;
      }
    }
    return tool.args;
  }, [tool.args]);

  const isCodeBlock = parsedArgs?.code && parsedArgs?.output_format;

  useEffect(() => {
    if (codeRef.current && isCodeBlock) {
      const codeElement = codeRef.current.querySelector('code');
      if (codeElement) {
        const language = parsedArgs.language || 'plaintext';
        codeElement.innerHTML = highlightCode(parsedArgs.code, language);
      }
    }
  }, [isCodeBlock, isExpanded, parsedArgs.code, parsedArgs.language]);

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/50">
      <div
        className="border-b px-4 py-2 flex justify-between items-center bg-muted/70 cursor-pointer hover:bg-muted/90 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {/* Tool Icon */}
          {isCodeBlock ? (
            <Code className="size-4 text-blue-500" />
          ) : (
            <Database className="size-4 text-primary" />
          )}

          <span className="text-sm font-medium">{tool.toolName}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
            {tool.state}
          </span>
          {isCodeBlock && (
            <span className="text-xs px-2 py-1 rounded-full bg-blue-500/10 text-blue-500">
              Code
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && isCodeBlock && <CopyButton text={parsedArgs.code} />}
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className="overflow-x-auto">
            <div className="max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-16rem)]">
              {isCodeBlock ? (
                <div className="prose dark:prose-invert max-w-none relative">
                  <pre className="text-sm w-[80dvw] md:max-w-[500px] overflow-x-scroll bg-zinc-100 dark:bg-zinc-800 p-3 rounded-md">
                    <code className={parsedArgs.language || "plaintext"}>
                      {parsedArgs.code}
                    </code>
                  </pre>
                </div>
              ) : (
                <JsonFormatter
                  content={
                    typeof tool.args === "string"
                      ? tool.args
                      : JSON.stringify(tool.args)
                  }
                  isStreaming={tool.state === "partial-call"}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export function Chat({
  id,
  initialMessages,
  parentChatId,
  forkedFromMessageId,
  title,
}: {
  id: string;
  initialMessages: Array<ExtendedMessage>;
  parentChatId?: string;
  forkedFromMessageId?: string;
  title?: string;
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
    parentChatId,
    forkedFromMessageId,
    title,
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

  const handleFork = async (messageId: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    // Create a new chat with messages up to the fork point
    const forkedMessages = messages.slice(0, messageIndex + 1);
    setMessages(forkedMessages);

    // Trigger new completion with fork parameters
    await handleSubmit(undefined, {
      forkChat: true,
      newTitle: `Fork from ${messageId}`,
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
                <div className="flex justify-between items-center">
                  <div className="text-sm font-semibold">
                    {message.role === "user" ? "You" : "Assistant"}
                  </div>
                  {message.role === "user" && (
                    <button
                      onClick={() => handleFork(message.id)}
                      className="text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                    >
                      Fork
                    </button>
                  )}
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

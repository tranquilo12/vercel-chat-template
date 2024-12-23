"use client";

import { Attachment, CreateMessage } from "ai";
import {
  Check,
  Copy,
  Code,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

import { DiffViewer } from "@/components/custom/DiffViewer";
import { ForkChain } from "@/components/custom/ForkChain";
import { Markdown } from "@/components/custom/markdown";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";
import { highlightCode } from "@/lib/syntax-highlighting";
import { cn } from "@/lib/utils";
import { Fork, MessageDiff } from "@/types/fork";
import { CustomToolInvocation, ExtendedMessage } from "@/types/tools";

import { JsonFormatter } from "./JsonFormatter";
import { MultimodalInput } from "./multimodal-input";
import { useCustomChat } from "./useCustomChat";
import { useForkState } from "./useForkState";

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

interface MessageContentProps {
  message: ExtendedMessage;
  isEditing?: boolean;
  onEditComplete?: (content: string) => void;
  onEditStart?: () => void;
  isDraft?: boolean;
  isForkMessage?: boolean;
  onSubmitFork?: () => void;
  editMode: 'direct' | 'fork';
}

function MessageContent({
  message,
  isEditing,
  onEditComplete,
  onEditStart,
  isDraft,
  isForkMessage,
  onSubmitFork,
  editMode,
}: MessageContentProps) {
  const [editedContent, setEditedContent] = useState(message.content);
  const codeRef = useRef<HTMLDivElement>(null);

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

  const { textContent, toolInvocations } = useMemo(() => {
    if (!parsedContent) {
      return {
        textContent: message.content,
        toolInvocations: message.toolInvocations || [],
      };
    }

    try {
      const parsed = Array.isArray(parsedContent) ? parsedContent : JSON.parse(message.content);
      if (Array.isArray(parsed)) {
        const text = parsed
          .filter((part: any) => part.type === "text")
          .map((part: any) => part.text)
          .join("");

        const calls = parsed
          .filter((part: any) => part.type === "tool-call")
          .map((part: any) => ({
            state: part.state || "call",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            args: part.args,
            argsTextDelta: part.argsTextDelta,
            result: part.result
          }));

        // Merge existing tool invocations with new ones
        const mergedCalls = [...calls as CustomToolInvocation[]];
        message.toolInvocations?.forEach(existing => {
          if (!mergedCalls.find(call => call.toolCallId === existing.toolCallId)) {
            mergedCalls.push(existing);
          }
        });

        return {
          textContent: text,
          toolInvocations: mergedCalls,
        };
      }
    } catch (e) {
      console.error("Error parsing message content:", e);
    }

    return {
      textContent: message.content,
      toolInvocations: message.toolInvocations || [],
    };
  }, [message.content, message.toolInvocations, parsedContent]);

  // Handle code highlighting
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
  }, [textContent]);

  // Handle keyboard events for editing
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onEditComplete?.(editedContent);
    }
  };

  // Render editing interface
  if (isEditing) {
    return (
      <div className="space-y-2">
        <textarea
          className="w-full bg-transparent resize-none focus:outline-none min-h-[100px]"
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Press Enter to save, Shift+Enter for new line"
          autoFocus
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <button
            onClick={() => onEditComplete?.(editedContent)}
            className="px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditedContent(message.content);
              onEditStart?.();
            }}
            className="px-2 py-1 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
          >
            Cancel
          </button>
          <span className="ml-2 text-xs text-muted-foreground">
            Press Enter to save • Shift+Enter for new line
          </span>
        </div>
      </div>
    );
  }

  // Render tool messages
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
                      {tool.error?.message || "An error occurred during execution"}
                    </div>
                  ) : (
                    <div className="prose dark:prose-invert">
                      <MarkdownComponent>
                        {typeof tool.result === "object"
                          ? "```json\n" + JSON.stringify(tool.result, null, 2) + "\n```"
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

  // Render regular message content with tool invocations
  return (
    <div className="space-y-4" ref={codeRef}>
      {/* Text Content */}
      {textContent && (
        <div className="prose dark:prose-invert max-w-none break-words">
          <MarkdownComponent>{textContent}</MarkdownComponent>
        </div>
      )}

      {/* Edit Button for Fork Messages */}
      {isForkMessage && !isEditing && (
        <button
          onClick={onEditStart}
          className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded hover:bg-blue-500/20 transition-colors"
        >
          Edit Fork
        </button>
      )}

      {/* Tool Calls and Results */}
      {message.role === "assistant" && toolInvocations && toolInvocations.length > 0 && (
        <div className="space-y-2">
          {toolInvocations.map((tool) => (
            <ToolDisplay key={tool.toolCallId} tool={tool} />
          ))}
        </div>
      )}
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

interface ToolDisplayProps {
  tool: CustomToolInvocation;
}

const ToolDisplay = ({ tool }: ToolDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const parsedArgs = useMemo(() => {
    try {
      return typeof tool.args === "string"
        ? JSON.parse(tool.args)
        : tool.args || {};
    } catch {
      return {};
    }
  }, [tool.args]);

  const isStreaming = tool.state === "partial-call" || tool.state === "call";
  const hasResult = tool.state === "result" && tool.result;
  const isCodeBlock = parsedArgs?.code &&
    (tool.toolName === "executePythonCode" || parsedArgs.language);

  return (
    <div className="border rounded-lg mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          {isStreaming ? (
            <div className="animate-spin">⟳</div>
          ) : (
            <Code className="size-4" />
          )}
          <span className="text-sm font-medium">
            {tool.toolName || "Unknown Tool"}
          </span>
          {isStreaming && (
            <span className="text-xs text-muted-foreground">
              (Streaming...)
            </span>
          )}
          {hasResult && (
            <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500">
              Complete
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">
          <div className="overflow-x-auto">
            <div className="max-w-[calc(100vw-4rem)] md:max-w-[calc(100vw-16rem)]">
              {/* Tool Arguments */}
              <div className="mb-4">
                <h4 className="text-sm font-medium mb-2">Arguments:</h4>
                {isCodeBlock ? (
                  <div className="prose dark:prose-invert max-w-none relative">
                    <pre className="text-sm w-[80dvw] md:max-w-[500px] overflow-x-scroll bg-zinc-100 dark:bg-zinc-800 p-3 rounded-md">
                      <code className={parsedArgs.language || "plaintext"}>
                        {parsedArgs.code || "No code provided"}
                      </code>
                    </pre>
                  </div>
                ) : (
                  <JsonFormatter
                    content={
                      typeof tool.args === "string"
                        ? tool.args
                        : JSON.stringify(tool.args || {})
                    }
                    isStreaming={isStreaming}
                  />
                )}
              </div>

              {/* Tool Result */}
              {hasResult && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Result:</h4>
                  <div className="prose dark:prose-invert">
                    <MarkdownComponent>
                      {typeof tool.result === "object"
                        ? "```json\n" + JSON.stringify(tool.result, null, 2) + "\n```"
                        : String(tool.result)}
                    </MarkdownComponent>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ChatProps {
  id: string;
  initialMessages: Array<ExtendedMessage>;
  parentChatId?: string;
  forkedFromMessageId?: string;
  title?: string;
  isFork?: boolean;
  forkId?: string;
  editPoint?: MessageDiff;
  status?: 'draft' | 'submitted';
  forkChain?: Fork[];
  initialEditingMessageId?: string;
}

export function Chat({
  id,
  initialMessages,
  parentChatId,
  forkedFromMessageId,
  title,
  isFork,
  forkId,
  editPoint,
  status,
  initialEditingMessageId,
  forkChain,
}: ChatProps) {
  const router = useRouter();
  const chatId = id || uuidv4();
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    messages,
    handleSubmit,
    input,
    setInput,
    isLoading,
    setIsLoading,
    handleDraftEdit,
    isEditing,
    editingMessageId,
    setEditingMessageId,
    handleDirectEdit,
    append,
    setIsEditing,
  } = useCustomChat({
    initialMessages,
    id: chatId,
    parentChatId,
    forkedFromMessageId,
    title: title || undefined,
    isFork: isFork || undefined,
    forkId: forkId || undefined,
    editPoint: editPoint || undefined,
    status: status || undefined,
    initialEditingMessageId,
  });

  const {
    activeFork,
    isSubmitting,
    setIsSubmitting,
    toggleDiffExpansion,
    handleForkSelect,
    isDiffExpanded
  } = useForkState({
    initialFork: forkId
      ? {
        id: forkId,
        chatId: id,
        parentMessageId: forkedFromMessageId || "",
        messageDiffs: [],
        messages: initialMessages as ExtendedMessage[],
        baseMessages: initialMessages as ExtendedMessage[],
        appendedMessages: [],
        ancestry: [],
        editPoint: editPoint as MessageDiff,
        status: status || "draft",
        createdAt: new Date(),
      }
      : undefined,
    forkChain,
  });

  const [messagesContainerRef, messagesEndRef] = useScrollToBottom<HTMLDivElement>();
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);
  const [editMode, setEditMode] = useState<"direct" | "fork">("direct");

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleMessageEdit = async (messageId: string, newContent: string) => {
    if (editMode === "direct") {
      await handleDirectEdit(messageId, newContent);
    } else {
      await handleFork(messageId, newContent);
    }
  };

  const handleFork = async (messageId: string, newContent: string) => {
    const newForkId = uuidv4();
    const originalMessage = messages.find((m) => m.id === messageId);

    try {
      await fetch(`${window.location.origin}/api/chat/${id}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newForkId,
          chatId: id,
          parentMessageId: messageId,
          messages: messages.map((m) => ({
            ...m,
            toolInvocations: m.toolInvocations || [],
          })),
          baseMessages: initialMessages.map((m) => ({
            ...m,
            toolInvocations: m.toolInvocations || [],
          })),
          editPoint: {
            messageId,
            originalContent: originalMessage?.content || "",
            newContent,
            timestamp: new Date().toISOString(),
          },
        }),
      });
      router.push(`/chat/${id}/fork/${newForkId}`);
    } catch (error) {
      console.error("Failed to create fork:", error);
    }
  };

  const handleSubmitFork = async () => {
    if (!forkId) return;
    try {
      await fetch(`/api/chat/${id}/fork/${forkId}/submit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "submitted",
          messages: messages.map((m) => ({
            ...m,
            toolInvocations: m.toolInvocations || [],
          })),
          parentMessageId: messages[messages.length - 1]?.id,
        }),
      });
      router.refresh();
    } catch (error) {
      console.error("Failed to submit fork:", error);
    }
  };

  useEffect(() => {
    if (initialEditingMessageId && isFork && status === "draft") {
      setEditingMessageId(initialEditingMessageId);
      setIsEditing(true);
    }
  }, [initialEditingMessageId, isFork, setEditingMessageId, setIsEditing, status]);

  return (
    <div className="flex flex-col h-screen bg-white text-black dark:bg-zinc-900 dark:text-zinc-100">
      <div className="p-4 border-b">
        <h2 className="text-lg font-medium">{title || "Chat"}</h2>
        {editPoint && (
          <DiffViewer
            diff={editPoint}
            isExpanded={isDiffExpanded(editPoint.id)}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto" ref={messagesContainerRef}>
        {messages.length > 0 ? (
          messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                "group relative mb-4 flex items-start px-4",
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
                    <div className="flex items-center gap-2">
                      {editingMessageId === message.id ? (
                        <div className="flex items-center gap-4 mr-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="editMode"
                              value="direct"
                              checked={editMode === "direct"}
                              onChange={(e) =>
                                setEditMode(e.target.value as "direct" | "fork")
                              }
                            />
                            <span className="text-xs">Direct Edit</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="editMode"
                              value="fork"
                              checked={editMode === "fork"}
                              onChange={(e) =>
                                setEditMode(e.target.value as "direct" | "fork")
                              }
                            />
                            <span className="text-xs">Fork on Edit</span>
                          </label>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingMessageId(message.id)}
                          className="text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          {editMode === "fork" ? "Fork" : "Edit"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <MessageContent
                  message={message}
                  isEditing={editingMessageId === message.id}
                  onEditStart={() => setEditingMessageId(message.id)}
                  onEditComplete={(content) => handleMessageEdit(message.id, content)}
                  isDraft={isFork && status === "draft"}
                  isForkMessage={isFork && message.id === editPoint?.id}
                  onSubmitFork={
                    message.id === editPoint?.id ? handleSubmitFork : undefined
                  }
                  editMode={editMode}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">
              No messages yet. Start a conversation!
            </p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t p-4">
        <div className="mx-auto w-full max-w-2xl">
          <MultimodalInput
            input={input}
            setInput={setInput}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            append={async (message: ExtendedMessage | CreateMessage) => {
              await append(message as ExtendedMessage);
              return null;
            }}
            handleSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}

"use client";

import { Attachment, Message, CreateMessage } from "ai";
import {
  Check,
  Copy,
  Code,
  Database,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  isDraft,
  isForkMessage,
  onSubmitFork,
  editMode,
}: {
  message: ExtendedMessage;
  isEditing?: boolean;
  onEditComplete?: (content: string) => void;
  onEditStart?: () => void;
  isDraft?: boolean;
  isForkMessage?: boolean;
  onSubmitFork?: () => void;
  editMode: 'direct' | 'fork';
}) {
  // Move all hooks to the top of the component
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (editMode === 'direct') {
        onEditComplete?.(editedContent);
        // Direct edits will be handled by handleDirectEdit
      } else {
        onEditComplete?.(editedContent);
        // Fork edits will be handled by handleDraftEdit
      }
    }
  };

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

  return (
    <div className="space-y-4" ref={codeRef}>
      {/* Text Content */}
      {textContent && (
        <div className="prose dark:prose-invert max-w-none break-words">
          <MarkdownComponent>{textContent}</MarkdownComponent>
        </div>
      )}

      {isForkMessage && !isEditing && (
        <button
          onClick={onEditStart}
          className="text-xs px-2 py-1 bg-blue-500/10 text-blue-500 rounded hover:bg-blue-500/20 transition-colors"
        >
          Edit Fork
        </button>
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

  // Safely parse arguments
  const parsedArgs = useMemo(() => {
    try {
      return typeof tool.args === "string"
        ? JSON.parse(tool.args)
        : tool.args || {};
    } catch {
      return {};
    }
  }, [tool.args]);

  // Check if this is a code block
  const isCodeBlock = useMemo(() => {
    return parsedArgs?.code &&
      (tool.toolName === "executePythonCode" ||
        parsedArgs.language);
  }, [parsedArgs, tool.toolName]);

  return (
    <div className="border rounded-lg mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-muted/50"
      >
        <div className="flex items-center gap-2">
          {tool.state === "call" && <Code className="size-4" />}
          <span className="text-sm font-medium">
            {tool.toolName || "Unknown Tool"}
          </span>
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

interface ChatProps {
  id: string;
  initialMessages: Array<ExtendedMessage>;
  parentChatId?: string;
  forkedFromMessageId?: string;
  title?: string;
  isFork?: boolean;
  forkId?: string;
  editPoint?: { messageId: string; originalContent: string; newContent: string; timestamp: string };
  status?: 'draft' | 'submitted';
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

  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  const [editMode, setEditMode] = useState<'direct' | 'fork'>('direct');

  const handleFork = async (messageId: string, newContent?: string) => {
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const messageToFork = messages[messageIndex];
    const originalContent = messageToFork.content;

    try {
      // Create fork with the new content if provided
      const response = await fetch('/api/fork', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: id,
          parentChatId: id,
          parentMessageId: messageId,
          messages: messages.slice(0, messageIndex + 1).map(msg =>
            msg.id === messageId && newContent
              ? { ...msg, content: newContent }
              : msg
          ),
          title: `Fork of message ${messageId}`,
          editPoint: {
            messageId,
            originalContent,
            newContent: newContent || originalContent,
            timestamp: new Date().toISOString()
          },
          status: 'draft'
        }),
      });

      if (!response.ok) throw new Error('Failed to create fork');

      const fork = await response.json();
      router.push(`/chat/${id}/fork/${fork.id}`);
    } catch (error) {
      console.error('Failed to create fork:', error);
    }
  };

  const handleSubmitFork = async () => {
    if (!forkId) return;

    try {
      // First update the fork status
      await fetch('/api/fork', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: forkId, status: 'submitted' }),
      });

      // Create an empty submission to trigger the LLM with existing messages
      await handleSubmit(undefined, {
        submitDraft: true,
        allowEmptySubmit: true,
        // Pass empty input but ensure messages are processed
        messages: messages,
        // Ensure we're continuing in the same chat
        forkChat: false
      });

    } catch (error) {
      console.error('Failed to submit fork:', error);
    }
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  const handleMessageEdit = async (messageId: string, newContent: string) => {
    if (editMode === 'direct') {
      await handleDirectEdit(messageId, newContent);
      await handleSubmit(undefined, {
        allowEmptySubmit: true,
        messages: messages,
      });
    } else {
      // Pass the new content to handleFork
      await handleFork(messageId, newContent);
    }
  };

  // Set initial editing state
  useEffect(() => {
    if (initialEditingMessageId && isFork && status === 'draft') {
      setEditingMessageId(initialEditingMessageId);
      setIsEditing(true);
    }
  }, [initialEditingMessageId, isFork, setEditingMessageId, setIsEditing, status]);

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
                    <div className="flex items-center gap-2">
                      {editingMessageId === message.id ? (
                        // Show radio buttons when editing
                        <div className="flex items-center gap-4 mr-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="editMode"
                              value="direct"
                              checked={editMode === 'direct'}
                              onChange={(e) => setEditMode(e.target.value as 'direct' | 'fork')}
                              className="radio"
                            />
                            <span className="text-xs">Direct Edit</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="editMode"
                              value="fork"
                              checked={editMode === 'fork'}
                              onChange={(e) => setEditMode(e.target.value as 'direct' | 'fork')}
                              className="radio"
                            />
                            <span className="text-xs">Fork on Edit</span>
                          </label>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (editMode === 'fork') {
                              handleFork(message.id);
                            } else {
                              setEditingMessageId(message.id);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded bg-primary/10 hover:bg-primary/20 transition-colors"
                        >
                          {editMode === 'fork' ? 'Fork' : 'Edit'}
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
                  isDraft={isFork && status === 'draft'}
                  isForkMessage={isFork && message.id === editPoint?.messageId}
                  onSubmitFork={message.id === editPoint?.messageId ? handleSubmitFork : undefined}
                  editMode={editMode}
                />
                {/* Show submit fork banner inline with edited message */}
                {isFork && status === 'draft' && message.id === editPoint?.messageId && (
                  <div className="mt-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-3 py-2 flex justify-between items-center">
                    <span className="text-sm text-yellow-600 dark:text-yellow-400">
                      Editing Fork Draft
                    </span>
                    <button
                      onClick={handleSubmitFork}
                      className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md"
                    >
                      Submit Fork
                    </button>
                  </div>
                )}
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

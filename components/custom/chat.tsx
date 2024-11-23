"use client";

import { Attachment, Message, CreateMessage } from "ai";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";
import { cn } from "@/lib/utils";

import { CodeBlock } from "./CodeBlock";
import { MultimodalInput } from "./multimodal-input";
import { useCustomChat } from "./useCustomChat";
import { Markdown } from "@/components/custom/markdown";

function extractCodeBlocks(content: string) {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string; index: number }> = [];
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || "text",
      code: match[2].trim(),
      index: match.index,
    });
  }

  return blocks;
}

function MessageContent({ message }: { message: Message }) {
  const codeBlocks = extractCodeBlocks(message.content);

  if (codeBlocks.length === 0) {
    return (
      <div key={message.id} className="prose dark:prose-invert">
        <Markdown>{message.content}</Markdown>
      </div>
    );
  }

  let lastIndex = 0;
  const elements: JSX.Element[] = [];

  codeBlocks.forEach((block, i) => {
    // Add text before code block
    if (block.index > lastIndex) {
      elements.push(
        <Markdown key={`${message.id}-text-${i}`}>
          {message.content.slice(lastIndex, block.index)}
        </Markdown>
      );
    }

    // Add code block
    const executionResult = message.toolInvocations?.find((tool) =>
      tool.args.includes(block.code)
    );

    elements.push(
      <CodeBlock
        key={`code-${i}`}
        code={block.code}
        language={block.language}
        executionResult={
          executionResult?.state === "result"
            ? {
                output: executionResult.result,
                error:
                  typeof executionResult.result === "object" &&
                  "error" in executionResult.result
                    ? executionResult.result.error
                    : undefined,
              }
            : undefined
        }
      />
    );

    lastIndex = block.index + block.code.length + block.language.length + 6; // 6 for the ```\n and ```
  });

  // Add remaining text after last code block
  if (lastIndex < message.content.length) {
    elements.push(
      <Markdown key={`${message.id}-text-last`}>
        {message.content.slice(lastIndex)}
      </Markdown>
    );
  }

  return <div key={message.id}>{elements}</div>;
}

export function Chat({
  id,
  initialMessages,
}: {
  id: string;
  initialMessages: Array<Message>;
}) {
  const chatId = id || uuidv4();

  const {
    messages,
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
                {/* Role indicator (User/Assistant) */}
                <div className="text-sm font-semibold">
                  {message.role === "user" ? "You" : "Assistant"}
                </div>

                {/* Message content with code blocks */}
                <MessageContent message={message} />

                {/* Tool execution status */}
                {message.toolInvocations?.map((tool, toolIndex) => (
                  <div
                    key={tool.toolCallId}
                    className="text-xs text-muted-foreground/80"
                  >
                    {tool.state === "call" && (
                      <span>Executing {tool.toolName}...</span>
                    )}
                  </div>
                ))}
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
                await append(message as Message);
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

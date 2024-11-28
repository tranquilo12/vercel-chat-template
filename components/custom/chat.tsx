"use client";

import { Attachment, Message, CreateMessage } from "ai";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { Markdown } from "@/components/custom/markdown";
import { useScrollToBottom } from "@/components/custom/use-scroll-to-bottom";
import { cn } from "@/lib/utils";

import { MultimodalInput } from "./multimodal-input";
import { useCustomChat, ExtendedMessage } from "./useCustomChat";

function MessageContent({ message }: { message: ExtendedMessage }) {
  return (
    <div className="prose dark:prose-invert space-y-4">
      {/* Message Content Section */}
      {message.content && (
        <div className="border-l-2 border-primary/20 pl-4">
          {/* <div className="text-xs text-muted-foreground mb-2">Content</div> */}
          <Markdown>{message.content}</Markdown>
        </div>
      )}

      {/* Tool Invocations Section */}
      {message.toolInvocations?.map((tool) => (
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
${typeof tool.args === "object" ? tool.args.code : tool.args}
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
      {!message.content && !message.toolInvocations?.length && (
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

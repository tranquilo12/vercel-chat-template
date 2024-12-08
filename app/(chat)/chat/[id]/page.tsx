import { CoreMessage } from "ai";
import { notFound } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import { auth } from "@/app/(auth)/auth";
import { Chat as PreviewChat } from "@/components/custom/chat";
import { getChatById } from "@/db/queries";
import { convertToUIMessages } from "@/lib/utils";

function preprocessMessage(message: any): CoreMessage {
  if (message.role === 'assistant' && Array.isArray(message.content)) {
    // Extract text content
    const textContent = message.content
      .filter((item: any) => item.type === 'text')
      .map((item: any) => item.text)
      .join('');

    // Extract tool calls
    const toolCalls = message.content
      .filter((item: any) => item.type === 'tool-call')
      .map((item: any) => ({
        id: item.toolCallId,
        type: 'function',
        function: {
          name: item.toolName,
          arguments: JSON.stringify(item.args)
        }
      }));

    // Return formatted message
    return {
      role: 'assistant',
      content: textContent || JSON.stringify(message.content),
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined
    } as CoreMessage;
  }

  // Return unchanged for other message types
  return message as CoreMessage;
}

export default async function Page({ params }: { params: any }) {
  const session = await auth();
  if (!session?.user) {
    return notFound();
  }

  const chatId = params.id || uuidv4();

  let chatData = null;
  if (params.id) {
    chatData = await getChatById({ id: params.id });
    if (!chatData) {
      return notFound();
    }

    // Check ownership
    if (chatData.userId !== session.user.id) {
      return notFound();
    }
  }

  const preprocessedMessages = params.id 
    ? (Array.isArray(chatData?.messages) ? chatData.messages : []).map(preprocessMessage) as Array<CoreMessage>
    : [];

  const chat = params.id
    ? {
        ...chatData,
        messages: convertToUIMessages(preprocessedMessages),
      }
    : {
        id: chatId,
        messages: [],
        userId: session.user.id,
      };

  return <PreviewChat id={chat.id} initialMessages={chat.messages} />;
}

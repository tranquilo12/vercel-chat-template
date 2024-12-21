"use client";

import { v4 as uuidv4 } from "uuid";

import { Chat } from "@/components/custom/chat";

export default function Page() {
  const chatId = uuidv4();
  return (
    <Chat
      id={chatId}
      initialMessages={[]}
      parentChatId={undefined}
      forkedFromMessageId={undefined}
      title={undefined}
      isFork={false}
      forkId={undefined}
      editPoint={undefined}
      status={undefined}
      initialEditingMessageId={undefined}
    />
  );
}

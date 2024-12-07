"use client";

import { v4 as uuidv4 } from "uuid";

import { Chat } from "@/components/custom/chat";

export default function Page() {
  return <Chat id={uuidv4()} initialMessages={[]} />;
}

'use client'

import { Chat } from "@/components/custom/chat";
import { v4 as uuidv4 } from 'uuid';

export default function Page() {
  return <Chat id={uuidv4()} initialMessages={[]} />;
}

import {CoreMessage} from "ai";
import {notFound} from "next/navigation";
import {v4 as uuidv4} from 'uuid';

import {auth} from "@/app/(auth)/auth";
import {Chat as PreviewChat} from "@/components/custom/chat";
import {getChatById} from "@/db/queries";
import {convertToUIMessages} from "@/lib/utils";

export default async function Page({params}: { params: any }) {
    const session = await auth();
    if (!session?.user) {
        return notFound();
    }

    const chatId = params.id || uuidv4();

    let chatData = null;
    if (params.id) {
        chatData = await getChatById({id: params.id});
        if (!chatData) {
            return notFound();
        }

        // Check ownership
        if (chatData.userId !== session.user.id) {
            return notFound();
        }
    }

    const chat = params.id
        ? {
            ...chatData,
            messages: convertToUIMessages(chatData?.messages as Array<CoreMessage>),
        }
        : {
            id: chatId,
            messages: [],
            userId: session.user.id,
        };

    return <PreviewChat id={chat.id} initialMessages={chat.messages}/>;
}

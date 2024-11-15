import {convertToCoreMessages, Message, StreamData, streamText} from 'ai';

import {openaiModel} from '@/ai';
import {auth} from '@/app/(auth)/auth';
import {deleteChatById, getChatById, saveChat} from '@/db/queries';

export async function POST(req: Request) {
    const {id, messages}: { id: string; messages: Array<Message> } = await req.json();

    const session = await auth();
    if (!session) {
        return new Response('Unauthorized', {status: 401});
    }

    const coreMessages = convertToCoreMessages(messages);
    const data = new StreamData();

    const result = await streamText({
        model: openaiModel,
        messages: coreMessages,
        maxSteps: 5,
        onFinish: async ({responseMessages}) => {
            if (session.user && session.user.id) {
                try {
                    await saveChat({
                        id,
                        messages: [...coreMessages, ...responseMessages],
                        userId: session.user.id,
                    });
                } catch (error) {
                    console.error('Failed to save chat:', error);
                }
            }
            await data.close();
        }
    });

    return result.toDataStreamResponse();
}

export async function DELETE(req: Request) {
    const {searchParams} = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
        return new Response("Not Found", {status: 404});
    }

    const session = await auth();

    if (!session || !session.user) {
        return new Response("Unauthorized", {status: 401});
    }

    try {
        const chat = await getChatById({id});

        if (chat.userId !== session.user.id) {
            return new Response("Unauthorized", {status: 401});
        }

        await deleteChatById({id});

        return new Response("Chat deleted", {status: 200});
    } catch (error) {
        return new Response("An error occurred while processing your request", {
            status: 500,
        });
    }
}

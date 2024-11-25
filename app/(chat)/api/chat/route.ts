import { convertToCoreMessages, StreamData, streamText } from 'ai';

import { openaiModel } from '@/ai';
import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById, saveChat } from '@/db/queries';

export async function POST(req: Request) {
    const body = await req.json();
    const { chatId, messages } = body;

    const session = await auth();
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Add session debug logging
    console.debug('Session info:', {
        hasSession: !!session,
        hasUser: !!session.user,
        userId: session.user?.id
    });

    const coreMessages = convertToCoreMessages(messages);
    const data = new StreamData();

    const result = await streamText({
        model: openaiModel,
        messages: coreMessages,
        maxSteps: 5,
        experimental_toolCallStreaming: true,
        onChunk: async ({ chunk }) => {
            data.append(chunk);
        },
        onFinish: async ({ responseMessages }) => {
            if (session.user && session.user.id) {
                try {
                    await saveChat({
                        id: chatId,
                        messages: [...coreMessages, ...responseMessages],
                        userId: session.user.id,
                    });
                } catch (error) {
                    console.error('Failed to save chat:', error);
                    data.append({
                        type: 'error',
                        message: 'Failed to save chat',
                    });
                }
            } else {
                console.error('No valid session user for saving chat');
            }
            await data.close();
        },
    });

    return result.toDataStreamResponse();
}

export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);

    const id = searchParams.get("id");
    if (!id) {
        return new Response("Not Found", { status: 404 });
    }

    const session = await auth();
    if (!session || !session.user) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const chat = await getChatById({ id });
        if (chat.userId !== session.user.id) {
            return new Response("Unauthorized", { status: 401 });
        }

        await deleteChatById({ id });
        return new Response("Chat deleted", { status: 200 });
    } catch (error) {
        return new Response("An error occurred while processing your request", {
            status: 500,
        });
    }
}

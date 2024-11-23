import { convertToCoreMessages, StreamData, streamText } from 'ai';

import { openaiModel } from '@/ai';
import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById, saveChat } from '@/db/queries';

export async function POST(req: Request) {
    const body = await req.json();
    const { chatId, messages, experimental_attachements } = body;

    // Add more detailed debug logging
    console.debug('Received POST request:', {
        chatId,
        hasId: !!chatId,
        bodyKeys: Object.keys(body),
        messagesCount: messages?.length,
        messagesSample: messages?.slice(0, 1)
    });

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
        onFinish: async ({ responseMessages }) => {
            if (session.user && session.user.id) {
                try {
                    // Add pre-save logging
                    console.debug('Attempting to save chat with:', {
                        chatId,
                        messagesLength: [...coreMessages, ...responseMessages]?.length,
                        userId: session.user.id,
                        firstMessage: [...coreMessages, ...responseMessages][0]
                    });

                    // Validate all required fields
                    if (!chatId) {
                        throw new Error('Chat ID is missing');
                    }
                    if (!responseMessages) {
                        throw new Error('Response messages are missing');
                    }
                    if (!session.user.id) {
                        throw new Error('User ID is missing');
                    }

                    await saveChat({
                        id: chatId,
                        messages: [...coreMessages, ...responseMessages],
                        userId: session.user.id,
                    });
                } catch (error) {
                    console.error('Failed to save chat:', error);
                    // Add the error to the stream data if possible
                    data.append({
                        type: 'error',
                        message: 'Failed to save chat'
                    });
                }
            } else {
                console.error('No valid session user for saving chat');
            }
            await data.close();
        }
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

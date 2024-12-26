"server-only";

import { CoreMessage } from "ai";
import { genSaltSync, hashSync } from "bcrypt-ts";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { createForkAncestry } from "@/lib/forkUtils";
import { Fork, MessageDiff } from "@/types/fork";
import { CustomToolInvocation, ExtendedMessage } from "@/types/tools";

import { chat, user, User, fork } from "./schema";


// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let client = postgres('postgres://default:sFu6lU5WqohM@ep-sparkling-salad-a42y5o63-pooler.us-east-1.aws.neon.tech/verceldb?sslmode=require')
let db = drizzle(client);

// First, add type for chat messages at the top of the file
type ChatMessage = {
    id: string;
    role: string;
    content: string;
    toolInvocations?: any[];
};

export async function getUser(email: string): Promise<Array<User>> {
    try {
        return await db.select().from(user).where(eq(user.email, email));
    } catch (error) {
        console.error("Failed to get user from database");
        throw error;
    }
}

export async function createUser(email: string, password: string) {
    let salt = genSaltSync(10);
    let hash = hashSync(password, salt);

    try {
        return await db.insert(user).values({ email, password: hash });
    } catch (error) {
        console.error("Failed to create user in database");
        throw error;
    }
}

export async function saveChat({
    id,
    messages,
    userId,
}: {
    id: string;
    messages: ExtendedMessage[];
    userId: string;
}) {
    if (!id || !messages || !userId) {
        console.error('Missing required fields for saving chat', {
            id,
            messages,
            userId
        });
        return;
    }

    const normalizedMessages = messages.map(msg => {
        // Ensure proper handling of content that might be an array or object
        const content = typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content);

        // Properly handle tool invocations
        const toolInvocations = 'toolInvocations' in msg && Array.isArray(msg.toolInvocations)
            ? msg.toolInvocations.map((invocation: any) => ({
                ...invocation,
                args: typeof invocation.args === 'string'
                    ? invocation.args
                    : JSON.stringify(invocation.args),
                result: invocation.result
                    ? JSON.stringify(invocation.result)
                    : null,
                state: invocation.state || 'result'
            }))
            : [];

        return {
            ...msg,
            content,
            toolInvocations,
            role: msg.role
        };
    });

    try {
        const selectedChats = await db.select().from(chat).where(eq(chat.id, id));

        if (selectedChats.length > 0) {
            return await db
                .update(chat)
                .set({
                    messages: JSON.stringify(normalizedMessages),
                })
                .where(eq(chat.id, id));
        }

        return await db.insert(chat).values({
            id,
            createdAt: new Date(),
            messages: JSON.stringify(normalizedMessages),
            userId,
        });
    } catch (error) {
        console.error("Failed to save chat in database", error);
        throw error;
    }
}

export async function deleteChatById({ id }: { id: string }) {
    try {
        return await db.delete(chat).where(eq(chat.id, id));
    } catch (error) {
        console.error("Failed to delete chat by id from database");
        throw error;
    }
}

export async function getChatsByUserId({ id }: { id: string }) {
    try {
        const chats = await db
            .select()
            .from(chat)
            .where(eq(chat.userId, id))
            .orderBy(desc(chat.createdAt));

        return chats.map(chatData => ({
            ...chatData,
            messages: (chatData.messages as CoreMessage[]).map((msg: any) => {
                // Parse content if it's stringified
                const content = msg.content && typeof msg.content === 'string' && msg.content.startsWith('{')
                    ? JSON.parse(msg.content)
                    : msg.content;

                // Parse tool invocations
                const toolInvocations = msg.toolInvocations?.map((invocation: any) => ({
                    ...invocation,
                    args: typeof invocation.args === 'string' && invocation.args.startsWith('{')
                        ? JSON.parse(invocation.args)
                        : invocation.args,
                    result: invocation.result && typeof invocation.result === 'string'
                        ? JSON.parse(invocation.result)
                        : invocation.result || {},
                    state: invocation.state || 'result'
                })) || [];

                return {
                    ...msg,
                    content,
                    toolInvocations
                };
            }) || []
        }));
    } catch (error) {
        console.error("Failed to get chats by user from database");
        throw error;
    }
}

export async function getChatById({ id }: { id: string }) {
    try {
        console.log('Fetching chat by ID:', id);
        const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
        console.log('Chat fetched:', selectedChat);
        return selectedChat;
    } catch (error) {
        console.error("Failed to get chat by id from database", error);
        throw error;
    }
}

export async function getChatForks({ chatId }: { chatId: string }) {
    try {
        console.log('Fetching forks for chat:', chatId);
        const forks = await db
            .select()
            .from(fork)
            .where(eq(fork.chatId, chatId))
            .orderBy(desc(fork.createdAt));
        console.log('Forks fetched:', forks);
        return forks;
    } catch (error) {
        console.error("Failed to get forks for chat from database", error);
        throw error;
    }
}

export async function getForkById({ id }: { id: string }): Promise<Fork | null> {
    console.log('getForkById: Attempting to fetch fork with id:', id);
    try {
        const [selectedFork] = await db.select().from(fork).where(eq(fork.id, id));
        console.log('getForkById: Raw database result:', selectedFork);
        if (!selectedFork) {
            console.log('getForkById: No fork found with id:', id);
            return null;
        }
        // Transform database record to Fork type
        const transformedFork = {
            ...selectedFork,
            messageDiffs: selectedFork.messageDiffs || [],
            appendedMessages: selectedFork.appendedMessages || [],
            ancestry: selectedFork.ancestry || [],
            editPoint: selectedFork.editPoint || null,
            status: selectedFork.status || 'draft',
            createdAt: selectedFork.createdAt || new Date(),
            title: selectedFork.title || undefined,
        } as Fork;
        console.log('getForkById: Transformed fork:', {
            id: transformedFork.id,
            chatId: transformedFork.chatId,
            parentMessageId: transformedFork.parentMessageId,
            messageDiffsCount: transformedFork.messageDiffs.length,
            appendedMessagesCount: transformedFork.appendedMessages.length,
            status: transformedFork.status,
        });
        return transformedFork;
    } catch (error) {
        console.error('getForkById: Failed to get fork from database:', {
            error,
            stackTrace: error instanceof Error ? error.stack : undefined,
        });
        throw error;
    }
}

export async function deleteForkById({ id }: { id: string }) {
    try {
        console.log('deleteForkById: Attempting to delete fork with id:', id);
        return await db.delete(fork).where(eq(fork.id, id));
    } catch (error) {
        console.error("Failed to delete fork by id from database", error);
        throw error;
    }
}

export async function upsertFork({
    id,
    chatId,
    parentChatId,
    parentMessageId,
    messages,
    baseMessages,
    title,
    editPoint,
    status,
    parentFork,
}: {
    id: string;
    chatId: string;
    parentChatId?: string;
    parentMessageId: string;
    messages: ExtendedMessage[];
    baseMessages: ExtendedMessage[];
    title?: string;
    editPoint?: MessageDiff;
    status?: 'draft' | 'submitted';
    parentFork?: Fork | null;
}) {
    try {

        const messageDiffs: MessageDiff[] = [];
        const appendedMessages: ExtendedMessage[] = [];

        // Process all messages
        messages.forEach((msg) => {
            if (!msg) return;

            const baseMsg = baseMessages.find(m => m?.id === msg.id);
            if (baseMsg) {
                const contentChanged = baseMsg.content !== msg.content;
                const toolsChanged = !areToolInvocationsEqual(baseMsg.toolInvocations, msg.toolInvocations);

                if (contentChanged || toolsChanged) {
                    messageDiffs.push({
                        id: msg.id,
                        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
                        content: baseMsg.content,
                        newContent: msg.content,
                        timestamp: new Date().toISOString(),
                        toolInvocations: msg.toolInvocations || []
                    });
                }
            } else {
                appendedMessages.push({
                    ...msg,
                    toolInvocations: msg.toolInvocations || []
                });
            }
        });

        const ancestry = parentFork
            ? createForkAncestry(parentFork, messageDiffs, appendedMessages)
            : [];

        const dbForkData = {
            id,
            chatId,
            parentChatId,
            parentMessageId,
            messages: JSON.stringify(messages),
            baseMessages: JSON.stringify(baseMessages),
            messageDiffs: messageDiffs,
            appendedMessages: appendedMessages,
            ancestry: ancestry,
            title,
            editPoint: editPoint ? editPoint : null,
            status: status || 'draft',
            createdAt: new Date()
        };

        // Rest of the function remains the same
        const existingFork = await db
            .select()
            .from(fork)
            .where(eq(fork.id, id))
            .execute();

        if (existingFork.length > 0) {
            await db
                .update(fork)
                .set(dbForkData)
                .where(eq(fork.id, id))
                .execute();
        } else {
            await db
                .insert(fork)
                .values(dbForkData)
                .execute();
        }

        return {
            ...dbForkData,
            messages,
            baseMessages,
            messageDiffs,
            appendedMessages,
            ancestry,
            editPoint: editPoint || null
        };
    } catch (error) {
        console.error('Error in upsertFork:', error);
        throw error;
    }
}

// Helper function for deep comparison
function areToolInvocationsEqual(a: CustomToolInvocation[] = [], b: CustomToolInvocation[] = []): boolean {
    if (a.length !== b.length) return false;
    return a.every((invocationA, index) => {
        const invocationB = b[index];
        return invocationA.toolCallId === invocationB.toolCallId &&
            invocationA.toolName === invocationB.toolName &&
            invocationA.args === invocationB.args &&
            invocationA.result === invocationB.result &&
            invocationA.state === invocationB.state;
    });
}

export async function updateChatMessage({
    chatId,
    messageId,
    content,
    toolInvocations
}: {
    chatId: string;
    messageId: string;
    content: string;
    toolInvocations?: CustomToolInvocation[];
}) {
    try {
        const [selectedChat] = await db
            .select()
            .from(chat)
            .where(eq(chat.id, chatId));

        if (!selectedChat) throw new Error('Chat not found');

        const messages: ExtendedMessage[] = typeof selectedChat.messages === 'string'
            ? JSON.parse(selectedChat.messages)
            : selectedChat.messages;

        const updatedMessages = messages.map((msg) =>
            msg.id === messageId
                ? {
                    ...msg,
                    content,
                    toolInvocations: toolInvocations || msg.toolInvocations
                }
                : msg
        );

        const [updatedChat] = await db
            .update(chat)
            .set({ messages: JSON.stringify(updatedMessages) })
            .where(eq(chat.id, chatId))
            .returning();

        return updatedChat;
    } catch (error) {
        console.error('Failed to update chat message:', error);
        throw error;
    }
}

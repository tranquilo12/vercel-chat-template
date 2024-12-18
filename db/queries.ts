"server-only";

import { CoreMessage } from "ai";
import { genSaltSync, hashSync } from "bcrypt-ts";
import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { ExtendedMessage } from "@/components/custom/useCustomChat";
import { CreateForkParams } from "@/types/fork";

import { chat, user, User, fork, Fork } from "./schema";


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
    messages: CoreMessage[];
    userId: string;
}) {
    if (!id || !messages || !userId) {
        throw new Error('Missing required fields for saving chat');
    }

    const normalizedMessages = messages.map(msg => ({
        ...msg,
        content: msg.content,
        toolInvocations: 'toolInvocations' in msg ? msg.toolInvocations : [],
        role: msg.role
    }));

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
            messages: (chatData.messages as CoreMessage[]).map((msg: any) => ({
                ...msg,
                // Preserve the original content structure
                content: Array.isArray(msg.content)
                    ? msg.content
                    : msg.content,
                // Properly reconstruct tool invocations
                toolInvocations: 'toolInvocations' in msg ? msg.toolInvocations : []
            })) || []
        }));
    } catch (error) {
        console.error("Failed to get chats by user from database");
        throw error;
    }
}

export async function getChatById({ id }: { id: string }) {
    try {
        const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
        return selectedChat;
    } catch (error) {
        console.error("Failed to get chat by id from database");
        throw error;
    }
}

export async function getChatForks({ chatId }: { chatId: string }) {
    try {
        return await db
            .select()
            .from(fork)
            .where(eq(fork.chatId, chatId))
            .orderBy(desc(fork.createdAt));
    } catch (error) {
        console.error("Failed to get chat forks from database");
        throw error;
    }
}

export async function getForkById({ id }: { id: string }): Promise<Fork | null> {
    try {
        const [selectedFork] = await db.select().from(fork).where(eq(fork.id, id));
        return selectedFork;
    } catch (error) {
        console.error("Failed to get fork by id from database");
        throw error;
    }
}

export async function deleteForkById({ id }: { id: string }) {
    try {
        return await db.delete(fork).where(eq(fork.id, id));
    } catch (error) {
        console.error("Failed to delete fork by id from database");
        throw error;
    }
}

export async function saveFork({
    id,
    messages,
    parentForkId,
    chatId,
    editedMessageId,
    editPoint,
    title,
}: {
    id: string;
    messages: ExtendedMessage[];
    parentForkId?: string;
    chatId: string;
    editedMessageId: string;
    editPoint: {
        messageId: string;
        originalContent: string;
        newContent: string;
        timestamp: string;
    };
    title?: string;
}) {
    if (!id || !messages || !chatId || !editedMessageId || !editPoint) {
        throw new Error('Missing required fields for saving fork');
    }

    // Ensure editPoint has all required fields
    if (!editPoint.messageId || !editPoint.originalContent || !editPoint.newContent || !editPoint.timestamp) {
        throw new Error('EditPoint missing required fields');
    }

    const normalizedMessages = messages.map(msg => ({
        ...msg,
        content: msg.content,
        toolInvocations: 'toolInvocations' in msg ? msg.toolInvocations : [],
        role: msg.role
    }));

    try {
        const selectedForks = await db.select().from(fork).where(eq(fork.id, id));

        if (selectedForks.length > 0) {
            // For existing forks, maintain the original editPoint
            return await db
                .update(fork)
                .set({
                    messages: JSON.stringify(normalizedMessages),
                    title: title || selectedForks[0].title,
                    status: 'submitted'
                })
                .where(eq(fork.id, id));
        }

        // For new forks
        return await db.insert(fork).values({
            id,
            chatId,
            parentMessageId: editedMessageId,
            messages: JSON.stringify(normalizedMessages),
            editPoint: editPoint, // Don't stringify - let Drizzle handle the JSONB conversion
            title: title || `Fork at message ${editedMessageId}`,
            createdAt: new Date(),
            status: 'draft'
        });
    } catch (error) {
        console.error("Failed to save fork in database:", error);
        throw error;
    }
}

export async function createFork({
    chatId,
    parentChatId,
    parentMessageId,
    messages,
    title,
    editPoint,
}: CreateForkParams) {
    try {
        const [newFork] = await db.insert(fork).values({
            chatId,
            parentChatId,
            parentMessageId,
            messages: JSON.stringify(messages),
            title: title || `Fork from ${parentMessageId}`,
            editPoint,
            status: 'draft'
        }).returning();

        return newFork;
    } catch (error) {
        console.error("Failed to create fork:", error);
        throw error;
    }
}

export async function updateForkStatus({
    id,
    status,
}: {
    id: string;
    status: 'draft' | 'submitted';
}) {
    try {
        const [updatedFork] = await db
            .update(fork)
            .set({ status })
            .where(eq(fork.id, id))
            .returning();

        return updatedFork;
    } catch (error) {
        console.error("Failed to update fork status:", error);
        throw error;
    }
}

export async function updateChatMessage({
    chatId,
    messageId,
    content,
}: {
    chatId: string;
    messageId: string;
    content: string;
}) {
    try {
        const [selectedChat] = await db
            .select()
            .from(chat)
            .where(eq(chat.id, chatId));

        if (!selectedChat) throw new Error('Chat not found');

        // Safely parse messages string or handle object
        const messages = typeof selectedChat.messages === 'string'
            ? JSON.parse(selectedChat.messages)
            : selectedChat.messages as ChatMessage[];

        const updatedMessages = messages.map((msg: ChatMessage) =>
            msg.id === messageId ? { ...msg, content } : msg
        );

        const [updatedChat] = await db
            .update(chat)
            .set({
                messages: JSON.stringify(updatedMessages)
            })
            .where(eq(chat.id, chatId))
            .returning();

        return updatedChat;
    } catch (error) {
        console.error("Failed to update chat message:", error);
        throw error;
    }
}

import { Message } from "ai";
import { InferSelectModel, sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, json, uuid, integer, jsonb, text } from "drizzle-orm/pg-core";

import { MessageDiff, ForkAncestry } from "@/types/fork";
import { ExtendedMessage } from "@/types/tools";

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  password: varchar("password", { length: 64 }),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  messages: json("messages").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
});

export const fork = pgTable("Fork", {
  id: text("id").primaryKey(),
  chatId: text("chatId").notNull(),
  parentChatId: text("parentChatId"),
  parentMessageId: text("parentMessageId").notNull(),
  messageDiffs: jsonb("messageDiffs").$type<MessageDiff[]>().notNull().default([]),
  appendedMessages: jsonb("appendedMessages").$type<ExtendedMessage[]>().notNull().default([]),
  ancestry: jsonb("ancestry").$type<ForkAncestry[]>().notNull().default([]),
  title: text("title"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  editPoint: jsonb("editPoint").$type<MessageDiff>(),
  status: text("status", { enum: ["draft", "submitted"] }).notNull().default("draft"),
});

export type Chat = InferSelectModel<typeof chat>;
export type Fork = InferSelectModel<typeof fork>;

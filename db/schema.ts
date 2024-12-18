import { Message } from "ai";
import { InferSelectModel } from "drizzle-orm";
import { pgTable, varchar, timestamp, json, uuid } from "drizzle-orm/pg-core";

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
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  messages: json("messages").notNull(),
  parentForkId: uuid("parentForkId").references(() => fork.id),
  chatId: uuid("chatId").notNull().references(() => chat.id),
  createdAt: timestamp("createdAt").notNull(),
  title: varchar("title", { length: 255 }),
  editedMessageId: varchar("editedMessageId", { length: 64 }),
  editPoint: json("editPoint").notNull(),
});

export type Chat = InferSelectModel<typeof chat>;
export type Fork = InferSelectModel<typeof fork>;

import { InferSelectModel, sql } from "drizzle-orm";
import { pgTable, varchar, timestamp, json, uuid, integer } from "drizzle-orm/pg-core";

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
  chatId: uuid("chatId").notNull().references(() => chat.id, { onDelete: 'cascade' }),
  parentChatId: uuid("parentChatId").references(() => chat.id, { onDelete: 'set null' }),
  parentMessageId: uuid("parentMessageId").notNull(),
  messages: json("messages").notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  editPoint: json("editPoint").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
});

export type Chat = InferSelectModel<typeof chat>;
export type Fork = InferSelectModel<typeof fork>;

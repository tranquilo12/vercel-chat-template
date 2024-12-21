CREATE TABLE IF NOT EXISTS "Fork" (
	"id" text PRIMARY KEY NOT NULL,
	"chatId" text NOT NULL,
	"parentChatId" text,
	"parentMessageId" text NOT NULL,
	"messageDiffs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"appendedMessages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ancestry" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"editPoint" jsonb,
	"status" text DEFAULT 'draft' NOT NULL
);

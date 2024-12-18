CREATE TABLE IF NOT EXISTS "Fork" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "chatId" uuid NOT NULL,
    "parentChatId" uuid,
    "parentMessageId" uuid NOT NULL,
    "messages" json NOT NULL,
    "title" varchar(255),
    "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "editPoint" integer NOT NULL,
    "status" varchar(20) DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Fork" ADD CONSTRAINT "Fork_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Fork" ADD CONSTRAINT "Fork_parentChatId_Chat_id_fk" FOREIGN KEY ("parentChatId") REFERENCES "public"."Chat"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$; 
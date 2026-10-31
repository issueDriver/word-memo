CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"wordCount" integer DEFAULT 0 NOT NULL,
	"coverUrl" text NOT NULL,
	"bookId" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_bookId_unique" UNIQUE("bookId"),
	CONSTRAINT "books_word_count_check" CHECK ("books"."wordCount" >= 0),
	CONSTRAINT "books_status_check" CHECK ("books"."status" in ('published', 'draft'))
);
--> statement-breakpoint
ALTER TABLE "books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "words" ADD CONSTRAINT "words_bookId_books_bookId_fk" FOREIGN KEY ("bookId") REFERENCES "public"."books"("bookId") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "words_book_id_idx" ON "words" USING btree ("bookId");
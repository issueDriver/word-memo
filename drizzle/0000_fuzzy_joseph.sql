CREATE TABLE "admin-session" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin-session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin-users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(40) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login" timestamp with time zone,
	CONSTRAINT "admin_users_role_check" CHECK ("admin-users"."role" in ('system_admin', 'admin')),
	CONSTRAINT "admin_users_status_check" CHECK ("admin-users"."status" in ('active', 'disabled')),
	CONSTRAINT "admin_users_login_attempts_check" CHECK ("admin-users"."login_attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "admin-users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "admin-session" ADD CONSTRAINT "admin-session_admin_user_id_admin-users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin-users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_session_user_idx" ON "admin-session" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_session_expires_idx" ON "admin-session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_unique" ON "admin-users" USING btree (lower("email"));
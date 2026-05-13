CREATE TYPE "public"."block_status" AS ENUM('planned', 'in_progress', 'completed', 'skipped', 'pending');--> statement-breakpoint
CREATE TYPE "public"."booking_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."privacy_mode" AS ENUM('details_to_managers', 'busy_only_to_managers', 'private');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('backlog', 'todo', 'doing', 'done', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'manager', 'admin');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"time_block_id" uuid,
	"visitor_name" text NOT NULL,
	"visitor_email" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_users" (
	"manager_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_users_manager_id_user_id_pk" PRIMARY KEY("manager_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"priority" integer DEFAULT 3 NOT NULL,
	"estimated_minutes" integer DEFAULT 60 NOT NULL,
	"recurring_rule" jsonb,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"task_id" uuid,
	"title" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"actual_minutes" integer,
	"status" "block_status" DEFAULT 'planned' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"share_token" text,
	"privacy" "privacy_mode" DEFAULT 'busy_only_to_managers' NOT NULL,
	"timezone" text DEFAULT 'Asia/Bangkok' NOT NULL,
	"materialized_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_time_block_id_time_blocks_id_fk" FOREIGN KEY ("time_block_id") REFERENCES "public"."time_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_users" ADD CONSTRAINT "manager_users_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_users" ADD CONSTRAINT "manager_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_owner_status_idx" ON "bookings" USING btree ("owner_user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_owner_start_unique" ON "bookings" USING btree ("owner_user_id","start_at");--> statement-breakpoint
CREATE INDEX "categories_user_idx" ON "categories" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "manager_users_user_idx" ON "manager_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_user_status_idx" ON "tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "tasks_user_category_idx" ON "tasks" USING btree ("user_id","category_id");--> statement-breakpoint
CREATE INDEX "blocks_user_start_idx" ON "time_blocks" USING btree ("user_id","start_at");--> statement-breakpoint
CREATE INDEX "blocks_task_idx" ON "time_blocks" USING btree ("task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "blocks_task_start_unique" ON "time_blocks" USING btree ("task_id","start_at");
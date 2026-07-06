CREATE TABLE "booking_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "booking_event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"note_date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "event_type_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "reschedule_token" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancel_token" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "subtasks" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "labels" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "blocked_by_task_ids" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reminder_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reminder_minutes" integer;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD COLUMN "energy_level" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "booking_buffer_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "booking_min_notice_minutes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "booking_horizon_days" integer DEFAULT 14 NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_availability" ADD CONSTRAINT "booking_availability_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_event_types" ADD CONSTRAINT "booking_event_types_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_notes" ADD CONSTRAINT "daily_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "availability_owner_idx" ON "booking_availability" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "event_types_owner_idx" ON "booking_event_types" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "event_types_owner_slug_unique" ON "booking_event_types" USING btree ("owner_user_id","slug");--> statement-breakpoint
CREATE INDEX "daily_notes_user_date_idx" ON "daily_notes" USING btree ("user_id","note_date");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_event_type_id_booking_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."booking_event_types"("id") ON DELETE set null ON UPDATE no action;